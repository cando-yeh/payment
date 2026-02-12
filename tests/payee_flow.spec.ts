/**
 * Payee Management Flow - E2E 測試
 *
 * 測試受款人新增流程：導航、表單填寫、提交
 */
import { test, expect } from '@playwright/test';
import { supabaseAdmin, injectSession, postFormActionDetailed } from './helpers';

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

        // 直接導航至新增受款人頁
        await page.goto('/payees/new');
        await expect(page).toHaveURL(/\/payees\/new/);

        // 驗證表單元素
        await expect(page.locator('text=受款書類型')).toBeVisible();
        await expect(page.locator('input[name="name"]')).toBeVisible();
        await expect(page.locator('input[name="bank_account"]')).toBeVisible();
    });

    test('Submit Vendor Request', async ({ page }) => {
        await injectSession(page, userStandard.email, password);

        // 直接導航至新增受款人頁
        await page.goto('/payees/new');
        await expect(page).toHaveURL(/\/payees\/new/);

        const vendorName = 'Test E2E Vendor ' + Date.now();
        const result = await postFormActionDetailed(
            page,
            '/payees/new?/createPayeeRequest',
            {
                type: 'vendor',
                name: vendorName,
                tax_id: '12345678',
                bank_code: '004',
                bank_account: '1234567890',
                service_description: 'E2E vendor request'
            }
        );

        expect(result.status).toBe(200);
        expect(result.body).toContain('"type":"redirect"');
        expect(result.body).toContain('/payees');

        await page.goto('/payees');
        const pendingRow = page
            .locator('tbody tr')
            .filter({ hasText: vendorName })
            .first();
        await expect(pendingRow).toBeVisible({ timeout: 10000 });
        await expect(pendingRow.getByText(/待審核/)).toBeVisible();
    });
});
