import { test, expect } from '@playwright/test';
import { supabaseAdmin, injectSession } from './helpers';

test.describe('Approval Flow E2E', () => {
    let applicant: any;
    let manager: any;
    let finance: any;
    const password = 'password123';
    const ts = Date.now();
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    async function waitForProfile(userId: string) {
        for (let i = 0; i < 20; i++) {
            const { data } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('id', userId)
                .maybeSingle();
            if (data?.id) return;
            await sleep(200);
        }
        throw new Error(`Profile not ready for user: ${userId}`);
    }

    async function waitForProfileFields(
        userId: string,
        expected: { is_finance?: boolean; approver_id?: string }
    ) {
        for (let i = 0; i < 20; i++) {
            const { data } = await supabaseAdmin
                .from('profiles')
                .select('is_finance, approver_id')
                .eq('id', userId)
                .maybeSingle();
            if (
                data &&
                (expected.is_finance === undefined || data.is_finance === expected.is_finance) &&
                (expected.approver_id === undefined || data.approver_id === expected.approver_id)
            ) {
                return;
            }
            await sleep(200);
        }
        throw new Error(`Profile fields not updated for user: ${userId}`);
    }

    test.beforeAll(async () => {
        // 1. Create Manager
        const { data: m } = await supabaseAdmin.auth.admin.createUser({
            email: `manager_${ts}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: `Manager_${ts}` }
        });
        manager = m.user;

        // 2. Create Finance
        const { data: f } = await supabaseAdmin.auth.admin.createUser({
            email: `finance_${ts}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: `Finance_${ts}` }
        });
        finance = f.user;
        await waitForProfile(finance.id);
        await supabaseAdmin.from('profiles').update({ is_finance: true }).eq('id', finance.id);
        await waitForProfileFields(finance.id, { is_finance: true });

        // 3. Create Applicant
        const { data: a } = await supabaseAdmin.auth.admin.createUser({
            email: `applicant_${ts}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: `Applicant_${ts}` }
        });
        applicant = a.user;
        await waitForProfile(applicant.id);
        await supabaseAdmin.from('profiles').update({ approver_id: manager.id }).eq('id', applicant.id);
        await waitForProfileFields(applicant.id, { approver_id: manager.id });
    });

    test.afterAll(async () => {
        if (applicant) await supabaseAdmin.auth.admin.deleteUser(applicant.id);
        if (manager) await supabaseAdmin.auth.admin.deleteUser(manager.id);
        if (finance) await supabaseAdmin.auth.admin.deleteUser(finance.id);
    });

    test('Full Approval Flow: Applicant can create and open claim detail', async ({ page }) => {
        // --- Step 1: Applicant Creates and Submits Claim ---
        await injectSession(page, applicant.email, password);

        // Create a claim directly in DB to speed up test (or use UI)
        const claimId = `T${Math.floor(Math.random() * 9000000) + 1000000}`;
        await supabaseAdmin.from('claims').insert({
            id: claimId,
            applicant_id: applicant.id,
            description: '測試審核流程單據',
            total_amount: 1000,
            status: 'draft',
            claim_type: 'employee'
        });

        // At least one item is required for submission
        await supabaseAdmin.from('claim_items').insert({
            claim_id: claimId,
            item_index: 0,
            category: '交通費',
            amount: 1000,
            description: '計程車',
            date_start: new Date().toISOString().split('T')[0]
        });

        await page.goto(`/claims/${claimId}`);
        await expect(page.locator('text=提交審核')).toBeVisible();
        await page.evaluate(() => {
            // avoid native confirm flakiness in CI/headless
            window.confirm = () => true;
        });
        await page.click('text=提交審核');

        await expect(page.locator(`text=請款單 #${claimId}`)).toBeVisible();
    });

    test('Rejection Flow: Manager can open pending_manager claim and see reject action', async ({ page }) => {
        // --- Setup: Another Claim ---
        const claimId = `R${Math.floor(Math.random() * 9000000) + 1000000}`;
        await supabaseAdmin.from('claims').insert({
            id: claimId,
            applicant_id: applicant.id,
            description: '待駁回單據',
            total_amount: 500,
            status: 'pending_manager',
            claim_type: 'employee'
        });
        await supabaseAdmin.from('claim_items').insert({
            claim_id: claimId,
            item_index: 0,
            category: '文具',
            amount: 500,
            description: '筆',
            date_start: new Date().toISOString().split('T')[0]
        });

        // --- Manager can view and operate ---
        await injectSession(page, manager.email, password);
        await page.goto(`/claims/${claimId}`);
        await expect(page.locator(`text=請款單 #${claimId}`)).toBeVisible();
        await expect(page.locator('button:has-text("駁回")')).toBeVisible();
    });
});
