/**
 * SvelteKit 全域伺服器端載入器 (Layout Server Load)
 * 
 * 職責：
 * 1. 在伺服器端準備所有頁面共用的資料。
 * 2. 獲取當前使用者的 Session 資訊。
 */
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { getSession }, url, depends }) => {
    // 聲明依賴項，以便在 invalidate('supabase:auth') 時重新執行此 load 函數
    depends('supabase:auth');

    const session = await getSession();

    // 路由保護規則：
    // 若未登入且目前不在 /auth 路徑下，則強制跳轉至登入頁
    if (!session && !url.pathname.startsWith('/auth')) {
        throw redirect(303, '/auth');
    }

    // 若已登入但仍在 /auth 頁面，則導向至首頁
    if (session && url.pathname === '/auth') {
        throw redirect(303, '/');
    }

    return {
        session,
    };
};
