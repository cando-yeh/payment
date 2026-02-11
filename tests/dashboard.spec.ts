import { test, expect } from '@playwright/test';
import { supabaseAdmin, injectSession } from './helpers';

test.describe('Dashboard E2E', () => {
    let applicant: any;
    const password = 'password123';
    const ts = Date.now();
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    async function waitForProfile(userId: string) {
        for (let i = 0; i < 20; i++) {
            const { data } = await supabaseAdmin.from('profiles').select('id').eq('id', userId).maybeSingle();
            if (data?.id) return;
            await sleep(200);
        }
        throw new Error(`Profile not ready for user: ${userId}`);
    }

    test.beforeAll(async () => {
        // Create Applicant
        const { data: a } = await supabaseAdmin.auth.admin.createUser({
            email: `dash_user_${ts}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: `Dash_User_${ts}` }
        });
        applicant = a.user;
        await waitForProfile(applicant.id);
        await supabaseAdmin.from('profiles').update({ full_name: `Dash_User_${ts}` }).eq('id', applicant.id);
    });

    test.afterAll(async () => {
        if (applicant) await supabaseAdmin.auth.admin.deleteUser(applicant.id);
    });

    test('Dashboard Page: Guest vs Authenticated', async ({ page }) => {
        // 1. Guest View
        await page.goto('/');
        await expect(page.locator('text=Enterprise Solutions')).toBeVisible();
        await expect(page.locator('text=使用企業帳號登入')).toBeVisible();

        // 2. Authenticated View
        await injectSession(page, applicant.email, password);
        await page.goto('/');

        // Should show welcome message
        await expect(page.locator(`text=你好，Dash_User_${ts}`)).toBeVisible();

        // Should show stat cards
        await expect(page.locator('text=我的草稿')).toBeVisible();
        await expect(page.locator('text=正在審核')).toBeVisible();

        // Should show Quick Action button
        await expect(page.locator('button:has-text("新增請款單"), a:has-text("新增請款單")')).toBeVisible();
    });

    test('Dashboard Activity: Shows recent updates', async ({ page }) => {
        const claimId = `D${Math.random().toString(36).slice(2, 8).toUpperCase()}`.slice(0, 8);

        // 1. Create a claim to generate history
        const { error: claimError } = await supabaseAdmin.from('claims').insert({
            id: claimId,
            applicant_id: applicant.id,
            description: 'Dashboard Test Claim',
            total_amount: 500,
            status: 'draft',
            claim_type: 'employee'
        });
        expect(claimError).toBeNull();

        // Add history entry manually for testing
        const { error: historyError } = await supabaseAdmin.from('claim_history').insert({
            claim_id: claimId,
            actor_id: applicant.id,
            action: 'submit',
            from_status: 'draft',
            to_status: 'pending_manager',
            comment: 'Testing dashboard activity'
        });
        expect(historyError).toBeNull();

        await injectSession(page, applicant.email, password);
        await page.goto('/');

        // 2. Check Recent Activity
        await expect(page.locator('text=最近動態')).toBeVisible();
        await expect(page.locator(`text=#${claimId}`)).toBeVisible();
        await expect(page.locator('text=提交單據')).toBeVisible();
        await expect(page.locator('text=Dashboard Test Claim')).toBeVisible();
    });
});
