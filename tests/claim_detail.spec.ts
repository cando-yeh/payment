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

    test('Draft claim opens inline edit mode on detail route', async ({ page }) => {
        await injectSession(page, testUser.email, password);

        await page.goto(`/claims/${claimId}`);
        await expect(page).toHaveURL(new RegExp(`/claims/${claimId}`));

        // Verify edit page heading contains edit tag
        await expect(page.locator('h1')).toContainText('(編輯)');

        // Verify line item remains editable
        await expect(page.locator('input[placeholder="項目說明"]').first()).toBeVisible();
    });

    test('Draft edit page has save action', async ({ page }) => {
        await injectSession(page, testUser.email, password);

        await page.goto(`/claims/${claimId}`);
        await expect(page.getByRole('button', { name: '儲存變更' })).toBeVisible();
    });

    test('Draft edit page can submit save action', async ({ page }) => {
        await injectSession(page, testUser.email, password);

        await page.goto(`/claims/${claimId}`);
        await page.fill('input[placeholder="項目說明"]', 'Updated from edit page');
        await page.getByRole('button', { name: '儲存變更' }).click();
        await expect(page).toHaveURL(new RegExp(`/claims/${claimId}`));
        await expect(page.getByRole('button', { name: '儲存變更' })).toBeVisible();
    });
});
