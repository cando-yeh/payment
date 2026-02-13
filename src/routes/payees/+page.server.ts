import type { PageServerLoad, Actions } from './$types';
import { error, redirect, fail } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { uploadFileToStorage, validateFileUpload } from '$lib/server/storage-upload';

const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

function getServiceRoleClient() {
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY 未設定');
    }
    return createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export const load: PageServerLoad = async ({ locals }) => {
    const { supabase, getSession } = locals;
    const session = await getSession();
    if (!session) {
        throw redirect(303, '/auth');
    }

    // 1. Fetch data in parallel
    const [payeesResponse, requestsResponse] = await Promise.all([
        supabase
            .from('payees')
            .select('id, name, type, status, bank, bank_account, service_description, created_at, updated_at')
            .order('created_at', { ascending: false }),
        supabase
            .from('payee_change_requests')
            .select(`
                id, 
                change_type, 
                status, 
                proposed_data, 
                proposed_bank_account,
                reason, 
                created_at, 
                requested_by, 
                payee_id
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
    ]);

    if (payeesResponse.error) {
        console.error('Error fetching payees:', payeesResponse.error);
        throw error(500, 'Error fetching payees');
    }

    if (requestsResponse.error) {
        console.error('Error fetching pending requests:', requestsResponse.error);
    }

    return {
        payees: payeesResponse.data || [],
        pendingRequests: requestsResponse.data || [],
        user: session.user,
        is_finance: locals.user?.is_finance ?? false
    };
};

export const actions: Actions = {
    /**
     * 更新受款人資料申請
     */
    updatePayeeRequest: async ({ request, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const formData = await request.formData();
        const payeeId = formData.get('id') as string;

        if (!payeeId) {
            return fail(400, { message: '缺少受款人 ID' });
        }

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
        if (!name) return fail(400, { message: '受款人名稱為必填' });

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
                if (files.id_front && files.id_front.size > 0) {
                    validateFileUpload(files.id_front, '身分證正面', {
                        maxBytes: MAX_ATTACHMENT_SIZE_BYTES,
                        allowedTypes: ALLOWED_ATTACHMENT_TYPES
                    });
                }
                if (files.id_back && files.id_back.size > 0) {
                    validateFileUpload(files.id_back, '身分證反面', {
                        maxBytes: MAX_ATTACHMENT_SIZE_BYTES,
                        allowedTypes: ALLOWED_ATTACHMENT_TYPES
                    });
                }
                if (files.bank_cover && files.bank_cover.size > 0) {
                    validateFileUpload(files.bank_cover, '存摺封面', {
                        maxBytes: MAX_ATTACHMENT_SIZE_BYTES,
                        allowedTypes: ALLOWED_ATTACHMENT_TYPES
                    });
                }
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

        return { success: true, message: '更新申請已提交' };
    },

    /**
     * 解密收款人銀行帳號 (僅財務/管理員)
     */
    revealPayeeAccount: async ({ request, locals: { supabase, getSession, user } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: '未登入' });

        // 財務或管理員才可解密
        if (!user?.is_finance && !user?.is_admin) {
            return fail(403, { message: '權限不足' });
        }

        const formData = await request.formData();
        const payeeId = formData.get('payeeId') as string;

        if (!payeeId) return fail(400, { message: 'Missing payeeId' });

        const { data, error } = await supabase.rpc('reveal_payee_bank_account', {
            _payee_id: payeeId
        });

        if (error) {
            console.error('Reveal Account Error:', error);
            return fail(500, { message: '解密失敗' });
        }

        return { success: true, decryptedAccount: data };
    },
    /**
     * 核准受款人申請 (僅財務權限)
     */
    approvePayeeRequest: async ({ request, locals: { supabase, getSession, user } }) => {
        const session = await getSession();
        if (!session || !user?.is_finance) {
            return fail(403, { message: '權限不足：僅財務人員可核准申請' });
        }

        const formData = await request.formData();
        const requestId = formData.get('requestId') as string;

        if (!requestId) return fail(400, { message: '缺少申請 ID' });

        const { error: rpcError } = await supabase.rpc('approve_payee_change_request', {
            _request_id: requestId
        });

        if (rpcError) {
            console.error('Approval RPC Error:', rpcError);
            return fail(500, { message: '核准失敗：' + rpcError.message });
        }

        return { success: true, message: '申請已核准' };
    },

    /**
     * 駁回受款人申請 (僅財務權限)
     */
    rejectPayeeRequest: async ({ request, locals: { supabase, getSession, user } }) => {
        const session = await getSession();
        if (!session || !user?.is_finance) {
            return fail(403, { message: '權限不足：僅財務人員可駁回申請' });
        }

        const formData = await request.formData();
        const requestId = formData.get('requestId') as string;

        if (!requestId) return fail(400, { message: '缺少申請 ID' });

        const { error: rpcError } = await supabase.rpc('reject_payee_change_request', {
            _request_id: requestId
        });

        if (rpcError) {
            console.error('Rejection RPC Error:', rpcError);
            return fail(500, { message: '駁回失敗：' + rpcError.message });
        }

        return { success: true, message: '申請已駁回' };
    },

    /**
     * 撤銷受款人新增申請
     * 僅允許申請人撤銷自己的 pending 申請
     */
    withdrawRequest: async ({ request, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: '未登入' });

        const formData = await request.formData();
        const requestId = formData.get('requestId') as string;

        if (!requestId) return fail(400, { message: '缺少申請 ID' });

        // 驗證申請存在且為 pending 狀態，且為申請人本人
        const { data: changeRequest, error: fetchError } = await supabase
            .from('payee_change_requests')
            .select('id, status, requested_by')
            .eq('id', requestId)
            .single();

        if (fetchError || !changeRequest) {
            return fail(404, { message: '找不到此申請' });
        }

        if (changeRequest.status !== 'pending') {
            return fail(400, { message: '僅能撤銷待審核的申請' });
        }

        if (changeRequest.requested_by !== session.user.id) {
            return fail(403, { message: '僅能撤銷自己的申請' });
        }

        // 更新狀態為 withdrawn
        const { error: updateError } = await supabase
            .from('payee_change_requests')
            .update({ status: 'withdrawn' })
            .eq('id', requestId);

        if (updateError) {
            return fail(500, { message: '撤銷失敗', error: updateError.message });
        }

        return { success: true, message: '申請已撤銷' };
    },

    /**
     * 提交停用受款人申請
     */
    submitDisableRequest: async ({ request, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: '未登入' });

        const formData = await request.formData();
        const payeeId = formData.get('payeeId') as string;
        const reason = formData.get('reason') as string || '停用受款人申請';


        if (!payeeId) return fail(400, { message: '缺少受款人 ID' });

        const { error: rpcError } = await supabase.rpc('submit_payee_change_request', {
            _change_type: 'disable',
            _payee_id: payeeId,
            _proposed_data: {},
            _proposed_tax_id: null,
            _proposed_bank_account: null,
            _reason: reason
        });

        if (rpcError) {
            console.error('Disable Request Error:', rpcError);
            return fail(500, { message: '提交停用申請失敗：' + rpcError.message });
        }

        return { success: true, message: '停用申請已提交，請等待財務審核' };
    },

    /**
     * 永久刪除收款人 (僅財務權限)
     * 並處理資料庫 FK 限制驗證
     */
    removePayee: async ({ request, locals: { supabase, getSession, user } }) => {
        const session = await getSession();
        if (!session || !user?.is_finance) {
            return fail(403, { message: '權限不足：僅財務人員可執行此操作' });
        }

        const formData = await request.formData();
        const payeeId = formData.get('payeeId') as string;

        if (!payeeId) return fail(400, { message: '缺少收款人 ID' });

        let serviceRoleClient;
        try {
            serviceRoleClient = getServiceRoleClient();
        } catch (e: any) {
            return fail(500, { message: `刪除失敗：${e?.message || '缺少 Service Role 設定'}` });
        }

        const { error: deleteError } = await serviceRoleClient
            .from('payees')
            .delete()
            .eq('id', payeeId);

        if (deleteError) {
            console.error('Delete Payee Error:', deleteError);
            // 處理 FK 衝突 (PostgreSQL error code 23503)
            if (deleteError.code === '23503') {
                return fail(400, {
                    message: '無法刪除：此收款人已有關聯之報銷案件或申請記錄。請改成「停用」處理。'
                });
            }
            return fail(500, { message: '刪除失敗：' + deleteError.message });
        }

        return { success: true, message: '收款人已永久刪除' };
    },

    /**
     * 直接切換收款人狀態 (僅財務權限)
     */
    toggleStatus: async ({ request, locals: { getSession, user } }) => {
        const session = await getSession();
        if (!session || !user?.is_finance) {
            return fail(403, { message: '權限不足：僅財務人員可執行此操作' });
        }

        const formData = await request.formData();
        const payeeId = formData.get('payeeId') as string;
        const currentStatus = formData.get('currentStatus') as string;

        if (!payeeId) return fail(400, { message: '缺少收款人 ID' });

        const newStatus = currentStatus === 'available' ? 'disabled' : 'available';

        let serviceRoleClient;
        try {
            serviceRoleClient = getServiceRoleClient();
        } catch (e: any) {
            return fail(500, { message: `更新狀態失敗：${e?.message || '缺少 Service Role 設定'}` });
        }

        const { data: updatedRows, error: updateError } = await serviceRoleClient
            .from('payees')
            .update({ status: newStatus })
            .eq('id', payeeId)
            .select('id');

        if (updateError) {
            console.error('Toggle Status Error:', updateError);
            return fail(500, { message: '更新狀態失敗：' + updateError.message });
        }
        if (!updatedRows || updatedRows.length === 0) {
            return fail(404, { message: '更新狀態失敗：找不到收款人或目前權限不足' });
        }

        return { success: true, message: `收款人已${newStatus === 'available' ? '啟用' : '停用'}` };
    }
};
