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

const sanitizeRedirectPath = (next: string | null): string => {
    if (!next || !next.startsWith('/') || next.startsWith('//')) {
        return '/';
    }
    return next;
};

const isDomainRestrictionError = (text: string | null | undefined): boolean => {
    if (!text) return false;
    const normalized = text.toLowerCase();
    return (
        normalized.includes('domain') ||
        normalized.includes('forbidden') ||
        normalized.includes('not allowed') ||
        normalized.includes('runnii.com')
    );
};

export const GET: RequestHandler = async (event) => {
    const {
        url,
        locals: { supabase }
    } = event;

    // 從 URL 參數中獲取授權碼 (code)
    const code = url.searchParams.get('code');
    const oauthError = url.searchParams.get('error');
    const oauthErrorDescription = url.searchParams.get('error_description');

    // 获取跳轉路徑，預設回首頁
    const next = sanitizeRedirectPath(url.searchParams.get('next'));

    if (oauthError) {
        // 記下原始錯誤內容：網域限制是由 Supabase 的 before-user-created hook
        // 擋下的，被擋帳號的 email 只可能出現在 hook 回傳的訊息裡。
        // 先把真實訊息記進 log，才知道能不能在登入頁顯示「你剛才用的是哪個帳號」。
        console.warn('[auth/callback] OAuth 回傳錯誤', {
            error: oauthError,
            error_code: url.searchParams.get('error_code'),
            error_description: oauthErrorDescription
        });

        const restricted = isDomainRestrictionError(oauthErrorDescription) || isDomainRestrictionError(oauthError);
        const reason = restricted ? 'domain_restricted' : 'oauth_failed';
        throw redirect(303, `/auth?reason=${reason}`);
    }

    if (code) {
        /**
         * 交換 Session：
         * 這是一個伺服器對伺服器 (S2S) 的請求。
         * 成功後，Supabase SSR 會自動透過 supabaseHandle 設定 Cookie。
         */
        const {
            data: { session },
            error
        } = await supabase.auth.exchangeCodeForSession(code);

        if (!error && session?.user) {
            // Profile 存在性檢查：確保新使用者登入後自動建立資料
            const { data: profile } = await supabase
                .from('profiles')
                .select('id, email')
                .eq('id', session.user.id)
                .single();

            if (!profile) {
                // 如果找不到 Profile，則建立一筆基礎資料
                await supabase.from('profiles').insert({
                    id: session.user.id,
                    full_name: session.user.user_metadata.full_name || session.user.email?.split('@')[0] || 'User',
                    avatar_url: session.user.user_metadata.avatar_url,
                    email: session.user.email,
                });
            } else if (!profile.email && session.user.email) {
                await supabase
                    .from('profiles')
                    .update({ email: session.user.email })
                    .eq('id', session.user.id);
            }

            // 成功交換 Session，導向至安全路徑
            throw redirect(303, next);
        }

        if (error) {
            console.warn('[auth/callback] exchangeCodeForSession 失敗', {
                code: error.code,
                status: error.status,
                message: error.message
            });

            const restricted = isDomainRestrictionError(error.message) || isDomainRestrictionError(error.code);
            const reason = restricted ? 'domain_restricted' : 'oauth_failed';
            throw redirect(303, `/auth?reason=${reason}`);
        }
    }

    /**
     * 出錯處理：
     * 如果沒有 code 或交換代碼失敗，導向至錯誤顯示頁面。
     */
    throw redirect(303, '/auth?reason=oauth_failed');
};
