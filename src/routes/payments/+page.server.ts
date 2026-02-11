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

    if (!profile?.is_finance && !profile?.is_admin) {
        throw redirect(303, '/');
    }

    const { data: payments, error } = await supabase
        .from('payments')
        .select(`
            *,
            paid_by_profile:profiles!payments_paid_by_fkey(full_name)
        `)
        .order('paid_at', { ascending: false });

    if (error) {
        console.error('Error fetching payments:', error);
        return { payments: [] };
    }

    return {
        payments: payments || []
    };
};
