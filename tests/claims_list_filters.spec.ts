import { expect, test } from '@playwright/test';
import { injectSession, supabaseAdmin } from './helpers';

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

test.describe.serial('Claims List Filters', () => {
    let user: any;
    const ids: Record<string, string> = {};

    test.beforeAll(async () => {
        const ts = Date.now();
        const { data: u } = await supabaseAdmin.auth.admin.createUser({
            email: `claims_filter_${ts}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: `Claims Filter ${ts}` }
        });
        user = u.user;
        await waitForProfile(user.id);

        ids.draft = cid('FD');
        ids.returned = cid('FR');
        ids.pendingManager = cid('FM');
        ids.pendingFinance = cid('FF');
        ids.pendingPayment = cid('FP');
        ids.paidPendingDoc = cid('FX');
        ids.pendingDocReview = cid('FV');
        ids.paid = cid('FA');
        ids.cancelled = cid('FC');

        const { error: insertError } = await supabaseAdmin.from('claims').insert([
            { id: ids.draft, applicant_id: user.id, claim_type: 'employee', description: 'filter draft', total_amount: 100, status: 'draft' },
            { id: ids.returned, applicant_id: user.id, claim_type: 'employee', description: 'filter returned', total_amount: 100, status: 'returned' },
            { id: ids.pendingManager, applicant_id: user.id, claim_type: 'employee', description: 'filter pending manager', total_amount: 100, status: 'pending_manager' },
            { id: ids.pendingFinance, applicant_id: user.id, claim_type: 'employee', description: 'filter pending finance', total_amount: 100, status: 'pending_finance' },
            { id: ids.pendingPayment, applicant_id: user.id, claim_type: 'employee', description: 'filter pending payment', total_amount: 100, status: 'pending_payment' },
            { id: ids.paidPendingDoc, applicant_id: user.id, claim_type: 'employee', description: 'filter paid pending doc', total_amount: 100, status: 'paid_pending_doc' },
            { id: ids.pendingDocReview, applicant_id: user.id, claim_type: 'employee', description: 'filter pending doc review', total_amount: 100, status: 'pending_doc_review' },
            { id: ids.paid, applicant_id: user.id, claim_type: 'employee', description: 'filter paid', total_amount: 100, status: 'paid' },
            { id: ids.cancelled, applicant_id: user.id, claim_type: 'employee', description: 'filter cancelled', total_amount: 100, status: 'cancelled' }
        ]);
        if (insertError) throw insertError;
    });

    test.afterAll(async () => {
        if (user) await supabaseAdmin.auth.admin.deleteUser(user.id);
    });

    test('tab filters match expected status groups', async ({ page }) => {
        await injectSession(page, user.email, password);

        await page.goto('/claims?tab=drafts');
        await expect(page.getByRole('heading', { name: '我的請款單' })).toBeVisible();
        await expect(page.locator(`text=#${ids.draft}`)).toBeVisible();
        await expect(page.locator(`text=#${ids.returned}`)).toBeVisible();
        await expect(page.locator(`text=#${ids.pendingManager}`)).toHaveCount(0);

        await page.goto('/claims?tab=processing');
        await expect(page.locator(`text=#${ids.pendingManager}`)).toBeVisible();
        await expect(page.locator(`text=#${ids.pendingFinance}`)).toBeVisible();
        await expect(page.locator(`text=#${ids.pendingPayment}`)).toBeVisible();
        await expect(page.locator(`text=#${ids.draft}`)).toHaveCount(0);

        await page.goto('/claims?tab=action_required');
        await expect(page.locator(`text=#${ids.paidPendingDoc}`)).toBeVisible();
        await expect(page.locator(`text=#${ids.pendingDocReview}`)).toBeVisible();
        await expect(page.locator(`text=#${ids.paid}`)).toHaveCount(0);

        await page.goto('/claims?tab=history');
        await expect(page.locator(`text=#${ids.paid}`)).toBeVisible();
        await expect(page.locator(`text=#${ids.cancelled}`)).toBeVisible();
        await expect(page.locator(`text=#${ids.pendingManager}`)).toHaveCount(0);
    });
});
