/**
 * RPC 加密與權限驗證測試腳本
 * 
 * 用途：直接呼叫 Supabase RPC 驗證銀行帳號的加密/解密流程與權限控制。
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

// 載入環境變數
const envConfig = dotenv.parse(readFileSync('.env'));
const supabaseUrl = envConfig.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = envConfig.PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function runTest() {
    console.log('🚀 開始銀行帳號加密 RPC 驗證測試...');

    let testUser: any = null;
    let otherUser: any = null;

    try {
        // 1. 建立測試使用者
        console.log('1. 正在建立測試使用者...');
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
            email: `rpc_test_${Date.now()}@example.com`,
            password: 'testPassword123',
            user_metadata: { full_name: 'RPC 測試員' },
            email_confirm: true
        });
        if (userError) throw userError;
        testUser = userData.user;

        const { data: otherData, error: otherError } = await supabaseAdmin.auth.admin.createUser({
            email: `rpc_other_${Date.now()}@example.com`,
            password: 'testPassword123',
            user_metadata: { full_name: 'RPC 旁觀者' },
            email_confirm: true
        });
        if (otherError) throw otherError;
        otherUser = otherData.user;

        console.log(`✅ 使用者建立成功: ${testUser.id}`);

        // 建立一般權限的 Client (測試員)
        const clientTester = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false }
        });
        await clientTester.auth.signInWithPassword({
            email: testUser.email,
            password: 'testPassword123'
        });

        // 建立一般權限的 Client (旁觀者)
        const clientOther = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false }
        });
        await clientOther.auth.signInWithPassword({
            email: otherUser.email,
            password: 'testPassword123'
        });

        // 2. 測試本人更新
        console.log('2. 測試本人更新銀行帳號...');
        const secretAccount = '1234-5678-9012-3456';
        const { error: updateError } = await clientTester.rpc('update_profile_bank_account', {
            target_id: testUser.id,
            raw_account: secretAccount
        });
        if (updateError) throw updateError;
        console.log('✅ 本人更新成功');

        // 3. 測試本人解密
        console.log('3. 測試本人解密銀行帳號...');
        const { data: decrypted, error: revealError } = await clientTester.rpc('reveal_profile_bank_account', {
            target_id: testUser.id
        });
        if (revealError) throw revealError;
        if (decrypted !== secretAccount) {
            throw new Error(`解密結果不符！預期: ${secretAccount}, 實際: ${decrypted}`);
        }
        console.log('✅ 本人解密成功且內容正確');

        // 4. 測試他人跨權限存取 (應該失敗)
        console.log('4. 測試「他人」嘗試解密 (應被拒絕)...');
        const { data: badData, error: badError } = await clientOther.rpc('reveal_profile_bank_account', {
            target_id: testUser.id
        });
        // 根據 RPC 邏輯，權限不足會回傳 Exception 或 NULL。
        // 我們目前的邏輯是 RAISE EXCEPTION。
        if (badError) {
            console.log(`✅ 他人存取被拒絕（如預期報錯）: ${badError.message}`);
        } else if (badData === null) {
            console.log('✅ 他人存取被拒絕（如預期回傳空值）');
        } else {
            throw new Error('❌ 警告：他人竟然成功讀取了資料！');
        }

    } catch (error) {
        console.error('❌ 測試失敗:', error);
        process.exit(1);
    } finally {
        // 清理測試資料
        console.log('🧹 正在清理測試資料...');
        if (testUser) await supabaseAdmin.auth.admin.deleteUser(testUser.id);
        if (otherUser) await supabaseAdmin.auth.admin.deleteUser(otherUser.id);
        console.log('Done.');
    }
}

runTest();
