import { expect, test } from '@playwright/test';
import { injectSession, postFormActionDetailed, supabaseAdmin } from './helpers';

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

function buildItems(amount = 1000) {
    return JSON.stringify([
        {
            date: new Date().toISOString().split('T')[0],
            category: 'general',
            description: 'variant item',
            amount
        }
    ]);
}

test.describe.serial('Claim Creation Variants', () => {
    let user: any;
    let vendorPayeeId: string;
    let personalPayeeId: string;

    test.beforeAll(async () => {
        const ts = Date.now();
        const { data: u } = await supabaseAdmin.auth.admin.createUser({
            email: `claim_variant_${ts}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: `Claim Variant ${ts}` }
        });
        user = u.user;
        await waitForProfile(user.id);

        const { data: vendor } = await supabaseAdmin.from('payees').insert({
            name: `Variant Vendor ${ts}`,
            type: 'vendor',
            tax_id: `V${ts}`.slice(0, 8),
            bank: '004',
            status: 'available'
        }).select('id').single();
        vendorPayeeId = vendor!.id;

        const { data: personal } = await supabaseAdmin.from('payees').insert({
            name: `Variant Personal ${ts}`,
            type: 'personal',
            tax_id: `P${ts}`.slice(0, 8),
            bank: '004',
            status: 'available'
        }).select('id').single();
        personalPayeeId = personal!.id;
    });

    test.afterAll(async () => {
        if (vendorPayeeId) await supabaseAdmin.from('payees').delete().eq('id', vendorPayeeId);
        if (personalPayeeId) await supabaseAdmin.from('payees').delete().eq('id', personalPayeeId);
        if (user) await supabaseAdmin.auth.admin.deleteUser(user.id);
    });

    test('vendor and personal_service claim creation succeeds', async ({ page }) => {
        await injectSession(page, user.email, password);
        await page.goto('/claims/new');

        const { count: beforeCount } = await supabaseAdmin
            .from('claims')
            .select('*', { count: 'exact', head: true })
            .eq('applicant_id', user.id);

        const vendorDesc = `variant vendor ${Date.now()}`;
        const vendorRes = await postFormActionDetailed(page, '/claims/new?/create', {
            claim_type: 'vendor',
            description: vendorDesc,
            payee_id: vendorPayeeId,
            items: buildItems(1200)
        });
        expect(vendorRes.status).toBe(200);
        expect(vendorRes.body).not.toContain('Payee is required for this claim type');
        expect(vendorRes.body).not.toContain('Failed to create claim');

        const { data: vendorClaim } = await supabaseAdmin
            .from('claims')
            .select('id, claim_type, payee_id')
            .eq('applicant_id', user.id)
            .eq('claim_type', 'vendor')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        expect(vendorClaim?.id).toBeTruthy();
        expect(vendorClaim?.payee_id).toBe(vendorPayeeId);

        const personalDesc = `variant personal ${Date.now()}`;
        const personalRes = await postFormActionDetailed(page, '/claims/new?/create', {
            claim_type: 'personal_service',
            description: personalDesc,
            payee_id: personalPayeeId,
            items: buildItems(800)
        });
        expect(personalRes.status).toBe(200);
        expect(personalRes.body).not.toContain('Payee is required for this claim type');
        expect(personalRes.body).not.toContain('Failed to create claim');

        const { data: personalClaim } = await supabaseAdmin
            .from('claims')
            .select('id, claim_type, payee_id')
            .eq('applicant_id', user.id)
            .eq('claim_type', 'personal_service')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        expect(personalClaim?.id).toBeTruthy();
        expect(personalClaim?.payee_id).toBe(personalPayeeId);

        const { count: afterCount } = await supabaseAdmin
            .from('claims')
            .select('*', { count: 'exact', head: true })
            .eq('applicant_id', user.id);
        expect((afterCount || 0)).toBeGreaterThan((beforeCount || 0) + 1);
    });

    test('vendor claim requires payee_id', async ({ page }) => {
        await injectSession(page, user.email, password);
        await page.goto('/claims/new');

        const res = await postFormActionDetailed(page, '/claims/new?/create', {
            claim_type: 'vendor',
            description: `variant vendor missing payee ${Date.now()}`,
            items: buildItems(500)
        });
        expect(res.body).toContain('Payee is required for this claim type');
    });
});
