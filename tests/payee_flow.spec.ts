/**
 * Payee Management Flow - E2E 測試
 *
 * 測試收款人頁面基礎流程：導航與基本表單渲染
 */
import { test, expect } from '@playwright/test';
import { supabaseAdmin, injectSession } from './helpers';

// 增加 timeout
test.setTimeout(60000);

test.describe('Payee Management Flow', () => {
    let userStandard: any;
    const password = 'password123';

    test.beforeAll(async () => {
        // 建立標準測試使用者
        const email = `e2e_user_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;
        const { data: u1, error: e1 } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: 'E2E Test User' }
        });
        if (e1) throw e1;
        userStandard = u1.user;
    });

    test.afterAll(async () => {
        if (userStandard) await supabaseAdmin.auth.admin.deleteUser(userStandard.id);
    });

    test('Navigate to New Payee Page', async ({ page }) => {
        await injectSession(page, userStandard.email, password);

        // 直接導航至新增收款人頁
        await page.goto('/payees/new');
        await expect(page).toHaveURL(/\/payees\/new/);

        // 驗證表單元素
        await expect(page.locator('text=收款人類型')).toBeVisible();
        await expect(page.getByLabel(/公司\/個人名稱/)).toBeVisible();
        await expect(page.getByLabel(/銀行帳號/)).toBeVisible();
    });

});
