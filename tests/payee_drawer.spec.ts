import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import {
    supabaseAdmin,
    injectSession,
    supabaseUrl,
    supabaseAnonKey,
    authSignInWithRetry
} from './helpers';

test.describe('Payee Drawer Functionality', () => {
    // Run tests serially to avoid interference
    test.describe.configure({ mode: 'serial' });

    let userStandard: any;
    let userFinance: any;
    const password = 'password123';
    let testPayeeId: string;
    let testPayeeName: string;
    let revealPayeeId: string | null = null;
    let revealPayeeName: string | null = null;
    async function openPayeeEditDrawer(page: any, row: any) {
        const drawer = page.locator('form[action*="updatePayeeRequest"]').first();
        for (let i = 0; i < 4; i++) {
            const firstCell = row.locator('td').first();
            if (await firstCell.isVisible().catch(() => false)) {
                await firstCell.click({ force: true });
            } else {
                await row.click({ force: true });
            }
            if (await drawer.isVisible({ timeout: 1200 }).catch(() => false)) {
                return drawer;
            }
            await page.waitForTimeout(200);
        }
        throw new Error('Payee edit drawer did not open after retries');
    }

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

        // 4. Create a deterministic reveal candidate (submit + approve) to avoid shared-data flakiness.
        const revealName = `Drawer Reveal Payee ${timestamp}`;

        const standardClient = createClient(supabaseUrl, supabaseAnonKey);
        const financeClient = createClient(supabaseUrl, supabaseAnonKey);
        await authSignInWithRetry(standardClient, userStandard.email, password);
        await authSignInWithRetry(financeClient, userFinance.email, password);

        const { data: requestId, error: submitError } = await standardClient.rpc('submit_payee_change_request', {
            _change_type: 'create',
            _payee_id: null,
            _proposed_data: {
                name: revealName,
                type: 'vendor',
                bank_code: '004',
                service_description: 'Reveal setup'
            },
            _proposed_tax_id: '87654321',
            _proposed_bank_account: '1234512345',
            _reason: 'E2E reveal setup',
            _proposed_attachments: {}
        });
        if (submitError) throw submitError;

        const { error: approveError } = await financeClient.rpc('approve_payee_change_request', {
            _request_id: requestId
        });
        if (approveError) throw approveError;

        const { data: createdRevealPayee, error: createdRevealPayeeError } = await supabaseAdmin
            .from('payees')
            .select('id, name')
            .eq('name', revealName)
            .eq('status', 'available')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (createdRevealPayeeError) throw createdRevealPayeeError;
        revealPayeeId = createdRevealPayee.id;
        revealPayeeName = createdRevealPayee.name;
    });

    test.afterAll(async () => {
        // Cleanup
        if (userStandard) await supabaseAdmin.auth.admin.deleteUser(userStandard.id);
        if (userFinance) await supabaseAdmin.auth.admin.deleteUser(userFinance.id);
        if (testPayeeId) {
            await supabaseAdmin.from('payee_change_requests').delete().eq('payee_id', testPayeeId);
            await supabaseAdmin.from('payees').delete().eq('id', testPayeeId);
        }
        if (revealPayeeId && revealPayeeName?.startsWith('Drawer Reveal Payee ')) {
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
        const drawer = await openPayeeEditDrawer(page, row);
        await expect(drawer).toBeVisible();
        await expect(drawer.locator('input[name="name"]')).toHaveValue(testPayeeName);

        // Check if sensitive bank account is MASKED in value
        const bankInput = drawer.locator('input#bank_account');
        await expect(bankInput).toHaveAttribute('type', 'text');
        await expect(bankInput).toHaveValue(/[*•]/);
    });

    test('Standard User can EDIT payee details via Drawer and Submit Request', async ({ page }) => {
        await injectSession(page, userStandard.email, password);
        await page.goto('/payees');

        // Open Drawer
        const editRow = page.getByTestId(`payee-row-${testPayeeId}`);
        await expect(editRow).toBeVisible();
        const drawer = await openPayeeEditDrawer(page, editRow);
        await expect(drawer).toBeVisible();

        await drawer.getByRole('button', { name: '編輯收款人資訊' }).click();

        // Modify a field
        const newService = 'E2E Service ' + Date.now();
        await drawer.locator('input[name="identity_no"]').fill('12345678');
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
        expect(revealPayeeId).toBeTruthy();

        await injectSession(page, userFinance.email, password);
        await page.goto('/payees');

        // Open Drawer
        const financeRow = page.getByTestId(`payee-row-${revealPayeeId!}`);
        await expect(financeRow).toBeVisible();
        const drawer = await openPayeeEditDrawer(page, financeRow);

        const bankInput = drawer.locator('input#bank_account');
        const revealBtn = drawer.locator('div:has(> input#bank_account) button').first();

        // Initial state
        await expect(bankInput).toHaveAttribute('type', 'text');
        const beforeValue = await bankInput.inputValue();

        // Click reveal
        await revealBtn.click();

        await expect
            .poll(async () => await bankInput.inputValue(), { timeout: 5000 })
            .not.toBe(beforeValue);
        await expect
            .poll(async () => await bankInput.inputValue(), { timeout: 5000 })
            .not.toMatch(/[*•]/);
    });

    test('Standard User can WITHDRAW pending request from list action', async ({ page }) => {
        await injectSession(page, userStandard.email, password);
        await page.goto('/payees');
        await expect(page.getByRole('heading', { name: '收款人管理' })).toBeVisible({ timeout: 15000 });

        // 1. Create a new pending request via New Payee Page
        const newPayeeName = 'Pending Drawer Test ' + Date.now();
        await page.goto('/payees/new');
        await expect(page).toHaveURL(/\/payees\/new/);
        await expect(page.getByRole('heading', { name: '新增收款人' })).toBeVisible();

        // Fill form on the new page
        await page.locator('input[name="name"]').fill(newPayeeName);
        await page.locator('input[name="identity_no"]').fill('11223344');

        // Select Bank
        const bankCombobox = page.locator('input#bank_code').first();
        await bankCombobox.click();
        await page.getByRole('button', { name: /004.*臺灣銀行/ }).click();

        await page.locator('input[name="bank_account"]').fill('1234567890');
        await page.locator('input[name="service_description"]').fill('Test Service');

        // Submit
        await page.getByRole('button', { name: '提交申請' }).click();

        // Expect redirect back to list and success message
        await expect(page).toHaveURL(/\/payees/);

        // 2. Find the pending row
        const row = page.getByRole('row', { name: newPayeeName }).first();
        await expect(row).toBeVisible();
        await expect(row).toContainText('待審核 (新增)');

        // 3. Withdraw from row action icon
        const withdrawBtn = row.locator('button[title="撤銷申請"]');
        await expect(withdrawBtn).toBeVisible();
        await withdrawBtn.click();

        // Confirm dialog
        await expect(page.getByRole('heading', { name: '確認撤銷申請' })).toBeVisible();
        await page.getByTestId('system-confirm-submit').click();

        // 4. Verify success
        await expect(page.getByText('申請已撤銷')).toBeVisible();
        await expect(page.getByRole('row', { name: newPayeeName })).not.toBeVisible();
    });
});
