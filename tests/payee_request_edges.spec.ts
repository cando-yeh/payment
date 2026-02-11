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

test.describe.serial('Payee Request Edge Cases', () => {
    let requester: any;
    let finance: any;
    let otherUser: any;
    let payeeId: string;

    test.beforeAll(async () => {
        const ts = Date.now();
        const { data: r } = await supabaseAdmin.auth.admin.createUser({
            email: `payee_edge_req_${ts}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: `Payee Req ${ts}` }
        });
        requester = r.user;
        await waitForProfile(requester.id);

        const { data: f } = await supabaseAdmin.auth.admin.createUser({
            email: `payee_edge_fin_${ts}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: `Payee Fin ${ts}` }
        });
        finance = f.user;
        await waitForProfile(finance.id);
        await supabaseAdmin.from('profiles').update({ is_finance: true }).eq('id', finance.id);

        const { data: o } = await supabaseAdmin.auth.admin.createUser({
            email: `payee_edge_other_${ts}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: `Payee Other ${ts}` }
        });
        otherUser = o.user;
        await waitForProfile(otherUser.id);

        const { data: payee } = await supabaseAdmin.from('payees').insert({
            name: `Payee Edge ${ts}`,
            type: 'vendor',
            bank: '004',
            status: 'available'
        }).select('id').single();
        payeeId = payee!.id;
    });

    test.afterAll(async () => {
        if (payeeId) {
            await supabaseAdmin.from('payee_change_requests').delete().eq('payee_id', payeeId);
            await supabaseAdmin.from('payees').delete().eq('id', payeeId);
        }
        for (const u of [requester, finance, otherUser]) {
            if (u) await supabaseAdmin.auth.admin.deleteUser(u.id);
        }
    });

    test('finance can reject pending request', async ({ page }) => {
        await injectSession(page, requester.email, password);
        await page.goto('/payees');
        const submitBody = await postFormAction(page, '/payees?/submitDisableRequest', {
            payeeId,
            reason: 'reject flow'
        });
        expect(submitBody).toContain('停用申請已提交');

        const { data: pending } = await supabaseAdmin
            .from('payee_change_requests')
            .select('id')
            .eq('payee_id', payeeId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        expect(pending?.id).toBeTruthy();

        await injectSession(page, finance.email, password);
        await page.goto('/payees');
        const rejectBody = await postFormAction(page, '/payees?/rejectPayeeRequest', {
            requestId: pending!.id
        });
        expect(rejectBody).toContain('申請已駁回');

        const { data: updated } = await supabaseAdmin
            .from('payee_change_requests')
            .select('status')
            .eq('id', pending!.id)
            .single();
        expect(updated?.status).toBe('rejected');
    });

    test('requester can withdraw own pending request and others cannot', async ({ page }) => {
        await injectSession(page, requester.email, password);
        await page.goto('/payees');
        await postFormAction(page, '/payees?/submitDisableRequest', {
            payeeId,
            reason: 'withdraw flow'
        });

        const { data: pending } = await supabaseAdmin
            .from('payee_change_requests')
            .select('id, status')
            .eq('payee_id', payeeId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        expect(pending?.id).toBeTruthy();

        await injectSession(page, otherUser.email, password);
        await page.goto('/payees');
        const deniedBody = await postFormAction(page, '/payees?/withdrawRequest', { requestId: pending!.id });
        // With RLS, non-owner cannot see target request and receives not-found.
        expect(deniedBody).toContain('找不到此申請');

        await injectSession(page, requester.email, password);
        await page.goto('/payees');
        const okBody = await postFormAction(page, '/payees?/withdrawRequest', { requestId: pending!.id });
        expect(okBody).toContain('申請已撤銷');

        const { data: withdrawn } = await supabaseAdmin
            .from('payee_change_requests')
            .select('status')
            .eq('id', pending!.id)
            .single();
        expect(withdrawn?.status).toBe('withdrawn');
    });
});
