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

test.describe.serial('Account Actions', () => {
    let user: any;

    test.beforeAll(async () => {
        const ts = Date.now();
        const { data } = await supabaseAdmin.auth.admin.createUser({
            email: `account_actions_${ts}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: `Account Actions ${ts}` }
        });
        user = data.user;
        await waitForProfile(user.id);
    });

    test.afterAll(async () => {
        if (user) await supabaseAdmin.auth.admin.deleteUser(user.id);
    });

    test('updateProfile and revealAccount work end-to-end', async ({ page }) => {
        const fullName = `Updated Name ${Date.now()}`;
        const bank = '004-臺灣銀行';
        const account = '1234567890';

        await injectSession(page, user.email, password);
        await page.goto('/claims');

        const updateBody = await postFormAction(page, '/account?/updateProfile', {
            fullName,
            bank,
            bankAccount: account
        });
        expect(updateBody).toContain('"type":"success"');

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('full_name, bank')
            .eq('id', user.id)
            .single();
        expect(profile?.full_name).toBe(fullName);
        expect(profile?.bank).toBe(bank);

        const revealBody = await postFormAction(page, '/account?/revealAccount');
        expect(revealBody).toContain('"type":"success"');
        expect(revealBody).toContain(account);
    });
});
