import { test, expect } from '@playwright/test';
import { supabaseAdmin, injectSession } from './helpers';

test.describe('Claim Creation Flow', () => {
    let userStandard: any;
    const password = 'password123';

    test.beforeAll(async () => {
        // Create standard test user
        const email = `claim_test_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;
        const { data: u1, error: e1 } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: 'Claim Test User' }
        });
        if (e1) throw e1;
        userStandard = u1.user;
    });

    test.afterAll(async () => {
        if (userStandard) await supabaseAdmin.auth.admin.deleteUser(userStandard.id);
    });

    test('Create Employee Claim', async ({ page }) => {
        // 1. Login
        await injectSession(page, userStandard.email, password);

        // 2. Go to Claims List
        await page.goto('/claims');
        await expect(page).toHaveURL(/\/claims/);
        await expect(page.locator('h1')).toContainText('我的請款單');

        // 3. Click Create
        await page.click('a[href="/claims/new"]');
        await expect(page).toHaveURL(/\/claims\/new/);
        await expect(page.locator('text=建立新請款單')).toBeVisible();

        // 4. Select Employee Type
        await page.click('text=員工費用報銷');

        // 5. Fill Form
        // Check header
        await expect(page.locator('h1')).toContainText('員工費用報銷');

        // Description
        await page.fill('input[name="description"]', 'Test Employee Claim 001');

        // Line Item 1
        // Default has 1 item.
        const dateInput = page.locator('input[type="date"]').first();
        await dateInput.fill(new Date().toISOString().split('T')[0]);

        const catSelect = page.locator('select').first(); // Category
        await catSelect.selectOption({ value: 'travel' }); // Assuming 'travel' exists

        const descInput = page.locator('input[placeholder="項目說明"]').first();
        await descInput.fill('Taxi to Client');

        const amountInput = page.locator('input[type="number"]').first();
        await amountInput.fill('500');

        // 6. Save Draft
        await page.click('button:has-text("儲存草稿")');

        // 7. Verify Redirect
        await expect(page).toHaveURL(/\/claims\/[A-Za-z0-9]+/);

        // 8. Verify Detail Page
        await expect(page.locator('h1')).toContainText('請款單 #'); // ID
        await expect(page.locator('text=員工報銷')).toBeVisible(); // Type Badge
        await expect(page.locator('text=Test Employee Claim 001')).toBeVisible(); // Description
        await expect(page.getByText('總計: $')).toBeVisible(); // Amount total visible

        // 9. Verify Action Buttons (Draft state)
        await expect(page.locator('button:has-text("提交審核")')).toBeVisible();
        await expect(page.locator('button:has-text("刪除")')).toBeVisible();

        // 10. Verify Attachment Button exists
        await expect(page.locator('button:has(.lucide-upload)')).toBeVisible();
    });
});
