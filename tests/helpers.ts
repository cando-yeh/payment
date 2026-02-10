/**
 * Playwright 測試共用工具
 * 
 * 職責：
 * 1. 統一載入環境變數
 * 2. 提供 Supabase Admin Client
 * 3. 提供 injectSession() 輔助函數，消除各測試中重複的登入邏輯
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

// 載入環境變數
const envConfig = dotenv.parse(readFileSync('.env'));
export const supabaseUrl = envConfig.PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = envConfig.PUBLIC_SUPABASE_ANON_KEY;
export const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

// 從 Supabase URL 動態擷取 project ref（取代 hardcoded 值）
export const projectRef = new URL(supabaseUrl).hostname.split('.')[0];

// Service Role Admin Client
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * 將 Supabase Session 注入到 Playwright Page 中
 * 
 * 流程：
 * 1. 用密碼登入取得 session
 * 2. 寫入 Cookie（SSR 用）
 * 3. 寫入 LocalStorage（CSR 用）
 * 4. 重新載入頁面以套用 session
 * 
 * @param page - Playwright Page 實例
 * @param email - 使用者 email
 * @param password - 使用者密碼
 */
export async function injectSession(page: Page, email: string, password: string) {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { session }, error } = await client.auth.signInWithPassword({
        email,
        password,
    });
    if (error) throw error;

    const storageKey = `sb-${projectRef}-auth-token`;

    // 寫入 Cookie（SSR）
    await page.context().addCookies([{
        name: storageKey,
        value: JSON.stringify(session),
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
    }]);

    // 寫入 LocalStorage（CSR）
    await page.goto('/');
    await page.evaluate(({ key, value }) => {
        localStorage.setItem(key, JSON.stringify(value));
    }, { key: storageKey, value: session });

    await page.reload();
}
