import { test, expect } from '@playwright/test';
import { supabaseAdmin, injectSession, postFormActionDetailed } from './helpers';

test.describe.serial('Duplicate Invoice Check E2E', () => {
    let applicant: any;
    let approver: any;
    const password = 'password123';
    const ts = Date.now();
    const invoiceNumber = `INV-DUPE-${ts}`;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    async function waitForProfile(userId: string) {
        for (let i = 0; i < 20; i++) {
            const { data } = await supabaseAdmin.from('profiles').select('id').eq('id', userId).maybeSingle();
            if (data?.id) return;
            await sleep(200);
        }
        throw new Error(`Profile not ready for user: ${userId}`);
    }

    async function waitForApprover(userId: string, approverId: string) {
        for (let i = 0; i < 20; i++) {
            const { data } = await supabaseAdmin
                .from('profiles')
                .select('approver_id')
                .eq('id', userId)
                .maybeSingle();
            if (data?.approver_id === approverId) return;
            await sleep(200);
        }
        throw new Error(`Approver not ready for user: ${userId}`);
    }

    test.beforeAll(async () => {
        // Create Approver
        const { data: ap } = await supabaseAdmin.auth.admin.createUser({
            email: `approver_dupe_${ts}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: `Approver_Dupe_${ts}` }
        });
        approver = ap.user;
        await waitForProfile(approver.id);

        // Create Applicant
        const { data: a } = await supabaseAdmin.auth.admin.createUser({
            email: `applicant_dupe_${ts}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: `Applicant_Dupe_${ts}` }
        });
        applicant = a.user;
        await waitForProfile(applicant.id);

        // Set Approver for Applicant
        await supabaseAdmin
            .from('profiles')
            .update({ approver_id: approver.id })
            .eq('id', applicant.id);
        await waitForApprover(applicant.id, approver.id);
    });

    test.afterAll(async () => {
        if (applicant) await supabaseAdmin.auth.admin.deleteUser(applicant.id);
        if (approver) await supabaseAdmin.auth.admin.deleteUser(approver.id);
    });

    test('Submission: duplicate invoices are warned but do not block submit', async ({ page }) => {
        // 1. Create the FIRST claim with the invoice number
        const { data: claim1, error: error1 } = await supabaseAdmin.from('claims').insert([
            {
                applicant_id: applicant.id,
                description: 'Original Claim',
                total_amount: 1000,
                status: 'pending_manager', // Already submitted
                claim_type: 'employee',
                submitted_at: new Date().toISOString()
            }
        ]).select().single();
        expect(error1).toBeNull();

        await supabaseAdmin.from('claim_items').insert([
            {
                claim_id: claim1.id,
                item_index: 1,
                date_start: new Date().toISOString().slice(0, 10),
                amount: 1000,
                description: 'Original Item',
                invoice_number: invoiceNumber,
                category: '一般雜支'
            }
        ]);

        // 2. Create the SECOND claim (draft) with the same invoice number
        const { data: claim2, error: error2 } = await supabaseAdmin.from('claims').insert([
            {
                applicant_id: applicant.id,
                description: 'Duplicate Claim',
                total_amount: 1000,
                status: 'draft',
                claim_type: 'employee'
            }
        ]).select().single();
        expect(error2).toBeNull();

        await supabaseAdmin.from('claim_items').insert([
            {
                claim_id: claim2.id,
                item_index: 1,
                date_start: new Date().toISOString().slice(0, 10),
                amount: 1000,
                description: 'Duplicate Item',
                invoice_number: invoiceNumber,
                category: '一般雜支'
            }
        ]);

        // 3. Login as applicant and try to submit the second claim
        await injectSession(page, applicant.email, password);
        const submitRes = await postFormActionDetailed(page, `/claims/${claim2.id}?/submit`, {});
        expect([200, 303]).toContain(submitRes.status);

        await expect.poll(async () => {
            const { data } = await supabaseAdmin
                .from('claims')
                .select('status')
                .eq('id', claim2.id)
                .single();
            return data?.status;
        }).toBe('pending_manager');

        // 4. Verify success (duplicate no longer blocks submit)
        await page.goto('/claims?tab=processing');
        await expect(page.getByText(`#${claim2.id}`)).toBeVisible();

        // Double check DB
        const { data: updatedClaim } = await supabaseAdmin
            .from('claims')
            .select('status')
            .eq('id', claim2.id)
            .single();
        expect(updatedClaim?.status).toBe('pending_manager');
    });
});
