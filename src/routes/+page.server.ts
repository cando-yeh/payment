import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, getSession } }) => {
    const session = await getSession();
    if (!session) {
        return { session: null };
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_finance, is_admin, full_name')
        .eq('id', session.user.id)
        .single();

    // 1. Fetch My Claims Stats
    const { data: myStats } = await supabase
        .from('claims')
        .select('id, status, total_amount')
        .eq('applicant_id', session.user.id);

    const mySummary = {
        draft: myStats?.filter(c => c.status === 'draft').length || 0,
        pending: myStats?.filter(c => ['pending_manager', 'pending_finance', 'pending_payment'].includes(c.status)).length || 0,
        returned: myStats?.filter(c => c.status === 'returned').length || 0,
        paid: myStats?.filter(c => c.status === 'paid' || c.status === 'paid_pending_doc').length || 0,
        totalAmount: myStats?.filter(c => c.status === 'paid' || c.status === 'paid_pending_doc').reduce((sum, c) => sum + Number(c.total_amount), 0) || 0
    };

    // 2. Fetch Manager Stats (if applicable)
    let managerPendingCount = 0;
    const { count: mp } = await supabase
        .from('claims')
        .select('*, applicant:profiles!claims_applicant_id_fkey!inner(approver_id)', { head: true, count: 'exact' })
        .eq('status', 'pending_manager')
        .eq('applicant.approver_id', session.user.id);
    managerPendingCount = mp || 0;

    // 3. Fetch Finance Stats (if applicable)
    let financePendingFinanceCount = 0;
    let financePendingPaymentCount = 0;
    let financeTotalPendingAmount = 0;

    if (profile?.is_finance || profile?.is_admin) {
        const { count: pf } = await supabase
            .from('claims')
            .select('*', { head: true, count: 'exact' })
            .eq('status', 'pending_finance');
        financePendingFinanceCount = pf || 0;

        const { data: pp } = await supabase
            .from('claims')
            .select('total_amount')
            .eq('status', 'pending_payment');
        financePendingPaymentCount = pp?.length || 0;
        financeTotalPendingAmount = pp?.reduce((sum, c) => sum + Number(c.total_amount), 0) || 0;
    }

    // 4. Recent Activity (Last 5 history records related to user or their role)
    const myClaimIds = myStats?.map(c => c.id) || [];
    let activityQuery = supabase
        .from('claim_history')
        .select(`
            *,
            actor:profiles(full_name),
            claim:claims(description, id)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

    if (myClaimIds.length > 0) {
        // Use parentheses for IDs to ensure valid SQL
        const ids = myClaimIds.map(id => `"${id}"`).join(',');
        activityQuery = activityQuery.or(`actor_id.eq.${session.user.id},claim_id.in.(${ids})`);
    } else {
        activityQuery = activityQuery.eq('actor_id', session.user.id);
    }

    const { data: recentActivity } = await activityQuery;

    return {
        session,
        profile,
        mySummary,
        managerPendingCount,
        financeStats: {
            pendingFinance: financePendingFinanceCount,
            pendingPayment: financePendingPaymentCount,
            totalPendingAmount: financeTotalPendingAmount
        },
        recentActivity: recentActivity || []
    };
};
