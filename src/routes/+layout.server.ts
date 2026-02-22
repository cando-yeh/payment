/**
 * SvelteKit 全域伺服器端載入器 (Layout Server Load)
 * 
 * 職責：
 * 1. 在伺服器端準備所有頁面共用的資料。
 * 2. 獲取當前使用者的 Session 資訊。
 */
import type { LayoutServerLoad } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';

// Module-level singleton: avoid recreating service-role client on every navigation.
const adminClient = env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

export const load: LayoutServerLoad = async ({ locals, depends }) => {
    const { getSession } = locals;
    // 聲明依賴項，以便在 invalidate('supabase:auth') 時重新執行此 load 函數
    depends('supabase:auth');

    const session = await getSession();
    let profile = null;
    let pendingCounters = {
        myClaimsActionRequired: 0,
        approvalPendingTotal: 0,
        payeePendingTotal: 0
    };

    if (session) {
        const [profileResponse, approverResponse] = await Promise.all([
            locals.supabase
                .from('profiles')
                .select(`
                    full_name,
                    email,
                    avatar_url,
                    approver_id,
                    bank,
                    bank_account_tail
                `)
                .eq('id', session.user.id)
                .single(),
            locals.supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('approver_id', session.user.id)
                .limit(1)
        ]);

        if (!profileResponse.error && profileResponse.data) {
            // 核准人名稱: 自引用 FK 在 PostgREST schema cache 中可能找不到 (PGRST200)
            // 因此改用獨立查詢取得
            let approverName: string | null = null;
            if (profileResponse.data.approver_id && adminClient) {
                const { data: approverData } = await adminClient
                    .from('profiles')
                    .select('full_name')
                    .eq('id', profileResponse.data.approver_id)
                    .single();
                approverName = approverData?.full_name || null;
            }

            profile = {
                ...profileResponse.data,
                approver_name: approverName,
                // 與 hooks.server.ts 的 RBAC 判定保持同一來源，避免 Sidebar 與實際授權不一致
                is_admin: locals.user?.is_admin ?? false,
                is_finance: locals.user?.is_finance ?? false,
                is_approver: (approverResponse.count || 0) > 0
            };

            const myClaimsPromise = locals.supabase
                .from('claims')
                .select('id', { count: 'exact', head: true })
                .eq('applicant_id', session.user.id)
                .in('status', ['rejected', 'paid_pending_doc']);

            const managerPendingPromise = locals.supabase
                .from('claims')
                .select(`
                    id,
                    applicant:profiles!claims_applicant_id_fkey!inner(approver_id)
                `, { count: 'exact', head: true })
                .eq('status', 'pending_manager')
                .eq('applicant.approver_id', session.user.id);

            const financePendingPromise = (profile.is_finance || profile.is_admin)
                ? locals.supabase
                    .from('claims')
                    .select('id', { count: 'exact', head: true })
                    .in('status', ['pending_finance', 'pending_payment', 'pending_doc_review'])
                : Promise.resolve({ count: 0, error: null } as any);

            const payeePendingPromise = (profile.is_finance || profile.is_admin)
                ? locals.supabase
                    .from('payee_change_requests')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', 'pending')
                : locals.supabase
                    .from('payee_change_requests')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', 'pending')
                    .eq('requested_by', session.user.id);

            const [myClaimsResult, managerPendingResult, financePendingResult, payeePendingResult] = await Promise.all([
                myClaimsPromise,
                managerPendingPromise,
                financePendingPromise,
                payeePendingPromise
            ]);

            pendingCounters = {
                myClaimsActionRequired: myClaimsResult.count || 0,
                approvalPendingTotal: (managerPendingResult.count || 0) + (financePendingResult.count || 0),
                payeePendingTotal: payeePendingResult.count || 0
            };
        } else {
            // fallback: profile 讀取失敗時，至少保留 session 與 hooks 注入的角色資訊
            console.error('[layout.server] Profile query FAILED!', 'error:', profileResponse.error, 'data:', profileResponse.data);
            profile = {
                full_name: session.user.user_metadata.full_name || session.user.email?.split('@')[0] || 'User',
                email: session.user.email || '',
                avatar_url: session.user.user_metadata.avatar_url || null,
                approver_id: null,
                approver_name: null,
                bank: null,
                bank_account_tail: null,
                is_admin: locals.user?.is_admin ?? false,
                is_finance: locals.user?.is_finance ?? false,
                is_approver: false
            };
        }
    }


    return {
        session,
        profile,
        pendingCounters
    };
};
