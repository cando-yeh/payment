import { redirect } from '@sveltejs/kit';
import {
    getClaimStatusesForTab,
    isClaimsTabKey,
    type ClaimsTabKey
} from '$lib/claims/constants';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 10;

function parsePage(value: string | null): number {
    const parsed = Number.parseInt(value || '1', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function getTab(value: string | null): ClaimsTabKey {
    return value && isClaimsTabKey(value) ? value : 'drafts';
}

async function resolveSearchClaimIds(
    supabase: App.Locals['supabase'],
    userId: string,
    statuses: readonly string[],
    search: string
) {
    const keyword = search.trim();
    if (!keyword) return null;

    const [idMatchesResponse, payeeMatchesResponse] = await Promise.all([
        supabase
            .from('claims')
            .select('id')
            .eq('applicant_id', userId)
            .in('status', [...statuses])
            .ilike('id', `%${keyword}%`)
            .limit(200),
        supabase
            .from('payees')
            .select('id')
            .ilike('name', `%${keyword}%`)
            .limit(200)
    ]);

    const payeeIds = (payeeMatchesResponse.data || [])
        .map((item) => item.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const payeeClaimMatchesResponse = payeeIds.length > 0
        ? await supabase
            .from('claims')
            .select('id')
            .eq('applicant_id', userId)
            .in('status', [...statuses])
            .in('payee_id', payeeIds)
            .limit(200)
        : { data: [], error: null };

    const firstError =
        idMatchesResponse.error ||
        payeeMatchesResponse.error ||
        payeeClaimMatchesResponse.error;
    if (firstError) {
        console.error('Error resolving claim search ids:', firstError);
        return [];
    }

    return Array.from(
        new Set([
            ...(idMatchesResponse.data || []).map((item) => item.id),
            ...(payeeClaimMatchesResponse.data || []).map((item) => item.id)
        ].filter((id): id is string => typeof id === 'string' && id.length > 0))
    );
}

export const load: PageServerLoad = async ({ locals: { supabase, getSession }, url }) => {
    const session = await getSession();
    if (!session) {
        throw redirect(303, '/auth');
    }

    const tab = getTab(url.searchParams.get('tab'));
    const search = url.searchParams.get('search')?.trim() || '';
    const requestedPage = parsePage(url.searchParams.get('page'));
    const statuses = getClaimStatusesForTab(tab);

    const countQueries = {
        drafts: supabase
            .from('claims')
            .select('id', { count: 'exact', head: true })
            .eq('applicant_id', session.user.id)
            .in('status', [...getClaimStatusesForTab('drafts')]),
        processing: supabase
            .from('claims')
            .select('id', { count: 'exact', head: true })
            .eq('applicant_id', session.user.id)
            .in('status', [...getClaimStatusesForTab('processing')]),
        actionRequired: supabase
            .from('claims')
            .select('id', { count: 'exact', head: true })
            .eq('applicant_id', session.user.id)
            .in('status', [...getClaimStatusesForTab('action_required')]),
        history: supabase
            .from('claims')
            .select('id', { count: 'exact', head: true })
            .eq('applicant_id', session.user.id)
            .in('status', [...getClaimStatusesForTab('history')])
    };

    const [searchClaimIds, draftsCountResponse, processingCountResponse, actionRequiredCountResponse, historyCountResponse] =
        await Promise.all([
            resolveSearchClaimIds(supabase, session.user.id, statuses, search),
            countQueries.drafts,
            countQueries.processing,
            countQueries.actionRequired,
            countQueries.history
        ]);

    let totalCountQuery = supabase
        .from('claims')
        .select('id', { count: 'exact', head: true })
        .eq('applicant_id', session.user.id)
        .in('status', [...statuses]);

    if (Array.isArray(searchClaimIds)) {
        if (search && searchClaimIds.length === 0) {
            return {
                claims: [],
                tab,
                search,
                page: 1,
                pageSize: PAGE_SIZE,
                totalItems: 0,
                tabCounts: {
                    drafts: draftsCountResponse.count || 0,
                    processing: processingCountResponse.count || 0,
                    actionRequired: actionRequiredCountResponse.count || 0,
                    history: historyCountResponse.count || 0
                }
            };
        }
        if (searchClaimIds.length > 0) {
            totalCountQuery = totalCountQuery.in('id', searchClaimIds);
        }
    }

    const { count, error: totalCountError } = await totalCountQuery;
    const totalItems = count ?? 0;
    if (totalCountError) {
        console.error('Error counting claims:', totalCountError);
        return {
            claims: [],
            tab,
            search,
            page: 1,
            pageSize: PAGE_SIZE,
            totalItems: 0,
            tabCounts: {
                drafts: draftsCountResponse.count || 0,
                processing: processingCountResponse.count || 0,
                actionRequired: actionRequiredCountResponse.count || 0,
                history: historyCountResponse.count || 0
            }
        };
    }

    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);
    const rangeFrom = (page - 1) * PAGE_SIZE;
    const rangeTo = rangeFrom + PAGE_SIZE - 1;

    let query = supabase
        .from('claims')
        .select(`
            *,
            payee:payees(name),
            items:claim_items(count),
            applicant:profiles!claims_applicant_id_fkey(full_name)
        `)
        .eq('applicant_id', session.user.id)
        .in('status', [...statuses])
        .order('created_at', { ascending: false })
        .range(rangeFrom, rangeTo);

    if (Array.isArray(searchClaimIds) && searchClaimIds.length > 0) {
        query = query.in('id', searchClaimIds);
    }

    const { data: claims, error } = await query;

    if (error) {
        console.error('Error fetching claims:', error);
        return {
            claims: [],
            tab,
            search,
            page,
            pageSize: PAGE_SIZE,
            totalItems,
            tabCounts: {
                drafts: draftsCountResponse.count || 0,
                processing: processingCountResponse.count || 0,
                actionRequired: actionRequiredCountResponse.count || 0,
                history: historyCountResponse.count || 0
            }
        };
    }

    return {
        claims,
        tab,
        search,
        page,
        pageSize: PAGE_SIZE,
        totalItems,
        tabCounts: {
            drafts: draftsCountResponse.count || 0,
            processing: processingCountResponse.count || 0,
            actionRequired: actionRequiredCountResponse.count || 0,
            history: historyCountResponse.count || 0
        }
    };
};
