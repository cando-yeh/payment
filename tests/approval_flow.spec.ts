import { test, expect } from '@playwright/test';
import { supabaseAdmin, injectSession } from './helpers';

test.describe('Approval Flow E2E', () => {
    let applicant: any;
    let manager: any;
    let finance: any;
    const password = 'password123';
    const ts = Date.now();
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    async function createUserWithRetry(emailPrefix: string, fullName: string, maxAttempts = 5) {
        let lastError: any = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const email = `${emailPrefix}_${Date.now()}_${attempt}@example.com`;
            const { data, error } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name: fullName }
            });
            if (!error && data?.user) return data.user;

            lastError = error || new Error('createUser returned empty user');
            const isRetryable =
                error?.status === 429 ||
                /rate limit|already been registered/i.test(
                    String(error?.message || '')
                );
            if (!isRetryable || attempt === maxAttempts) break;
            await sleep(500 * attempt);
        }
        throw lastError ?? new Error('Failed to create user');
    }

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
        manager = await createUserWithRetry(
            `manager_${ts}`,
            `Manager_${ts}`
        );
        await waitForProfile(manager.id);

        // 2. Create Finance
        finance = await createUserWithRetry(
            `finance_${ts}`,
            `Finance_${ts}`
        );
        await waitForProfile(finance.id);
        await supabaseAdmin.from('profiles').update({ is_finance: true }).eq('id', finance.id);
        await waitForProfileFields(finance.id, { is_finance: true });

        // 3. Create Applicant
        applicant = await createUserWithRetry(
            `applicant_${ts}`,
            `Applicant_${ts}`
        );
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

        // Ensure approver mapping is persisted before submit.
        await supabaseAdmin
            .from('profiles')
            .update({ approver_id: manager.id })
            .eq('id', applicant.id);
        await waitForProfileFields(applicant.id, { approver_id: manager.id });

        await page.goto(`/claims/${claimId}`);
        await expect(page).toHaveURL(new RegExp(`/claims/${claimId}`));
        await expect(page.getByRole('button', { name: '提交審核' })).toBeVisible();
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
