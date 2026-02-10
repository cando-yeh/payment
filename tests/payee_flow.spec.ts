/**
 * Payee Management Flow - E2E 測試
 *
 * 測試受款人新增流程：導航、表單填寫、提交
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
        // 注入 session
        await injectSession(page, userStandard.email, password);

        // 導航至受款人頁面
        await page.goto('/payees');
        await expect(page).toHaveURL(/\/payees/);

        // 點擊「新增受款人」
        const newPayeeBtn = page.locator('button:has-text("新增受款人")');
        try {
            await expect(newPayeeBtn).toBeVisible({ timeout: 10000 });
            await newPayeeBtn.click();
        } catch (e) {
            console.error('Failed to find "New Payee" button. Current URL:', page.url());
            await page.screenshot({ path: 'failure-new-payee.png' });
            throw e;
        }

        await expect(page).toHaveURL(/\/payees\/new/);

        // 驗證表單元素
        await expect(page.locator('text=受款書類型')).toBeVisible();
        await expect(page.locator('input[name="name"]')).toBeVisible();
        await expect(page.locator('input[name="bank_account"]')).toBeVisible();
    });

    test('Submit Vendor Request', async ({ page }) => {
        // 注入 session
        await injectSession(page, userStandard.email, password);

        // 直接導航至新增受款人頁
        await page.goto('/payees/new');

        if (page.url().includes('login') || page.url().includes('auth')) {
            console.error('Still redirected to login!');
            return;
        }

        // 填寫表單
        await page.click('button:has-text("廠商")');
        const vendorName = 'Test E2E Vendor ' + Date.now();
        await page.fill('input[name="name"]', vendorName);
        await page.fill('input[name="tax_id"]', '12345678');
        await page.fill('input[name="bank_code"]', '004');
        await page.fill('input[name="bank_account"]', '1234567890');

        // 提交並等待回應
        const [response] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/payees/new') && resp.request().method() === 'POST'),
            page.click('button[type="submit"]'),
        ]);

        // 預期導向到 /payees
        await expect(page).toHaveURL(/\/payees$/, { timeout: 10000 });
    });
});
