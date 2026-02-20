import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, getSession } }) => {
    const session = await getSession();
    if (!session) {
        throw redirect(303, '/auth');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_finance')
        .eq('id', session.user.id)
        .single();

    if (!profile?.is_finance) {
        throw redirect(303, '/');
    }

    const { data: payments } = await supabase
        .from('payments')
        .select(`
            *,
            paid_by_profile:profiles!payments_paid_by_fkey(full_name),
            claims(status)
        `)
        .order('paid_at', { ascending: false });

    return {
        payments: payments || [],
    };
};
