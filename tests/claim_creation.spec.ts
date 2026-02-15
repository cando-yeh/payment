import { test, expect } from '@playwright/test';
import { supabaseAdmin, injectSession, postFormActionDetailed } from './helpers';

test.describe('Claim Creation Flow', () => {
    let userStandard: any;
    const password = 'password123';

    test.beforeAll(async () => {
        // Create standard test user
        const email = `claim_test_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;
        const { data: u1, error: e1 } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: 'Claim Test User' }
        });
        if (e1) throw e1;
        userStandard = u1.user;
    });

    test.afterAll(async () => {
        if (userStandard) await supabaseAdmin.auth.admin.deleteUser(userStandard.id);
    });

    test('Create Employee Claim', async ({ page }) => {
        const { count: beforeCount } = await supabaseAdmin
            .from('claims')
            .select('*', { count: 'exact', head: true })
            .eq('applicant_id', userStandard.id);

        // 1. Login
        await injectSession(page, userStandard.email, password);

        // 2. Go to Claims List
        await page.goto('/claims');
        await expect(page).toHaveURL(/\/claims/);
        await expect(page.locator('h1')).toContainText('我的請款單');

        // 3. Click Create
        await page.click('a[href="/claims/new"]');
        await expect(page).toHaveURL(/\/claims\/new/);
        await expect(page.locator('text=建立新請款單')).toBeVisible();

        const createRes = await postFormActionDetailed(page, '/claims/new?/create', {
            claim_type: 'employee',
            items: JSON.stringify([
                {
                    date: new Date().toISOString().split('T')[0],
                    category: 'travel',
                    description: 'Taxi to Client',
                    amount: 500
                }
            ])
        });
        expect(createRes.status).toBe(200);
        expect(createRes.body).not.toContain('Missing required fields');
        expect(createRes.body).not.toContain('Failed to create claim');
        expect(createRes.body).not.toContain('At least one item is required');

        const { count: afterCount } = await supabaseAdmin
            .from('claims')
            .select('*', { count: 'exact', head: true })
            .eq('applicant_id', userStandard.id);
        expect((afterCount || 0)).toBeGreaterThan(beforeCount || 0);

        const { data: latestClaim } = await supabaseAdmin
            .from('claims')
            .select('id, claim_type')
            .eq('applicant_id', userStandard.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        expect(latestClaim?.claim_type).toBe('employee');
        await page.goto(`/claims/${latestClaim?.id}`);
        await expect(page).toHaveURL(new RegExp(`/claims/${latestClaim?.id}/edit`));

        // 8. Verify Edit Page (draft default behavior)
        await expect(page.locator('h1')).toContainText('員工費用報銷 (編輯)');
        await expect(page.locator(`text=單號: ${latestClaim?.id}`)).toBeVisible();

        // 9. Verify draft actions are available in edit mode
        await expect(page.getByRole('button', { name: '儲存變更' })).toBeVisible();
        await expect(page.getByRole('button', { name: '提交審核' })).toBeVisible();
    });
});
