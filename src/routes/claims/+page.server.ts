import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, getSession }, url }) => {
    const session = await getSession();
    if (!session) {
        throw redirect(303, '/auth');
    }

    const tab = url.searchParams.get('tab') || 'drafts';
    const search = url.searchParams.get('search') || '';

    // Default to fetch drafts
    let query = supabase
        .from('claims')
        .select(`
            *,
            payee:payees(name),
            items:claim_items(count),
            approver:applicant_id(full_name) -- Just for now, might need better relation
        `)
        .eq('applicant_id', session.user.id)
        .order('created_at', { ascending: false });

    // Filter by tab
    if (tab === 'drafts') {
        query = query.in('status', ['draft', 'returned']);
    } else if (tab === 'processing') {
        query = query.in('status', ['pending_manager', 'pending_finance', 'pending_payment']);
    } else if (tab === 'action_required') {
        query = query.in('status', ['paid_pending_doc', 'pending_doc_review']);
    } else if (tab === 'history') {
        query = query.in('status', ['paid', 'cancelled']);
    }

    // Filter by search (simple implementation for now)
    if (search) {
        // Note: Searching description or ID. 
        // Complex search might need a different approach or RPC if joining multiple tables
        query = query.or(`description.ilike.%${search}%,id.ilike.%${search}%`);
    }

    const { data: claims, error } = await query;

    if (error) {
        console.error('Error fetching claims:', error);
        return { claims: [] };
    }

    return {
        claims,
        tab,
        search
    };
};
