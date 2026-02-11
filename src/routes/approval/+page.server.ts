import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, getSession } }) => {
    const session = await getSession();
    if (!session) {
        throw redirect(303, '/auth');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_finance, is_admin')
        .eq('id', session.user.id)
        .single();

    const isFinance = profile?.is_finance || false;
    const isAdmin = profile?.is_admin || false;

    // 1. Pending Manager Review (Current user is the approver)
    const { data: pendingManager } = await supabase
        .from('claims')
        .select(`
            *,
            applicant:profiles!claims_applicant_id_fkey(full_name, email, approver_id)
        `)
        .eq('status', 'pending_manager')
        .eq('applicant.approver_id', session.user.id);

    // 2. Pending Finance Review (User is finance staff)
    let pendingFinance = [];
    let pendingPayment = [];
    let pendingDocReview = [];

    if (isFinance || isAdmin) {
        const { data: pf } = await supabase
            .from('claims')
            .select('*, applicant:profiles!claims_applicant_id_fkey(full_name, email)')
            .eq('status', 'pending_finance');
        pendingFinance = pf || [];

        const { data: pp } = await supabase
            .from('claims')
            .select('*, applicant:profiles!claims_applicant_id_fkey(full_name, email)')
            .eq('status', 'pending_payment');
        pendingPayment = pp || [];

        const { data: pdr } = await supabase
            .from('claims')
            .select('*, applicant:profiles!claims_applicant_id_fkey(full_name, email)')
            .eq('status', 'pending_doc_review');
        pendingDocReview = pdr || [];
    }

    return {
        pendingManager: pendingManager || [],
        pendingFinance,
        pendingPayment,
        pendingDocReview,
        userRole: { isFinance, isAdmin }
    };
};
