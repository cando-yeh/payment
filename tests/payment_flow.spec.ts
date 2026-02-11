import { test, expect } from '@playwright/test';
import { supabaseAdmin, injectSession } from './helpers';

test.describe.serial('Payment Module E2E', () => {
    let finance: any;
    let applicant: any;
    const password = 'password123';
    const ts = Date.now();
    let claim1Id = '';
    let claim2Id = '';
    let paymentId = '';
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    async function waitForProfile(userId: string) {
        for (let i = 0; i < 20; i++) {
            const { data } = await supabaseAdmin.from('profiles').select('id').eq('id', userId).maybeSingle();
            if (data?.id) return;
            await sleep(200);
        }
        throw new Error(`Profile not ready for user: ${userId}`);
    }

    function makeClaimId(prefix: string) {
        // claims.id is varchar(8), keep deterministic short IDs for E2E
        const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
        return `${prefix}${suffix}`.slice(0, 8);
    }

    async function waitForClaimsPaid(ids: string[]) {
        for (let i = 0; i < 30; i++) {
            const { data } = await supabaseAdmin
                .from('claims')
                .select('id, status, payment_id')
                .in('id', ids);
            if (data && data.length === ids.length) {
                const paid = data.every((c) => c.status === 'paid' && !!c.payment_id);
                const paymentIds = new Set(data.map((c) => c.payment_id).filter(Boolean));
                if (paid && paymentIds.size === 1) {
                    return { paymentId: Array.from(paymentIds)[0] as string };
                }
            }
            await sleep(200);
        }
        throw new Error(`Claims did not reach paid status: ${ids.join(', ')}`);
    }

    async function waitForPaymentCancelled(id: string) {
        for (let i = 0; i < 30; i++) {
            const { data } = await supabaseAdmin
                .from('payments')
                .select('status, cancelled_at')
                .eq('id', id)
                .maybeSingle();
            if (data?.status === 'cancelled') return data;
            await sleep(200);
        }
        throw new Error(`Payment did not become cancelled: ${id}`);
    }

    test.beforeAll(async () => {
        // Create Finance Role
        const { data: f } = await supabaseAdmin.auth.admin.createUser({
            email: `finance_pay_${ts}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: `Finance_Pay_${ts}` }
        });
        finance = f.user;
        await waitForProfile(finance.id);
        await supabaseAdmin
            .from('profiles')
            .update({ is_finance: true, full_name: `Finance_Pay_${ts}` })
            .eq('id', finance.id);

        // Create Applicant
        const { data: a } = await supabaseAdmin.auth.admin.createUser({
            email: `applicant_pay_${ts}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: `Applicant_Pay_${ts}` }
        });
        applicant = a.user;
        await waitForProfile(applicant.id);
        await supabaseAdmin
            .from('profiles')
            .update({ full_name: `Applicant_Pay_${ts}` })
            .eq('id', applicant.id);
    });

    test.afterAll(async () => {
        if (finance) await supabaseAdmin.auth.admin.deleteUser(finance.id);
        if (applicant) await supabaseAdmin.auth.admin.deleteUser(applicant.id);
    });

    test('Batch Payment Flow: Finance can pay multiple claims at once', async ({ page }) => {
        // 1. Prepare 2 claims in 'pending_payment' status
        claim1Id = makeClaimId('P1');
        claim2Id = makeClaimId('P2');

        const { error: insertError } = await supabaseAdmin.from('claims').insert([
            {
                id: claim1Id,
                applicant_id: applicant.id,
                description: 'Batch Pay Claim 1',
                total_amount: 1000,
                status: 'pending_payment',
                claim_type: 'employee'
            },
            {
                id: claim2Id,
                applicant_id: applicant.id,
                description: 'Batch Pay Claim 2',
                total_amount: 2000,
                status: 'pending_payment',
                claim_type: 'employee'
            }
        ]);
        expect(insertError).toBeNull();

        // 2. Finance login and go to Approval Center
        await injectSession(page, finance.email, password);
        await page.goto('/approval');

        // 3. Submit batch pay action with the same authenticated browser session
        const actionResult = await page.evaluate(
            async ({ id1, id2 }) => {
                const form = new FormData();
                form.append('claimIds', id1);
                form.append('claimIds', id2);

                const res = await fetch('/approval?/batchPay', {
                    method: 'POST',
                    body: form
                });

                return {
                    ok: res.ok,
                    status: res.status,
                    redirected: res.redirected,
                    url: res.url,
                    body: await res.text()
                };
            },
            { id1: claim1Id, id2: claim2Id }
        );
        expect(actionResult.ok).toBeTruthy();
        expect(actionResult.body).not.toContain('尚未登入');
        expect(actionResult.body).not.toContain('請至少選擇一筆單據');
        expect(actionResult.body).not.toContain('讀取請款單失敗');
        expect(actionResult.body).not.toContain('付款單建立失敗');
        expect(actionResult.body).not.toContain('請款單狀態更新失敗');

        // 4. Check DB for payment result (authoritative signal of success)
        const paidResult = await waitForClaimsPaid([claim1Id, claim2Id]);
        paymentId = paidResult.paymentId;

        const { data: payment, error: paymentError } = await supabaseAdmin
            .from('payments')
            .select('id, total_amount, status')
            .eq('id', paymentId)
            .single();
        expect(paymentError).toBeNull();

        expect(payment).toBeDefined();
        if (!payment) throw new Error('Payment not found after batch pay');
        expect(payment?.total_amount).toBe(3000);
        expect(payment?.status).toBe('completed');

        // Check claims status
        const { data: claims } = await supabaseAdmin
            .from('claims')
            .select('status, payment_id')
            .in('id', [claim1Id, claim2Id]);

        for (const c of (claims || [])) {
            expect(c.status).toBe('paid');
            expect(c.payment_id).toBe(payment?.id);
        }
    });

    test('Payment History and Reversal Flow', async ({ page }) => {
        // 1. Find the payment created in previous test
        if (!paymentId) throw new Error('Payment ID not set from previous test');

        await injectSession(page, finance.email, password);

        // 2. Go to Payment History
        await page.goto('/payments');
        await expect(page.locator(`text=${paymentId.split('-')[0]}`)).toBeVisible();

        // 3. Go to Detail
        await page.goto(`/payments/${paymentId}`);
        await expect(page.locator(`text=${paymentId}`)).toBeVisible();
        await expect(page.locator('text=已撥款')).toBeVisible();

        // 4. Submit reversal action with the same authenticated browser session
        const cancelResult = await page.evaluate(async ({ id }) => {
            const form = new FormData();
            const res = await fetch(`/payments/${id}?/cancelPayment`, {
                method: 'POST',
                body: form
            });
            return {
                ok: res.ok,
                status: res.status,
                body: await res.text()
            };
        }, { id: paymentId });
        expect(cancelResult.ok).toBeTruthy();
        expect(cancelResult.body).not.toContain('尚未登入');
        expect(cancelResult.body).not.toContain('找不到此付款單');
        expect(cancelResult.body).not.toContain('此付款單已沖帳');
        expect(cancelResult.body).not.toContain('付款單狀態更新失敗');
        expect(cancelResult.body).not.toContain('請款單狀態回滾失敗');

        // 5. Verify status change
        await waitForPaymentCancelled(paymentId);
        await page.reload();
        await expect(page.locator('text=已沖帳')).toBeVisible();

        // 6. Check claims status - should be back to 'pending_payment'
        const { data: updatedClaims } = await supabaseAdmin
            .from('claims')
            .select('status, payment_id')
            .in('id', [claim1Id, claim2Id]);

        expect(updatedClaims?.length).toBe(2);
        for (const claim of updatedClaims || []) {
            expect(claim.status).toBe('pending_payment');
            expect(claim.payment_id).toBeNull();
        }
    });
});
