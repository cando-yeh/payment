import { fail, redirect, type Actions, type RequestEvent } from '@sveltejs/kit';

/**
 * Account Page Server Actions
 * 
 * 由於 Phase 2 將帳戶頁面轉為 Sheet 形式，
 * 這些 Action 負責處理來自 UserAccountSheet.svelte 的後端請求。
 */
export const actions: Actions = {
    /** 
     * 揭露銀行帳號 
     * 
     * 安全邏輯：
     * 1. 透過 RPC 'reveal_profile_bank_account' 呼叫資料庫。
     * 2. 資料庫端的函數使用 SECURITY DEFINER 並執行 pgp_sym_decrypt。
     * 3. 只有當 auth.uid() 與目標 ID 吻合（本人）或為管理員時，才會回傳解密後的文字。
     */
    revealAccount: async ({ locals }: RequestEvent) => {
        const session = await locals.getSession();
        if (!session) throw redirect(303, '/auth');

        const { data, error } = await locals.supabase.rpc('reveal_profile_bank_account', {
            target_id: session.user.id
        });

        if (error) {
            return fail(500, { message: '讀取失敗', error: error.message });
        }

        return { success: true, decryptedAccount: data };
    },

    /**
     * 更新個人資料
     * 
     * 開發紀錄：
     * - 早期版本使用 `upsert` 可能導致銀行帳號欄位在未傳送時被覆寫為 null。
     * - 現已改為針對性 `update` 專注於姓名與銀行名稱。
     * - 銀行帳號更新則是獨立透過加密 RPC `update_profile_bank_account` 執行。
     */
    updateProfile: async ({ request, locals }: RequestEvent) => {
        const session = await locals.getSession();
        if (!session) throw redirect(303, '/auth');

        const formData = await request.formData();
        const fullName = formData.get('fullName') as string;
        const bank = formData.get('bank') as string;
        const bankAccount = formData.get('bankAccount') as string;

        /**
         * 1. 更新基本非敏感資料
         */
        const updates = {
            full_name: fullName,
            bank: bank,
            updated_at: new Date().toISOString()
        };

        const { error } = await locals.supabase
            .from('profiles')
            .update(updates)
            .eq('id', session.user.id);

        if (error) {
            return fail(500, { message: '個人基本資料更新失敗', error: error.message });
        }

        /**
         * 2. 處理銀行帳號更新 (敏感資料加密路徑)
         * 
         * 為了確保安全性，敏感欄位 `bank_account` (bytea) 僅能透過
         * 資料庫層級的加密函數進行寫入。
         */
        if (bankAccount) {
            const { error: cryptoError } = await locals.supabase.rpc('update_profile_bank_account', {
                target_id: session.user.id,
                raw_account: bankAccount
            });

            if (cryptoError) {
                console.error('Crypto update error:', cryptoError);
                return fail(500, { message: '銀行帳號加密更新失敗', error: cryptoError.message });
            }
        }

        return { success: true };
    }
};
