import { expect, test } from '@playwright/test';
import { injectSession, postFormAction, supabaseAdmin } from './helpers';

const password = 'password123';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForProfile(userId: string) {
    for (let i = 0; i < 20; i++) {
        const { data } = await supabaseAdmin.from('profiles').select('id').eq('id', userId).maybeSingle();
        if (data?.id) return;
        await sleep(200);
    }
    throw new Error(`Profile not ready for user ${userId}`);
}

function cid(prefix: string) {
    return `${prefix}${Math.random().toString(36).slice(2, 8).toUpperCase()}`.slice(0, 8);
}

test.describe.serial('Payment Guards', () => {
    let finance: any;
    let applicantA: any;
    let applicantB: any;
    let outsider: any;

    test.beforeAll(async () => {
        const ts = Date.now();
        const { data: f } = await supabaseAdmin.auth.admin.createUser({
            email: `pay_guard_fin_${ts}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: `Pay Guard Finance ${ts}` }
        });
        finance = f.user;
        await waitForProfile(finance.id);
        await supabaseAdmin.from('profiles').update({ is_finance: true }).eq('id', finance.id);

        const { data: a } = await supabaseAdmin.auth.admin.createUser({
            email: `pay_guard_a_${ts}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: `Pay Guard A ${ts}` }
        });
        applicantA = a.user;
        await waitForProfile(applicantA.id);
        await supabaseAdmin.from('profiles').update({ full_name: `Pay Guard A ${ts}` }).eq('id', applicantA.id);

        const { data: b } = await supabaseAdmin.auth.admin.createUser({
            email: `pay_guard_b_${ts}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: `Pay Guard B ${ts}` }
        });
        applicantB = b.user;
        await waitForProfile(applicantB.id);
        await supabaseAdmin.from('profiles').update({ full_name: `Pay Guard B ${ts}` }).eq('id', applicantB.id);

        const { data: o } = await supabaseAdmin.auth.admin.createUser({
            email: `pay_guard_out_${ts}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: `Pay Guard Outsider ${ts}` }
        });
        outsider = o.user;
        await waitForProfile(outsider.id);
    });

    test.afterAll(async () => {
        for (const u of [finance, applicantA, applicantB, outsider]) {
            if (u) await supabaseAdmin.auth.admin.deleteUser(u.id);
        }
    });

    test('batchPay rejects mixed payees and invalid statuses', async ({ page }) => {
        const mixed1 = cid('M1');
        const mixed2 = cid('M2');
        const badStatus = cid('MS');

        await supabaseAdmin.from('claims').insert([
            {
                id: mixed1,
                applicant_id: applicantA.id,
                claim_type: 'employee',
                description: 'mixed payee 1',
                total_amount: 100,
                status: 'pending_payment'
            },
            {
                id: mixed2,
                applicant_id: applicantB.id,
                claim_type: 'employee',
                description: 'mixed payee 2',
                total_amount: 200,
                status: 'pending_payment'
            },
            {
                id: badStatus,
                applicant_id: applicantA.id,
                claim_type: 'employee',
                description: 'bad status',
                total_amount: 300,
                status: 'pending_finance'
            }
        ]);

        await injectSession(page, finance.email, password);
        await page.goto('/approval');

        const mixedBody = await postFormAction(page, '/approval?/batchPay', { claimIds: [mixed1, mixed2] });
        expect(mixedBody).toContain('批次付款僅限同一收款人');

        const badStatusBody = await postFormAction(page, '/approval?/batchPay', { claimIds: [mixed1, badStatus] });
        expect(badStatusBody).toContain('部分選取單據狀態非待撥款');
    });

    test('cancelPayment enforces role and blocks second cancel', async ({ page }) => {
        const claimId = cid('PC');
        await supabaseAdmin.from('claims').insert({
            id: claimId,
            applicant_id: applicantA.id,
            claim_type: 'employee',
            description: 'cancel guard claim',
            total_amount: 500,
            status: 'paid'
        });

        const { data: payment } = await supabaseAdmin.from('payments').insert({
            payee_id: applicantA.id,
            payee_name: 'Pay Guard A',
            total_amount: 500,
            status: 'completed',
            paid_by: finance.id,
            paid_at: new Date().toISOString()
        }).select('id').single();
        expect(payment?.id).toBeTruthy();

        await supabaseAdmin.from('claims').update({
            payment_id: payment!.id,
            status: 'paid'
        }).eq('id', claimId);

        await injectSession(page, outsider.email, password);
        await page.goto(`/payments/${payment!.id}`);
        const deniedBody = await postFormAction(page, `/payments/${payment!.id}?/cancelPayment`);
        expect(deniedBody).toContain('權限不足');

        await injectSession(page, finance.email, password);
        await page.goto(`/payments/${payment!.id}`);
        const firstBody = await postFormAction(page, `/payments/${payment!.id}?/cancelPayment`);
        expect(firstBody).not.toContain('付款單狀態更新失敗');

        const secondBody = await postFormAction(page, `/payments/${payment!.id}?/cancelPayment`);
        expect(secondBody).toContain('此付款單已沖帳');
    });
});
