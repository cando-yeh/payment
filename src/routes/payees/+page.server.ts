import type { PageServerLoad, Actions } from './$types';
import { error, redirect, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals: { supabase, getSession } }) => {
    const session = await getSession();
    if (!session) {
        throw redirect(303, '/auth');
    }

    // 1. Fetch all existing payees
    const { data: payees, error: payeesError } = await supabase
        .from('payees')
        .select('id, name, type, status, bank, service_description, created_at, updated_at')
        .order('created_at', { ascending: false });

    if (payeesError) {
        console.error('Error fetching payees:', payeesError);
        throw error(500, 'Error fetching payees');
    }

    // 2. Fetch pending "Create" requests (these are not yet in the payees table)
    // We only need the pending creation requests to show them in the list as "Pending Approval"
    const { data: pendingCreates, error: requestsError } = await supabase
        .from('payee_change_requests')
        .select('id, change_type, status, proposed_data, reason, created_at, requested_by')
        .eq('change_type', 'create')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (requestsError) {
        console.error('Error fetching payee requests:', requestsError);
        // Non-blocking error, we can just return empty list
    }

    return {
        payees: payees || [],
        pendingCreates: pendingCreates || [],
        user: session.user
    };
};

export const actions: Actions = {
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
    }
};
