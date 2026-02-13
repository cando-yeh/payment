import { test, expect } from '@playwright/test';
import {
    supabaseAdmin,
    injectSession
} from './helpers';

test.describe('Payee Drawer Functionality', () => {
    // Run tests serially to avoid interference
    test.describe.configure({ mode: 'serial' });

    let userStandard: any;
    let userFinance: any;
    const password = 'password123';
    let testPayeeId: string;
    let testPayeeName: string;
    let revealPayeeId: string;
    let revealPayeeName: string;

    test.beforeAll(async () => {
        const timestamp = Date.now();
        testPayeeName = 'Drawer Test Payee ' + timestamp;

        // 1. Create Standard User
        const stdEmail = `std_drawer_${timestamp}@example.com`;
        const { data: u1, error: e1 } = await supabaseAdmin.auth.admin.createUser({
            email: stdEmail,
            password,
            email_confirm: true,
            user_metadata: { full_name: 'Std Drawer User' }
        });
        if (e1) throw e1;
        userStandard = u1.user;

        // 2. Create Finance User
        const finEmail = `fin_drawer_${timestamp}@example.com`;
        const { data: u2, error: e2 } = await supabaseAdmin.auth.admin.createUser({
            email: finEmail,
            password,
            email_confirm: true,
            user_metadata: { full_name: 'Fin Drawer User' }
        });
        if (e2) throw e2;
        userFinance = u2.user;
        await supabaseAdmin.from('profiles').update({ is_finance: true }).eq('id', userFinance.id);

        // 3. Create test payees directly
        const { data: p, error: pe } = await supabaseAdmin.from('payees').insert({
            name: testPayeeName,
            type: 'vendor',
            bank: '004',
            status: 'available'
        }).select('id').single();
        if (pe) throw pe;
        testPayeeId = p.id;

        // 4. Create reveal payee
        revealPayeeName = 'Drawer Reveal Payee ' + timestamp;
        const { data: rp, error: rpe } = await supabaseAdmin.from('payees').insert({
            name: revealPayeeName,
            type: 'vendor',
            bank: '004',
            status: 'available'
        }).select('id').single();
        if (rpe) throw rpe;
        revealPayeeId = rp.id;
    });

    test.afterAll(async () => {
        // Cleanup
        if (userStandard) await supabaseAdmin.auth.admin.deleteUser(userStandard.id);
        if (userFinance) await supabaseAdmin.auth.admin.deleteUser(userFinance.id);
        if (testPayeeId) {
            await supabaseAdmin.from('payee_change_requests').delete().eq('payee_id', testPayeeId);
            await supabaseAdmin.from('payees').delete().eq('id', testPayeeId);
        }
        if (revealPayeeId) {
            await supabaseAdmin.from('payee_change_requests').delete().eq('payee_id', revealPayeeId);
            await supabaseAdmin.from('payees').delete().eq('id', revealPayeeId);
        }
    });

    test('Standard User can VIEW payee details in Drawer', async ({ page }) => {
        await injectSession(page, userStandard.email, password);
        await page.goto('/payees');

        // Locate the row and click it
        const row = page.getByTestId(`payee-row-${testPayeeId}`);
        await expect(row).toBeVisible();
        await row.click();

        // Check availability of Sheet form
        const drawer = page.locator('form[action*="updatePayeeRequest"]').first();
        await expect(drawer).toBeVisible();
        await expect(page.getByRole('heading', { name: testPayeeName })).toBeVisible();

        // Check if sensitive bank account is MASKED in placeholder
        const bankInput = drawer.locator('input[name="bank_account"]');
        await expect(bankInput).toHaveAttribute('type', 'password');
        await expect(bankInput).toHaveAttribute('placeholder', /••••••|點擊解密/);
    });

    test('Standard User can EDIT payee details via Drawer and Submit Request', async ({ page }) => {
        await injectSession(page, userStandard.email, password);
        await page.goto('/payees');

        // Open Drawer
        const editRow = page.getByTestId(`payee-row-${testPayeeId}`);
        await expect(editRow).toBeVisible();
        await editRow.click();
        const drawer = page.locator('form[action*="updatePayeeRequest"]').first();
        if (!(await drawer.isVisible().catch(() => false))) {
            await editRow.click();
        }
        await expect(drawer).toBeVisible();

        // Modify a field
        const newService = 'E2E Service ' + Date.now();
        await drawer.locator('input[name="tax_id"]').fill('12345678');
        await drawer.locator('input[name="service_description"]').fill(newService);
        await drawer.locator('input[name="bank_account"]').fill('1234567890');
        await drawer.locator('textarea[name="reason"]').fill('E2E Drawer Update Test');

        // Submit
        await drawer.locator('button[type="submit"]').click();

        // Verify Pending Request is visible in the list
        // It might be a new row with 'Pending' status
        const pendingRow = page.locator('tbody tr').filter({ hasText: '更新' }).filter({ hasText: testPayeeName });
        await expect(pendingRow.first()).toBeVisible({ timeout: 15000 });
    });

    test('Finance User can REVEAL bank account in Drawer', async ({ page }) => {
        await injectSession(page, userFinance.email, password);
        await page.goto('/payees');

        // Open Drawer
        const financeRow = page.getByTestId(`payee-row-${revealPayeeId}`);
        await expect(financeRow).toBeVisible();
        await financeRow.click();
        const drawer = page.locator('form[action*="updatePayeeRequest"]').first();
        if (!(await drawer.isVisible().catch(() => false))) {
            await financeRow.click();
        }

        const bankInput = drawer.locator('input[name="bank_account"]');
        const revealBtn = drawer.locator('div:has(> input#bank_account) button').first();

        // Initial state
        await expect(bankInput).toHaveAttribute('type', 'password');

        // Click reveal
        // Note: The UI might use a specific button class or ID.
        // Based on typical `lucide-svelte` usage, it might be the eye icon button.
        // Let's try locating by the eye icon SVG if specific selector fails, but cleaner to assume it's near the input.
        // In PayeeSheet.svelte, it's a Button with variant="ghost" size="icon" next to the input.
        await revealBtn.click();

        // Expect value to be revealed (type="text")
        await expect(bankInput).toHaveAttribute('type', 'text');

        await expect(bankInput).toBeVisible();
    });
});
