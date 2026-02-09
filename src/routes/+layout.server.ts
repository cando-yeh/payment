/**
 * SvelteKit 全域伺服器端載入器 (Layout Server Load)
 * 
 * 職責：
 * 1. 在伺服器端準備所有頁面共用的資料。
 * 2. 獲取當前使用者的 Session 資訊。
 */
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url, depends }) => {
    const { getSession } = locals;
    // 聲明依賴項，以便在 invalidate('supabase:auth') 時重新執行此 load 函數
    depends('supabase:auth');

    const session = await getSession();
    let profile = null;

    if (session) {
        const { data, error } = await locals.supabase
            .from('profiles')
            .select('full_name, avatar_url, is_admin, is_finance, approver_id, bank')
            .eq('id', session.user.id)
            .single();

        if (!error && data) {
            // 做法 B：動態判斷我是否為別人的核准人
            const { count } = await locals.supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('approver_id', session.user.id);

            profile = { ...data, is_approver: (count || 0) > 0 };
        }
    }





    return {
        session,
        profile
    };
};
