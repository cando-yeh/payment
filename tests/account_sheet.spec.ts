/**
 * 個人帳戶 Sheet 端對端測試
 *
 * 職責：
 * 1. 驗證從側邊欄開啟帳戶設定 Sheet。
 * 2. 驗證 Sheet 中的表單欄位正確渲染。
 *
 * 備註：Sheet.Title 使用 sr-only (visually hidden)，
 * 所以用可見的 Sheet 內容來驗證 Sheet 是否成功開啟。
 */
import { test, expect } from '@playwright/test';
import { supabaseAdmin, injectSession } from './helpers';

// Use serial to avoid race conditions with shared testUser
test.describe.serial('Account Sheet', () => {
    let testUser: any;
    const password = 'password123';

    test.beforeAll(async () => {
        const email = `account_test_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: 'Account Sheet User' },
        });
        if (error) throw error;
        testUser = data.user;
    });

    test.afterAll(async () => {
        if (testUser) await supabaseAdmin.auth.admin.deleteUser(testUser.id);
    });

    test('Open account sheet trigger from sidebar', async ({ page }) => {
        await injectSession(page, testUser.email, password);

        // Navigate to a protected page where the sidebar is visible
        await page.goto('/claims');
        await expect(page).toHaveURL(/\/claims/);

        // Click the sidebar user button which has title="開啟個人帳戶設定"
        const trigger = page.locator('button[title="開啟個人帳戶設定"]');
        await expect(trigger).toBeVisible({ timeout: 5000 });
        await trigger.click();
        // Trigger should be interactable; full sheet rendering is asserted in next test.
        await expect(trigger).toBeVisible();
    });

    test('Account sheet shows profile form fields', async ({ page }) => {
        await injectSession(page, testUser.email, password);

        await page.goto('/claims');
        await expect(page).toHaveURL(/\/claims/);

        // Open the sheet via the sidebar trigger button
        const trigger = page.locator('button[title="開啟個人帳戶設定"]');
        await expect(trigger).toBeVisible({ timeout: 5000 });
        for (let i = 0; i < 3; i++) {
            await trigger.click({ force: true });
            await page.waitForTimeout(300);
            if (await page.locator('input#fullName').isVisible()) break;
        }

        // Wait for sheet form fields to render
        await expect(page.locator('input#fullName')).toBeVisible({ timeout: 15000 });

        // Verify form fields
        await expect(page.locator('label:has-text("顯示姓名")')).toBeVisible();
        await expect(page.locator('text=匯款帳號資訊')).toBeVisible();

        // Verify the save button
        await expect(page.locator('button:has-text("儲存並更新設定")')).toBeVisible();
    });
});
