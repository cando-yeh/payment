import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { uploadFileToStorage, validateFileUpload } from '$lib/server/storage-upload';

const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const load: PageServerLoad = async ({ locals: { getSession } }) => {
    const session = await getSession();
    if (!session) {
        throw redirect(303, '/auth');
    }
    return {};
};

export const actions: Actions = {
    /**
     * Handle the creation of a new payee request.
     * This action collects form data, separates sensitive fields (Tax ID, Bank Account),
     * and calls a secure RPC to submit the request.
     */
    createPayeeRequest: async ({ request, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const formData = await request.formData();

        // Extract basic fields
        const type = (formData.get('type') as string || '').trim();
        const name = (formData.get('name') as string || '').trim();

        // Extract sensitive fields (to be encrypted by RPC)
        const tax_id = (formData.get('tax_id') as string || '').trim();
        const bank_account = (formData.get('bank_account') as string || '').trim();

        // Extract other fields
        const bank_code = (formData.get('bank_code') as string || '').trim();
        const email = (formData.get('email') as string || '').trim();
        const address = (formData.get('address') as string || '').trim();
        const service_description = (formData.get('service_description') as string || '').trim();

        // --- Input Validation ---
        if (!name) {
            return fail(400, { message: '受款人名稱為必填' });
        }
        if (!['vendor', 'personal'].includes(type)) {
            return fail(400, { message: '無效的受款人類型' });
        }
        if (type === 'vendor' && !/^\d{8}$/.test(tax_id)) {
            return fail(400, { message: '統一編號格式不正確：須為 8 碼數字' });
        }
        // Match frontend validation
        if (type === 'personal') {
            if (!/^[A-Z][0-9]{9}$/.test(tax_id)) {
                return fail(400, { message: '身分證字號格式不正確：須為「1 碼大寫英文字母」+「9 碼數字」' });
            }
        }
        if (!/^\d{3}$/.test(bank_code)) {
            return fail(400, { message: '銀行代碼需為3碼數字' });
        }
        if (!bank_account) {
            return fail(400, { message: '銀行帳號為必填' });
        }

        // --- Handle Attachments (Personal Only) ---
        let attachments: Record<string, any> = {};

        if (type === 'personal') {
            const files = {
                id_front: formData.get('attachment_id_front') as File,
                id_back: formData.get('attachment_id_back') as File,
                bank_cover: formData.get('attachment_bank_cover') as File
            };

            try {
                validateFileUpload(files.id_front, '身分證正面', {
                    required: true,
                    maxBytes: MAX_ATTACHMENT_SIZE_BYTES,
                    allowedTypes: ALLOWED_ATTACHMENT_TYPES
                });
                validateFileUpload(files.id_back, '身分證反面', {
                    required: true,
                    maxBytes: MAX_ATTACHMENT_SIZE_BYTES,
                    allowedTypes: ALLOWED_ATTACHMENT_TYPES
                });
                validateFileUpload(files.bank_cover, '存摺封面', {
                    required: true,
                    maxBytes: MAX_ATTACHMENT_SIZE_BYTES,
                    allowedTypes: ALLOWED_ATTACHMENT_TYPES
                });
            } catch (err: any) {
                return fail(400, { message: err.message || '附件驗證失敗' });
            }

            try {
                // Upload files in parallel
                const results = await Promise.all([
                    uploadFileToStorage(supabase, files.id_front, { bucket: 'payees', prefix: 'id_front' }),
                    uploadFileToStorage(supabase, files.id_back, { bucket: 'payees', prefix: 'id_back' }),
                    uploadFileToStorage(supabase, files.bank_cover, { bucket: 'payees', prefix: 'bank_cover' })
                ]);

                attachments = {
                    id_card_front: results[0],
                    id_card_back: results[1],
                    bank_passbook: results[2]
                };
            } catch (err: any) {
                console.error('File Upload Error:', err);
                return fail(500, { message: '檔案上傳失敗：' + (err.message || '未知錯誤') });
            }
        }

        // Construct proposed_data for non-sensitive info
        // IMPORTANT: tax_id and bank_account are excluded here as they are handled separately for encryption
        const proposed_data: Record<string, string> = {
            name,
            type,
            bank_code,
            service_description,
            email,
            address
        };

        // Call the RPC to submit the request
        // The RPC handles:
        // 1. Encryption of tax_id and bank_account (using pgp_sym_encrypt)
        // 2. Insertion into payee_change_requests table
        // 3. Setting initial status to 'pending'
        const { error: rpcError } = await supabase.rpc('submit_payee_change_request', {
            _change_type: 'create',
            _payee_id: null, // New payee, so no ID yet
            _proposed_data: proposed_data,
            _proposed_tax_id: tax_id,        // Passed securely for encryption
            _proposed_bank_account: bank_account, // Passed securely for encryption
            _reason: 'New payee request',
            _proposed_attachments: attachments // Pass attachments
        });

        if (rpcError) {
            console.error('RPC Error:', rpcError);
            return fail(500, { message: '提交失敗：' + rpcError.message });
        }

        // Redirect to the Payee List page on success
        return redirect(303, '/payees');
    }
};
