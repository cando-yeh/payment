/**
 * RLS (Row Level Security) 安全性自動化驗證測試
 * 
 * 【測試目標】
 * 驗證 Supabase 資料庫層級的安全政策是否正確實施。這能確保即便前端代碼有漏洞，
 * 背景資料庫仍然能防止未授權的跨用戶資料存取。
 * 
 * 【測試邏輯】
 * 1. 使用管理員權限 (Service Role) 建立兩個測試帳號 A 與 B。
 * 2. 以 B 的名義建立一筆私有請款單資料。
 * 3. 以 A 的名義登入。
 * 4. 嘗試查詢 B 的 profiles 與 claims。
 * 5. 斷言 A 應該「看不到」也「改不到」 B 的任何敏感資料。
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey, supabaseAdmin, authSignInWithRetry } from './helpers';

test.describe('RLS 安全性驗證流程', () => {
    let userA: any;
    let userB: any;

    /**
     * 測試前置作業：建立沙盒資料
     */
    test.beforeAll(async () => {
        console.log('🧪 [Setup] 正在初始化安全性測試環境...');
        try {
            // 1. 建立測試用戶 A (模擬攻擊者或一般同事)
            const { data: dataA, error: errA } = await supabaseAdmin.auth.admin.createUser({
                email: `test_user_a_${Date.now()}@example.com`,
                password: 'testPassword123',
                user_metadata: { full_name: '測試受試者 A' },
                email_confirm: true
            });
            if (errA) throw errA;
            userA = dataA.user;

            // 2. 建立測試用戶 B (模擬受害者或被保護者)
            const { data: dataB, error: errB } = await supabaseAdmin.auth.admin.createUser({
                email: `test_user_b_${Date.now()}@example.com`,
                password: 'testPassword123',
                user_metadata: { full_name: '測試受試者 B' },
                email_confirm: true
            });
            if (errB) throw errB;
            userB = dataB.user;

            // 3. 休眠，等待 PostgreSQL Trigger 完成 profiles 同步
            await new Promise(resolve => setTimeout(resolve, 1500));

            // 4. 以「管理員」身分幫用戶 B 建立一筆請款單
            // 注意：ID 限制為 8 碼 (varchar(8))
            const claimId = `T${Math.floor(Math.random() * 9000000) + 1000000}`; // 1 + 7 = 8 碼
            const { error: claimErr } = await supabaseAdmin.from('claims').insert({
                id: claimId,
                claim_type: 'employee',
                status: 'draft',
                applicant_id: userB.id,
                total_amount: 8888
            });
            if (claimErr) throw claimErr;

            console.log(`✅ [Setup] 測試資料準備完成。用戶 B (ID: ${userB.id}) 的請款單 ID: ${claimId}`);
        } catch (e) {
            console.error('❌ [Setup] 準備測試環境時發生錯誤:', e);
            throw e;
        }
    });

    /**
     * 測試後置作業：清理環境
     */
    test.afterAll(async () => {
        console.log('🧹 [Cleanup] 正在刪除測試帳號...');
        if (userA) await supabaseAdmin.auth.admin.deleteUser(userA.id);
        if (userB) await supabaseAdmin.auth.admin.deleteUser(userB.id);
    });

    /**
     * 測試項目 1：隱私資料隔離
     */
    test('一般使用者不應讀取他人的 Profile (RLS SELECT 驗證)', async () => {
        // 使用一般使用者 A 的連線
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        await authSignInWithRetry(supabase, userA.email!, 'testPassword123');

        // 嘗試查詢 B 的 Profile
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userB.id);

        expect(error).toBeNull();
        // 由於 RLS 政策，查詢結果應為空陣列 (這就是 RLS 的運作方式)
        expect(data?.length).toBe(0);
    });

    /**
     * 測試項目 2：請款單權限
     */
    test('一般使用者不應讀取他人的請款單 (RLS SELECT 驗證)', async () => {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        await authSignInWithRetry(supabase, userA.email!, 'testPassword123');

        // 嘗試查詢 B 的請款單
        const { data } = await supabase
            .from('claims')
            .select('*')
            .eq('applicant_id', userB.id);

        // 預期結果：查詢不出任何東西
        expect(data?.length).toBe(0);
    });

    /**
     * 測試項目 3：防竄改驗證
     */
    test('一般使用者不應更新他人的個人資料 (RLS UPDATE 驗證)', async () => {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        await authSignInWithRetry(supabase, userA.email!, 'testPassword123');

        // 嘗試修改 B 的名字
        const { error } = await supabase
            .from('profiles')
            .update({ full_name: '惡意修改' })
            .eq('id', userB.id);

        expect(error).toBeNull();

        // 以管理員權限確認名字是否真的沒被改掉
        const { data: bProfile } = await supabaseAdmin
            .from('profiles')
            .select('full_name')
            .eq('id', userB.id)
            .single();

        expect(bProfile?.full_name).not.toBe('惡意修改');
        expect(bProfile?.full_name).toBe('測試受試者 B');
    });
});
