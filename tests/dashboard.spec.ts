/**
 * Dashboard 端對端測試
 *
 * 職責：
 * 1. 驗證未登入狀態顯示登入介面（Google 登入按鈕）。
 * 2. 驗證已登入狀態顯示使用者資訊與登出按鈕。
 */
import { test, expect } from '@playwright/test';
import { supabaseAdmin, injectSession } from './helpers';

test.describe('Dashboard', () => {
    let testUser: any;
    const password = 'password123';

    test.beforeAll(async () => {
        const email = `dashboard_test_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: 'Dashboard Test User' },
        });
        if (error) throw error;
        testUser = data.user;
    });

    test.afterAll(async () => {
        if (testUser) await supabaseAdmin.auth.admin.deleteUser(testUser.id);
    });

    test('Unauthenticated user sees login interface', async ({ page }) => {
        await page.goto('/');

        // The root page renders Google login UI when not authenticated
        await expect(page.locator('text=請款系統')).toBeVisible();
        await expect(
            page.locator('button:has-text("透過企業 Google 帳號登入")')
        ).toBeVisible();
    });

    test('Authenticated user sees session info', async ({ page }) => {
        await injectSession(page, testUser.email, password);

        await page.goto('/');
        // Should see user email displayed
        await expect(page.getByText(testUser.email)).toBeVisible();
        // Should see logout button
        await expect(page.locator('button:has-text("登出系統")')).toBeVisible();
    });
});
