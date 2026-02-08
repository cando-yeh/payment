/**
 * Supabase 專案初始化腳本 (一次性工具)
 * 
 * 此腳本的主要任務：
 * 1. 建立存放收據圖片的 Storage Bucket: 'receipts'
 * 2. 設定 Bucket 為非公開 (Private)，確保只有授權使用者能存取
 * 3. 限制檔案格式與大小 (5MB, 圖片或 PDF)
 * 
 * 執行方式：
 * npx tsx src/lib/scripts/init-supabase.ts
 * (注意：執行前需確保環境變數 PUBLIC_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY 已設定)
 */

import { createClient } from '@supabase/supabase-js';

// 1. 從環境變數讀取連線資訊
// 注意：這裡使用 Service Role Key，因為建立 Bucket 需要管理員權限
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ 找不到環境變數，請確保已傳入 PUBLIC_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

// 2. 初始化具有管理員權限的 Supabase 客戶端
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function initStorage() {
    console.log('🚀 開始檢查/建立 Storage Bucket: receipts...');

    try {
        // 3. 獲取現有的 Bucket 列表
        const { data: buckets, error: getError } = await supabase.storage.listBuckets();

        if (getError) {
            console.error('❌ 獲取 Bucket 列表失敗:', getError.message);
            return;
        }

        // 4. 檢查 'receipts' 是否已經存在
        const receiptsBucket = buckets.find((b: any) => b.name === 'receipts');

        if (!receiptsBucket) {
            // 5. 建立新的 Bucket
            const { data, error } = await supabase.storage.createBucket('receipts', {
                public: false, // 安全第一：設為非公開，需透過程式碼取得簽名 URL 才能看到圖片
                fileSizeLimit: 5242880, // 限制單一檔案 5MB，避免使用者上傳超大原始圖檔
                allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
            });

            if (error) {
                console.error('❌ 建立 Bucket 失敗:', error.message);
            } else {
                console.log('✅ 成功建立 receipts bucket！');
            }
        } else {
            console.log('✨ receipts bucket 已存在，無需重複建立。');
        }
    } catch (e: any) {
        console.error('❌ 發生意外錯誤:', e.message);
    }
}

// 執行初始化動作
initStorage();
