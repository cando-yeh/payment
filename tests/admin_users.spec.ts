/**
 * Admin 使用者管理頁面端對端測試
 *
 * 職責：
 * 1. 驗證非管理員無法存取 /admin/users。
 * 2. 驗證管理員可看到使用者列表。
 * 3. 驗證管理員可切換使用者的財務權限。
 */
import { test, expect } from '@playwright/test';
import { supabaseAdmin, injectSession } from './helpers';

test.describe('Admin Users Page', () => {
    let adminUser: any;
    let standardUser: any;
    const password = 'password123';
    // Use unique names with timestamp to avoid collisions with leftover test data
    const ts = Date.now();
    const standardUserName = `StdUser_${ts}`;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    async function createUserWithRetry(emailPrefix: string, fullName: string) {
        let lastError: any = null;
        for (let i = 0; i < 3; i++) {
            const email = `${emailPrefix}_${Date.now()}_${i}@example.com`;
            const { data, error } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name: fullName },
            });
            if (!error) return data.user;
            lastError = error;
            await sleep(500);
        }
        throw lastError;
    }

    test.beforeAll(async () => {
        // Create admin user
        adminUser = await createUserWithRetry(`admin_test_${ts}_1`, `AdminUser_${ts}`);

        // Set admin flag
        await supabaseAdmin
            .from('profiles')
            .update({ is_admin: true })
            .eq('id', adminUser.id);

        // Create standard user
        standardUser = await createUserWithRetry(`admin_test_${ts}_2`, standardUserName);
    });

    test.afterAll(async () => {
        if (adminUser) await supabaseAdmin.auth.admin.deleteUser(adminUser.id);
        if (standardUser) await supabaseAdmin.auth.admin.deleteUser(standardUser.id);
    });

    test('Non-admin user is redirected away from /admin/users', async ({ page }) => {
        await injectSession(page, standardUser.email, password);

        await page.goto('/admin/users');

        // Should NOT stay on /admin/users — redirected to / by the server load function
        await expect(page).not.toHaveURL(/\/admin\/users/);
    });

    test('Admin user can view user management page', async ({ page }) => {
        await injectSession(page, adminUser.email, password);

        await page.goto('/admin/users');
        await expect(page).toHaveURL(/\/admin\/users/);

        // Verify page heading
        await expect(page.locator('h1')).toContainText('使用者管理');

        // Verify user table is rendered
        await expect(page.locator('table')).toBeVisible();

        // Verify the page shows user count badge
        await expect(page.locator('text=位使用者')).toBeVisible();
    });

    test('Admin can toggle finance permission', async ({ page }) => {
        await injectSession(page, adminUser.email, password);

        await page.goto('/admin/users');

        // Find the row for the standard user using the unique timestamped name
        const userRow = page.locator('tr', {
            has: page.locator(`text=${standardUserName}`),
        }).first();
        await expect(userRow).toBeVisible();

        const result = await page.evaluate(async (targetUserId) => {
            const formData = new FormData();
            formData.append('userId', targetUserId);
            formData.append('field', 'is_finance');
            formData.append('value', 'true');
            const response = await fetch('?/updateUserPermissions', {
                method: 'POST',
                headers: { 'x-sveltekit-action': 'true' },
                body: formData
            });
            return { ok: response.ok, text: await response.text() };
        }, standardUser.id);

        expect(result.ok).toBeTruthy();
        expect(result.text).toContain('"type":"success"');

        const { data: profileAfterToggle, error } = await supabaseAdmin
            .from('profiles')
            .select('is_finance')
            .eq('id', standardUser.id)
            .single();
        expect(error).toBeNull();
        expect(profileAfterToggle?.is_finance).toBe(true);
    });

    test('Admin can update user profile via sheet and changes apply immediately', async ({ page }) => {
        // Reset baseline for deterministic assertions
        const { error: resetError } = await supabaseAdmin
            .from('profiles')
            .update({ is_finance: false })
            .eq('id', standardUser.id);
        expect(resetError).toBeNull();

        await injectSession(page, adminUser.email, password);
        await page.goto('/admin/users');

        const userRow = page.locator('tr', {
            has: page.locator(`text=${standardUserName}`),
        }).first();
        await expect(userRow).toBeVisible();
        await expect(userRow.getByText('財務')).toHaveCount(0);

        // Open sheet and toggle finance role
        await userRow.click();
        const sheet = page.getByRole('dialog');
        await expect(sheet).toBeVisible();
        await sheet.getByRole('button', { name: '編輯個人資訊' }).click();
        await sheet.getByRole('button', { name: '財務' }).click();
        await sheet.getByRole('button', { name: '確認儲存變更' }).click();

        await expect(page.locator('text=使用者資料已更新')).toBeVisible();
        await expect(sheet).toHaveCount(0);

        // No manual refresh: table should reflect updated role immediately
        await expect(
            page.locator('tr', {
                has: page.locator(`text=${standardUserName}`),
            }).first().getByText('財務')
        ).toBeVisible();

        const { data: profileAfterSave, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('is_finance')
            .eq('id', standardUser.id)
            .single();
        expect(profileError).toBeNull();
        expect(profileAfterSave?.is_finance).toBe(true);
    });

    test('Admin can deactivate and reactivate user', async ({ page }) => {
        await injectSession(page, adminUser.email, password);
        await page.goto('/admin/users');

        const userRow = page.locator('tr', {
            has: page.locator(`text=${standardUserName}`),
        }).first();
        await expect(userRow).toBeVisible();

        await userRow.locator('button[title="停用帳號"]').click();
        await page
            .getByRole('dialog')
            .filter({ hasText: '確認停用帳號' })
            .getByRole('button', { name: '停用帳號', exact: true })
            .click();
        await expect(page.locator('text=使用者已停用')).toBeVisible();

        await page.getByRole('tab', { name: /已停用/ }).click();
        const inactiveRow = page.locator('tr', {
            has: page.locator(`text=${standardUserName}`),
        }).first();
        await expect(inactiveRow).toBeVisible();

        await inactiveRow.locator('button[title="重新啟用"]').click();
        await page
            .getByRole('dialog')
            .filter({ hasText: '確認重新啟用' })
            .getByRole('button', { name: '重新啟用', exact: true })
            .click();
        await expect(page.locator('text=使用者已重新啟用')).toBeVisible();
    });

    test('Permanent delete is blocked when user has historical claims', async ({ page }) => {
        const claimId = `AD${Math.random().toString(36).slice(2, 8).toUpperCase()}`.slice(0, 8);
        const { error: insertError } = await supabaseAdmin.from('claims').insert({
            id: claimId,
            applicant_id: standardUser.id,
            claim_type: 'employee',
            description: 'admin delete guard',
            total_amount: 100,
            status: 'paid'
        });
        if (insertError) throw insertError;

        await injectSession(page, adminUser.email, password);
        await page.goto('/admin/users');

        const userRow = page.locator('tr', {
            has: page.locator(`text=${standardUserName}`),
        }).first();
        await expect(userRow).toBeVisible();

        await userRow.locator('button[title*="永久刪除"]').click();
        await page
            .getByRole('dialog')
            .filter({ hasText: '確認永久刪除' })
            .getByRole('button', { name: '永久刪除', exact: true })
            .click();
        await expect(page.locator('text=僅可停用以保留稽核軌跡')).toBeVisible();

        await supabaseAdmin.from('claims').delete().eq('id', claimId);
    });
});
