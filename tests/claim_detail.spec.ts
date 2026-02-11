/**
 * 請款單詳情頁端對端測試
 *
 * 職責：
 * 1. 驗證請款單詳情頁的基本資訊渲染（類型、描述、狀態、明細項）。
 * 2. 驗證草稿狀態的操作按鈕（提交審核、刪除）。
 * 3. 驗證刪除草稿後重新導向至列表。
 *
 * 測試資料透過 Supabase Admin 直接插入，避免依賴 UI 表單的脆弱性。
 */
import { test, expect } from '@playwright/test';
import { supabaseAdmin, injectSession } from './helpers';

test.describe.serial('Claim Detail Page', () => {
    let testUser: any;
    const password = 'password123';
    let claimId: string;

    test.beforeAll(async () => {
        // Create test user
        const email = `claim_detail_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: 'Detail Test User' },
        });
        if (error) throw error;
        testUser = data.user;

        // Create a draft claim directly via DB
        claimId = Math.random().toString(36).substring(2, 10).toUpperCase();
        const { error: claimErr } = await supabaseAdmin
            .from('claims')
            .insert({
                id: claimId,
                claim_type: 'employee',
                description: 'Detail Test Claim',
                applicant_id: testUser.id,
                total_amount: 300,
                status: 'draft',
            });
        if (claimErr) throw claimErr;

        // Create a line item for the claim
        const { error: itemErr } = await supabaseAdmin
            .from('claim_items')
            .insert({
                claim_id: claimId,
                item_index: 1,
                date_start: new Date().toISOString().split('T')[0],
                category: 'travel',
                description: 'Test line item',
                amount: 300,
            });
        if (itemErr) throw itemErr;
    });

    test.afterAll(async () => {
        // Clean up: delete claim items, claim, and user
        if (claimId) {
            await supabaseAdmin
                .from('claim_items')
                .delete()
                .eq('claim_id', claimId);
            await supabaseAdmin
                .from('claims')
                .delete()
                .eq('id', claimId);
        }
        if (testUser) await supabaseAdmin.auth.admin.deleteUser(testUser.id);
    });

    test('View claim detail page shows correct info', async ({ page }) => {
        await injectSession(page, testUser.email, password);

        await page.goto(`/claims/${claimId}`);
        await expect(page).toHaveURL(new RegExp(`/claims/${claimId}`));

        // Verify claim heading contains claim ID
        await expect(page.locator('h1')).toContainText('請款單 #');

        // Verify type badge
        await expect(page.locator('text=員工報銷')).toBeVisible();

        // Verify description
        await expect(page.locator('text=Detail Test Claim')).toBeVisible();

        // Verify status badge (should be draft)
        await expect(page.locator('[data-slot="badge"]').filter({ hasText: '草稿' }).first()).toBeVisible();

        // Verify line item details
        await expect(page.locator('text=Test line item')).toBeVisible();
    });

    test('Draft claim has submit and delete actions', async ({ page }) => {
        await injectSession(page, testUser.email, password);

        await page.goto(`/claims/${claimId}`);
        await expect(page.locator('button:has-text("提交審核")')).toBeVisible();
        await expect(page.locator('button:has-text("刪除")')).toBeVisible();
    });

    test('Delete draft claim redirects to list', async ({ page }) => {
        await injectSession(page, testUser.email, password);

        await page.goto(`/claims/${claimId}`);

        // Handle confirmation dialog before clicking delete
        page.on('dialog', (dialog) => dialog.accept());

        // Click delete
        await page.click('button:has-text("刪除")');

        // Should redirect to claims list
        await expect(page).toHaveURL(/\/claims$/, { timeout: 10000 });
    });
});
