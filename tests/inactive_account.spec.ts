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

test.describe.serial('Inactive Account Access', () => {
    let user: any;

    test.beforeAll(async () => {
        const ts = Date.now();
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: `inactive_user_${ts}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: `Inactive User ${ts}` }
        });
        if (error) throw error;
        user = data.user;
        await waitForProfile(user.id);

        const { error: deactivateError } = await supabaseAdmin
            .from('profiles')
            .update({ is_active: false })
            .eq('id', user.id);
        if (deactivateError) throw deactivateError;
    });

    test.afterAll(async () => {
        if (user) await supabaseAdmin.auth.admin.deleteUser(user.id);
    });

    test('inactive user is signed out and redirected to auth with notice', async ({ page }) => {
        await injectSession(page, user.email, password);
        await page.goto('/claims');

        await expect(page).toHaveURL(/\/auth\?(reason=inactive|next=\/claims)/);
    });
});
