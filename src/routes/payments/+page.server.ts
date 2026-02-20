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

    throw redirect(303, '/documents?tab=payments');
};
