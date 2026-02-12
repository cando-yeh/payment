import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, getSession }, url }) => {
    const session = await getSession();
    if (!session) {
        throw redirect(303, '/auth');
    }

    const tab = url.searchParams.get('tab') || 'drafts';
    const search = url.searchParams.get('search') || '';

    let query = supabase
        .from('claims')
        .select(`
            *,
            payee:payees(name),
            items:claim_items(count),
            approver:profiles!claims_applicant_id_fkey(full_name)
        `)
        .eq('applicant_id', session.user.id)
        .order('created_at', { ascending: false });

    const { data: claims, error } = await query;

    if (error) {
        console.error('Error fetching claims:', error);
        return { claims: [], tab, search };
    }

    return {
        claims,
        tab,
        search
    };
};
