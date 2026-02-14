import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { uploadFileToStorage, validateFileUpload } from '$lib/server/storage-upload';

const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const load: PageServerLoad = async ({ params, locals }) => {
    const { supabase, getSession, user } = locals;
    const session = await getSession();
    if (!session) {
        throw redirect(303, '/auth');
    }

    const { id } = params;

    // Fetch basic payee data
    const { data: payee, error: fetchError } = await supabase
        .from('payees')
        .select('*')
        .eq('id', id)
        .single();

    if (fetchError || !payee) {
        throw error(404, '找不到此收款人');
    }

    let decryptedTaxId = null;
    let decryptedBankAccount = null;

    // If user is finance or admin, try to decrypt sensitive data for the form
    if (user?.is_finance || user?.is_admin) {
        const [taxIdRes, bankAccRes] = await Promise.all([
            supabase.rpc('reveal_payee_tax_id', { _payee_id: id }),
            supabase.rpc('reveal_payee_bank_account', { _payee_id: id })
        ]);

        if (!taxIdRes.error) decryptedTaxId = taxIdRes.data;
        if (!bankAccRes.error) decryptedBankAccount = bankAccRes.data;
    }

    // Generate Signed URLs for attachments if they exist
    let attachmentUrls: Record<string, string | null> = {
        id_card_front: null,
        id_card_back: null,
        bank_passbook: null
    };

    if (payee.attachments && (user?.is_finance || user?.is_admin)) {
        const getUrl = async (path: string) => {
            if (!path) return null;
            const { data } = await supabase.storage.from('payees').createSignedUrl(path, 3600);
            return data?.signedUrl || null;
        };

        const [front, back, bank] = await Promise.all([
            getUrl(payee.attachments.id_card_front),
            getUrl(payee.attachments.id_card_back),
            getUrl(payee.attachments.bank_passbook)
        ]);

        attachmentUrls = {
            id_card_front: front,
            id_card_back: back,
            bank_passbook: bank
        };
    }

    return {
        payee: {
            ...payee,
            tax_id: decryptedTaxId,
            bank_account: decryptedBankAccount
        },
        attachmentUrls,
        is_finance: user?.is_finance || false
    };
};

export const actions: Actions = {
    updatePayeeRequest: async ({ params, request, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const { id: payeeId } = params;
        const formData = await request.formData();

        // Extract fields
        const type = (formData.get('type') as string || '').trim();
        const name = (formData.get('name') as string || '').trim();
        const tax_id = (formData.get('tax_id') as string || '').trim();
        const bank_account = (formData.get('bank_account') as string || '').trim();
        const bank_code = (formData.get('bank_code') as string || '').trim();
        const email = (formData.get('email') as string || '').trim();
        const address = (formData.get('address') as string || '').trim();
        const service_description = (formData.get('service_description') as string || '').trim();
        const reason = (formData.get('reason') as string || '').trim() || '資料更新申請';

        // --- Basic Validation ---
        if (!name) return fail(400, { message: '收款人名稱為必填' });

        if (type === 'vendor' && tax_id && !/^\d{8}$/.test(tax_id)) {
            return fail(400, { message: '統一編號格式不正確：須為 8 碼數字' });
        }
        if (type === 'personal' && tax_id && !/^[A-Z][0-9]{9}$/.test(tax_id)) {
            return fail(400, { message: '身分證字號格式不正確：須為「1 碼大寫英文字母」+「9 碼數字」' });
        }
        // --- Handle Attachments for Personal Payees ---
        let attachments: Record<string, any> = {};

        // Fetch current payee to get existing attachments because we need to merge
        const { data: currentPayee } = await supabase
            .from('payees')
            .select('attachments')
            .eq('id', payeeId)
            .single();

        if (type === 'personal') {
            const currentAttachments = currentPayee?.attachments || {};

            const files = {
                id_front: formData.get('attachment_id_front') as File,
                id_back: formData.get('attachment_id_back') as File,
                bank_cover: formData.get('attachment_bank_cover') as File
            };

            try {
                validateFileUpload(files.id_front, '身分證正面', {
                    maxBytes: MAX_ATTACHMENT_SIZE_BYTES,
                    allowedTypes: ALLOWED_ATTACHMENT_TYPES
                });
                validateFileUpload(files.id_back, '身分證反面', {
                    maxBytes: MAX_ATTACHMENT_SIZE_BYTES,
                    allowedTypes: ALLOWED_ATTACHMENT_TYPES
                });
                validateFileUpload(files.bank_cover, '存摺封面', {
                    maxBytes: MAX_ATTACHMENT_SIZE_BYTES,
                    allowedTypes: ALLOWED_ATTACHMENT_TYPES
                });
            } catch (err: any) {
                return fail(400, { message: err.message || '附件驗證失敗' });
            }

            try {
                // Determine new paths: use new upload if present, else use existing
                const newPaths = {
                    id_card_front: (files.id_front && files.id_front.size > 0)
                        ? await uploadFileToStorage(supabase, files.id_front, { bucket: 'payees', prefix: 'id_front' })
                        : currentAttachments.id_card_front,
                    id_card_back: (files.id_back && files.id_back.size > 0)
                        ? await uploadFileToStorage(supabase, files.id_back, { bucket: 'payees', prefix: 'id_back' })
                        : currentAttachments.id_card_back,
                    bank_passbook: (files.bank_cover && files.bank_cover.size > 0)
                        ? await uploadFileToStorage(supabase, files.bank_cover, { bucket: 'payees', prefix: 'bank_cover' })
                        : currentAttachments.bank_passbook
                };

                // Validate that we have all required attachments (either new or existing)
                if (!newPaths.id_card_front) return fail(400, { message: '請上傳身分證正面' });
                if (!newPaths.id_card_back) return fail(400, { message: '請上傳身分證反面' });
                if (!newPaths.bank_passbook) return fail(400, { message: '請上傳存摺封面' });

                attachments = newPaths;

            } catch (err: any) {
                console.error('File Upload Error:', err);
                return fail(500, { message: '檔案上傳失敗：' + (err.message || '未知錯誤') });
            }
        }


        const proposed_data: Record<string, string> = {
            name,
            type,
            bank_code,
            service_description,
            email,
            address
        };

        const { error: rpcError } = await supabase.rpc('submit_payee_change_request', {
            _change_type: 'update',
            _payee_id: payeeId,
            _proposed_data: proposed_data,
            _proposed_tax_id: tax_id || null,
            _proposed_bank_account: bank_account || null,
            _reason: reason,
            _proposed_attachments: attachments
        });

        if (rpcError) {
            console.error('Update Request Error:', rpcError);
            return fail(500, { message: '提交更新申請失敗：' + rpcError.message });
        }

        return redirect(303, '/payees');
    }
};
