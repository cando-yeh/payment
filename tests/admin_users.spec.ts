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

    test.beforeAll(async () => {
        // Create admin user
        const { data: a, error: e1 } = await supabaseAdmin.auth.admin.createUser({
            email: `admin_test_${ts}_1@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: `AdminUser_${ts}` },
        });
        if (e1) throw e1;
        adminUser = a.user;

        // Set admin flag
        await supabaseAdmin
            .from('profiles')
            .update({ is_admin: true })
            .eq('id', adminUser.id);

        // Create standard user
        const { data: s, error: e2 } = await supabaseAdmin.auth.admin.createUser({
            email: `admin_test_${ts}_2@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: standardUserName },
        });
        if (e2) throw e2;
        standardUser = s.user;
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
        });
        await expect(userRow).toBeVisible();

        const financeBtn = userRow.locator('button:has-text("設為財務")');
        await expect(financeBtn).toBeVisible();
        await financeBtn.click();

        // After toggling, the button should change to "取消財務"
        await expect(
            userRow.locator('button:has-text("取消財務")')
        ).toBeVisible({ timeout: 5000 });
    });
});
