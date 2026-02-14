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

export const load: LayoutServerLoad = async ({ locals, depends }) => {
    const { getSession } = locals;
    // 聲明依賴項，以便在 invalidate('supabase:auth') 時重新執行此 load 函數
    depends('supabase:auth');

    const session = await getSession();
    let profile = null;

    if (session) {
        const [profileResponse, approverResponse] = await Promise.all([
            locals.supabase
                .from('profiles')
                .select('full_name, email, avatar_url, approver_id, bank, bank_account_tail')
                .eq('id', session.user.id)
                .single(),
            locals.supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('approver_id', session.user.id)
                .limit(1)
        ]);

        if (!profileResponse.error && profileResponse.data) {
            let approverName: string | null = null;
            if (profileResponse.data.approver_id) {
                const serviceRoleClient = env.SUPABASE_SERVICE_ROLE_KEY
                    ? createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
                    : null;

                const queryClient = serviceRoleClient ?? locals.supabase;
                const { data: approverData } = await queryClient
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
        } else {
            // fallback: profile 讀取失敗時，至少保留 session 與 hooks 注入的角色資訊
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
        profile
    };
};
