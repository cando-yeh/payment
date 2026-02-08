/**
 * OAuth 認證回傳處理中心 (Server-side API Route)
 * 
 * 職責：
 * 1. 接收 Google OAuth 驗證成功後，由 Google 重導向回來的授權碼 (code)。
 * 2. 呼叫 Supabase API 將此授權碼換成正式的使用者會話 (Session)。
 * 3. 處理換證成功後的跳轉，或是失敗時的錯誤導向。
 */
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
    const {
        url,
        locals: { supabase }
    } = event;

    // 從 URL 參數中獲取授權碼 (code)
    const code = url.searchParams.get('code');

    // 获取跳轉路徑，預設回首頁
    const next = url.searchParams.get('next') ?? '/';

    if (code) {
        /**
         * 交換 Session：
         * 這是一個伺服器對伺服器 (S2S) 的請求。
         * 成功後，Supabase SSR 會自動透過 supabaseHandle 設定 Cookie。
         */
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // 交換成功，導向使用者原本要求的頁面 (next) 或首頁
            // 使用 slice(1) 移除可能的前導斜線，避免雙斜線問題
            throw redirect(303, `/${next.slice(1)}`);
        }
    }

    /**
     * 出錯處理：
     * 如果沒有 code 或交換代碼失敗，導向至錯誤顯示頁面。
     * (需在 routes/auth/下建立對應頁面)
     */
    throw redirect(303, '/auth/auth-code-error');
};
