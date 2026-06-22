import { test, expect } from '@playwright/test';
import { supabaseAdmin, injectSession } from './helpers';

/**
 * 驗證審核中心列表「逐列核准 / 駁回」新功能。
 * 一次性驗證腳本：截圖確認 UI，並實際操作核准與駁回。
 */
test.describe('Approval inline row actions', () => {
    let applicant: any;
    let manager: any;
    let finance: any;
    const password = 'password123';
    const ts = Date.now();
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    async function waitForProfile(userId: string) {
        for (let i = 0; i < 20; i++) {
            const { data } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('id', userId)
                .maybeSingle();
            if (data?.id) return;
            await sleep(200);
        }
        throw new Error(`Profile not ready: ${userId}`);
    }

    async function seedClaim(id: string, status: string, desc: string, amount: number) {
        await supabaseAdmin.from('claims').insert({
            id,
            applicant_id: applicant.id,
            description: desc,
            total_amount: amount,
            status,
            claim_type: 'employee'
        });
        await supabaseAdmin.from('claim_items').insert({
            claim_id: id,
            item_index: 0,
            category: '交通費',
            amount,
            description: '計程車',
            date_start: new Date().toISOString().split('T')[0]
        });
    }

    test.beforeAll(async () => {
        const mk = async (prefix: string) => {
            const { data, error } = await supabaseAdmin.auth.admin.createUser({
                email: `${prefix}_${ts}@example.com`,
                password,
                email_confirm: true,
                user_metadata: { full_name: `${prefix}_${ts}` }
            });
            if (error || !data?.user) throw error;
            await waitForProfile(data.user.id);
            return data.user;
        };
        manager = await mk('inl_manager');
        finance = await mk('inl_finance');
        await supabaseAdmin.from('profiles').update({ is_finance: true }).eq('id', finance.id);
        applicant = await mk('inl_applicant');
        await supabaseAdmin.from('profiles').update({ approver_id: manager.id }).eq('id', applicant.id);
        await sleep(500);
    });

    test.afterAll(async () => {
        if (applicant) await supabaseAdmin.auth.admin.deleteUser(applicant.id);
        if (manager) await supabaseAdmin.auth.admin.deleteUser(manager.id);
        if (finance) await supabaseAdmin.auth.admin.deleteUser(finance.id);
    });

    test('Manager tab: inline approve works', async ({ page }) => {
        const claimId = `M${Math.floor(Math.random() * 9000000) + 1000000}`;
        await seedClaim(claimId, 'pending_manager', '逐列核准測試', 240);

        await injectSession(page, manager.email, password);
        await page.goto('/approval?tab=manager');

        const approveBtn = page.locator('button:has-text("核准")').first();
        const rejectBtn = page.locator('button:has-text("駁回")').first();
        await expect(approveBtn).toBeVisible();
        await expect(rejectBtn).toBeVisible();
        await page.screenshot({ path: 'test-results/inline-manager-tab.png', fullPage: true });

        await approveBtn.click();
        // 核准後該 pending_manager 單據離開列表
        await page.waitForTimeout(1500);

        const { data } = await supabaseAdmin.from('claims').select('status').eq('id', claimId).single();
        expect(data?.status).toBe('pending_finance');
        await supabaseAdmin.from('claims').delete().eq('id', claimId);
    });

    test('Finance tab: inline reject requires reason and works', async ({ page }) => {
        const claimId = `F${Math.floor(Math.random() * 9000000) + 1000000}`;
        await seedClaim(claimId, 'pending_finance', '逐列駁回測試', 698);

        await injectSession(page, finance.email, password);
        await page.goto('/approval?tab=finance');

        const rejectBtn = page.locator('button:has-text("駁回")').first();
        await expect(rejectBtn).toBeVisible();
        await page.screenshot({ path: 'test-results/inline-finance-tab.png', fullPage: true });

        await rejectBtn.click();
        // 駁回對話框
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByText('駁回此申請')).toBeVisible();
        // 確認駁回鈕在未填原因時為 disabled
        const confirmBtn = dialog.locator('button:has-text("確認駁回")');
        await expect(confirmBtn).toBeDisabled();
        await page.screenshot({ path: 'test-results/inline-reject-dialog.png' });

        await dialog.locator('textarea[name="comment"]').fill('金額與憑證不符，請重新檢附');
        await expect(confirmBtn).toBeEnabled();
        await confirmBtn.click();
        await page.waitForTimeout(1500);

        const { data } = await supabaseAdmin.from('claims').select('status, last_comment').eq('id', claimId).single();
        expect(data?.status).toBe('rejected');
        expect(data?.last_comment).toContain('金額與憑證不符');
        await supabaseAdmin.from('claims').delete().eq('id', claimId);
    });
});
