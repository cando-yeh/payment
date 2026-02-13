import type { PageServerLoad, Actions } from './$types';
import { error, redirect, fail } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

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
