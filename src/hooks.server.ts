/**
 * SvelteKit 伺服器端攔截器 (Server Hooks)
 * 
 * 職責：
 * 1. 攔截每一筆傳入的伺服器端請求。
 * 2. 初始化 Supabase 認證狀態。
 * 3. 未來可擴充：路由保護、日誌記錄、效能監控。
 */
import { supabaseHandle } from '$lib';
import { sequence } from '@sveltejs/kit/hooks';
import { redirect, type Handle } from '@sveltejs/kit';

/**
 * 認證與權限控制攔截器 (Auth & RBAC Hook)
 */
const authHandle: Handle = async ({ event, resolve }) => {
    const session = await event.locals.getSession();
    const { pathname } = event.url;

    // 1. 公開頁面不需要驗證
    const isPublicRoute = pathname === '/' || pathname.startsWith('/auth');

    if (!isPublicRoute && !session) {
        // 未登入使用者存取私有頁面，重導向至登入頁
        throw redirect(303, `/auth?next=${pathname}`);
    }

    // 2. 獲取使用者角色 (RBAC)
    if (session) {
        const { data: profile } = await event.locals.supabase
            .from('profiles')
            .select('is_admin, is_finance')
            .eq('id', session.user.id)
            .single();

        // 注入到 event.locals 供各頁面輕易存取
        event.locals.user = {
            ...session.user,
            is_admin: profile?.is_admin ?? false,
            is_finance: profile?.is_finance ?? false
        };

        // 3. 行政/管理路由保護
        if (pathname.startsWith('/admin') && !event.locals.user.is_admin) {
            throw redirect(303, '/');
        }

        // 4. 財務路由保護
        if (pathname.startsWith('/finance') && !event.locals.user.is_finance) {
            throw redirect(303, '/');
        }
    }

    return resolve(event);
};

/**
 * Handle 入口函數
 * 
 * 使用 sequence 方法來串聯多個處理器：
 * - supabaseHandle: 處理 Supabase 客戶端初始化與 Cookie/Session 同步。
 * 
 * 執行流程：
 * Request → sequence(supabaseHandle) → Route Handler (+page.server.ts 等) → sequence(supabaseHandle) → Response
 */
export const handle = sequence(supabaseHandle, authHandle);
