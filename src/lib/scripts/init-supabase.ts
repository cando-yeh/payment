/**
 * Supabase 專案自動化初始化腳本 (Admin Tool)
 * 
 * 職責：
 * 1. 確保雲端 Supabase 環境具備運算必要的 Storage 基礎設施。
 * 2. 建立 'receipts' Bucket (用於存放報銷憑證)。
 * 3. 設定預設的安全防護參數 (非公開存取、檔案類型限制、大小限制)。
 * 
 * 使用場景：
 * - 專案初次建立後。
 * - 切換至新的 Supabase 專案 (如測試環境) 時。
 * 
 * 安全說明：
 * - 必須使用 SUPABASE_SERVICE_ROLE_KEY (管理員權限)。
 * - 嚴禁將此 Key 寫死在代碼中，必須透過環境變數傳入。
 */

import { createClient } from '@supabase/supabase-js';

/**
 * 腳本入口點：檢查環境變數並執行操作
 */
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ 錯誤：環境變數 PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 缺失！');
    process.exit(1);
}

// 初始化管理員等級的客戶端
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * 初始化 Storage Buckets
 */
async function initStorage() {
    console.log('🚀 [Storage] 開始檢查並初始化磁碟空間...');

    try {
        // 取得目前專案中所有的儲存桶
        const { data: buckets, error: getError } = await supabase.storage.listBuckets();

        if (getError) {
            console.error('❌ [Storage] 無法獲取 Bucket 列表:', getError.message);
            return;
        }

        // 檢查目標 Bucket 是否已存在
        const RECEIPTS_BUCKET = 'receipts';
        const receiptsBucket = buckets.find((b: any) => b.name === RECEIPTS_BUCKET);

        if (!receiptsBucket) {
            console.log(`📡 [Storage] '${RECEIPTS_BUCKET}' 不存在，正在為您建立...`);

            // 建立設定
            const { error } = await supabase.storage.createBucket(RECEIPTS_BUCKET, {
                public: false, // 禁止未經授權的 URL 直接存取 (Protect PII)
                fileSizeLimit: 5 * 1024 * 1024, // 限制 5MB
                allowedMimeTypes: [
                    'image/png',
                    'image/jpeg',
                    'image/jpg',
                    'application/pdf'
                ]
            });

            if (error) {
                console.error(`❌ [Storage] 建立 '${RECEIPTS_BUCKET}' 失敗:`, error.message);
            } else {
                console.log(`✅ [Storage] '${RECEIPTS_BUCKET}' 建立成功！`);
            }
        } else {
            console.log(`✨ [Storage] '${RECEIPTS_BUCKET}' 已存在，無需動作。`);
        }
    } catch (e: any) {
        console.error('❌ [Storage] 發生意外異常:', e.message);
    }
}

// 啟動流程
initStorage();
