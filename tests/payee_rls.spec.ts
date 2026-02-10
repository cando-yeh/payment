/**
 * Payee RLS 安全性測試
 *
 * 驗證 Row Level Security 策略：
 * - 一般使用者不可直接寫入 payees
 * - 一般使用者不可直接寫入 payee_change_requests（需透過 RPC）
 * - 一般使用者可以透過 RPC 提交申請
 * - 所有使用者可讀取 payees
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey, supabaseAdmin } from './helpers';

test.describe('Payee RLS Security', () => {
    let userStandard: any;
    let userFinance: any;
    const password = 'password123';

    test.beforeAll(async () => {
        // 建立一般使用者
        const { data: u1, error: e1 } = await supabaseAdmin.auth.admin.createUser({
            email: `std_user_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: 'Standard User' }
        });
        if (e1) throw e1;
        userStandard = u1.user;

        // 建立財務使用者
        const { data: u2, error: e2 } = await supabaseAdmin.auth.admin.createUser({
            email: `fin_user_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`,
            password,
            email_confirm: true,
            user_metadata: { full_name: 'Finance User' }
        });
        if (e2) throw e2;
        userFinance = u2.user;

        // 更新財務使用者權限
        await supabaseAdmin.from('profiles').update({ is_finance: true }).eq('id', userFinance.id);
    });

    test.afterAll(async () => {
        if (userStandard) await supabaseAdmin.auth.admin.deleteUser(userStandard.id);
        if (userFinance) await supabaseAdmin.auth.admin.deleteUser(userFinance.id);
    });

    test('Standard User CANNOT insert into payees directly', async () => {
        const client = createClient(supabaseUrl, supabaseAnonKey);
        await client.auth.signInWithPassword({ email: userStandard.email, password });

        const { error } = await client.from('payees').insert({
            name: 'Hacker Payee',
            type: 'vendor',
            status: 'available'
        });

        expect(error).not.toBeNull();
        expect(error?.code).toBe('42501'); // insufficient_privilege
    });

    test('Standard User CANNOT insert into payee_change_requests directly (must use RPC)', async () => {
        const client = createClient(supabaseUrl, supabaseAnonKey);
        await client.auth.signInWithPassword({ email: userStandard.email, password });

        const { error } = await client.from('payee_change_requests').insert({
            change_type: 'create',
            requested_by: userStandard.id,
            proposed_data: { name: 'Direct Insert Attempt' },
            reason: 'Testing',
            status: 'pending'
        });

        expect(error).not.toBeNull();
        expect(error?.code).toBe('42501'); // insufficient_privilege
    });

    test('Standard User CAN submit payee_change_requests via RPC', async () => {
        const client = createClient(supabaseUrl, supabaseAnonKey);
        await client.auth.signInWithPassword({ email: userStandard.email, password });

        const { data, error } = await client.rpc('submit_payee_change_request', {
            _change_type: 'create',
            _payee_id: null,
            _proposed_data: { name: 'RPC Request', type: 'vendor', bank_code: '012', service_description: 'Test' },
            _proposed_tax_id: '12345678',
            _proposed_bank_account: '1234567890',
            _reason: 'RLS test via RPC'
        });

        expect(error).toBeNull();
        expect(data).toBeTruthy();
    });

    test('All Users CAN read payees', async () => {
        const client = createClient(supabaseUrl, supabaseAnonKey);
        await client.auth.signInWithPassword({ email: userStandard.email, password });

        const { error } = await client.from('payees').select('*');
        expect(error).toBeNull();
    });
});
