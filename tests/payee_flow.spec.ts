/**
 * Payee Management Flow - E2E 測試
 *
 * 測試收款人新增流程：導航、表單填寫、提交
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

    test('Submit Vendor Request', async ({ page }) => {
        await injectSession(page, userStandard.email, password);

        // 直接導航至新增收款人頁
        await page.goto('/payees/new');
        await expect(page).toHaveURL(/\/payees\/new/);

        const vendorName = 'Test E2E Vendor ' + Date.now();
        await page.getByLabel(/公司\/個人名稱/).fill(vendorName);
        await page.getByLabel(/統一編號/).fill('12345678');
        await page.getByLabel(/服務項目說明/).fill('E2E vendor request');
        await page.getByLabel(/銀行帳號/).fill('1234567890');

        const bankCombobox = page.locator('button[role="combobox"]').first();
        await bankCombobox.click();
        await page.getByRole('button', { name: /004.*臺灣銀行/ }).click();

        await page.getByRole('button', { name: '提交申請' }).click();
        await expect(page).toHaveURL(/\/payees/);

        await page.goto('/payees');

        let found = false;
        for (let i = 0; i < 12; i++) {
            const pendingRow = page
                .locator('tbody tr')
                .filter({ hasText: vendorName })
                .first();
            if (await pendingRow.isVisible().catch(() => false)) {
                await expect(pendingRow.getByText(/待審核/)).toBeVisible();
                found = true;
                break;
            }
            await page.waitForTimeout(1500);
            await page.reload({ waitUntil: 'domcontentloaded' });
        }

        expect(found).toBeTruthy();
    });
});
