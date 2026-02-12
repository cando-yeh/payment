/**
 * RPC 加密與權限驗證測試（Vitest 整合版）
 *
 * 原始檔案：verify_rpc.ts（standalone Node script）
 * 遷移至 Vitest，讓 CI 自動執行。
 *
 * 測試項目：
 * 1. 本人可更新銀行帳號（透過 RPC）
 * 2. 本人可解密銀行帳號（透過 RPC）
 * 3. 他人不可解密他人的銀行帳號
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey, supabaseServiceKey } from './helpers';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

describe('Bank Account Encryption RPC', () => {
    let testUser: any = null;
    let otherUser: any = null;
    const password = 'testPassword123';

    beforeAll(async () => {
        // 建立測試使用者
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
            email: `rpc_test_${Date.now()}@example.com`,
            password,
            user_metadata: { full_name: 'RPC 測試員' },
            email_confirm: true,
        });
        if (userError) throw userError;
        testUser = userData.user;

        const { data: otherData, error: otherError } = await supabaseAdmin.auth.admin.createUser({
            email: `rpc_other_${Date.now()}@example.com`,
            password,
            user_metadata: { full_name: 'RPC 旁觀者' },
            email_confirm: true,
        });
        if (otherError) throw otherError;
        otherUser = otherData.user;
    }, 30000);

    afterAll(async () => {
        if (testUser) await supabaseAdmin.auth.admin.deleteUser(testUser.id);
        if (otherUser) await supabaseAdmin.auth.admin.deleteUser(otherUser.id);
    }, 15000);

    it('should allow owner to update bank account via RPC', async () => {
        const client = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false },
        });
        await client.auth.signInWithPassword({
            email: testUser.email,
            password,
        });

        const secretAccount = '1234-5678-9012-3456';
        const { error } = await client.rpc('update_profile_bank_account', {
            target_id: testUser.id,
            raw_account: secretAccount,
        });

        expect(error).toBeNull();
    });

    it('should allow owner to decrypt their own bank account via RPC', async () => {
        const client = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false },
        });
        await client.auth.signInWithPassword({
            email: testUser.email,
            password,
        });

        const secretAccount = '1234-5678-9012-3456';
        const { data: decrypted, error } = await client.rpc('reveal_profile_bank_account', {
            target_id: testUser.id,
        });

        expect(error).toBeNull();
        expect(decrypted).toBe(secretAccount);
    });

    it('should deny other users from decrypting bank account', async () => {
        const client = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false },
        });
        await client.auth.signInWithPassword({
            email: otherUser.email,
            password,
        });

        const { data, error } = await client.rpc('reveal_profile_bank_account', {
            target_id: testUser.id,
        });

        // RPC 應回傳 error 或 null（取決於是 RAISE EXCEPTION 還是 RETURN NULL）
        const accessDenied = error !== null || data === null;
        expect(accessDenied).toBe(true);
    });
});
