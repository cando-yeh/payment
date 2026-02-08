/**
 * Supabase 客戶端配置中心
 * 職責：定義瀏覽器與伺服器端的 Supabase 連線，處理 Session 與 Cookie 同步。
 */
import { createBrowserClient, createServerClient, parseCookieHeader } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Handle } from '@sveltejs/kit';

/**
 * 建立瀏覽器端使用的 Supabase Client
 */
export const createBrowserSupabaseClient = () =>
    createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

/**
 * SvelteKit Server-side Handle (用於 hooks.server.ts)
 * 負責處理 Session 同步與 Cookie
 */
export const supabaseHandle: Handle = async ({ event, resolve }) => {
    event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        cookies: {
            getAll() {
                return parseCookieHeader(event.request.headers.get('cookie') ?? '').map((c) => ({
                    name: c.name,
                    value: c.value ?? ''
                }));
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) =>
                    event.cookies.set(name, value, { ...options, path: '/' })
                );
            },
        },
    });

    /**
     * 輔助函數：獲取當前 Session
     */
    event.locals.getSession = async () => {
        const {
            data: { session },
        } = await event.locals.supabase.auth.getSession();
        return session;
    };

    return resolve(event, {
        filterSerializedResponseHeaders(name) {
            return name === 'content-range';
        },
    });
};
