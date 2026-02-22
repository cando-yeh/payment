import { fail, redirect, type Actions, type RequestEvent } from '@sveltejs/kit';
import { uploadFileToStorage, validateFileUpload } from '$lib/server/storage-upload';

/**
 * Account Page Server Actions
 * 
 * 由於 Phase 2 將帳戶頁面轉為 Sheet 形式，
 * 這些 Action 負責處理來自 UserAccountSheet.svelte 的後端請求。
 */
export const actions: Actions = {
    /**
     * 取得目前登入者最新個人資料快照
     */
    getMyProfileSnapshot: async ({ locals }: RequestEvent) => {
        const session = await locals.getSession();
        if (!session) throw redirect(303, '/auth');

        const { data, error } = await locals.supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url, is_admin, is_finance, approver_id, bank, bank_account_tail')
            .eq('id', session.user.id)
            .single();

        if (error || !data) {
            return fail(500, { message: '讀取個人資料失敗', error: error?.message });
        }

        return { success: true, profile: data };
    },

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
        const fullNameRaw = formData.get('fullName');
        const bankRaw = formData.get('bank');
        const bankAccountRaw = formData.get('bankAccount');

        const fullName = typeof fullNameRaw === 'string' ? fullNameRaw.trim() : '';
        const bank = typeof bankRaw === 'string' ? bankRaw.trim() : '';
        const bankAccount = typeof bankAccountRaw === 'string' ? bankAccountRaw.trim() : '';

        /**
         * 1. 更新基本非敏感資料
         */
        const updates: Record<string, string | null> = {
            updated_at: new Date().toISOString()
        };

        if (fullName) {
            updates.full_name = fullName;
        }

        if (typeof bankRaw === 'string') {
            updates.bank = bank || null;
        }

        if (Object.keys(updates).length > 1) {
            const { error } = await locals.supabase
                .from('profiles')
                .update(updates)
                .eq('id', session.user.id);

            if (error) {
                return fail(500, { message: '個人基本資料更新失敗', error: error.message });
            }
        }

        // 同步 auth metadata，避免重新登入或部分頁面 fallback 到舊名稱
        if (fullName) {
            const { error: authUpdateError } = await locals.supabase.auth.updateUser({
                data: { full_name: fullName, name: fullName }
            });
            if (authUpdateError) {
                console.warn('Failed to sync self auth metadata full_name:', authUpdateError.message);
            }
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
    },

    updateAvatar: async ({ request, locals }: RequestEvent) => {
        const session = await locals.getSession();
        if (!session) throw redirect(303, '/auth');

        const formData = await request.formData();
        const avatarRaw = formData.get('avatar');
        const avatar = avatarRaw instanceof File ? avatarRaw : null;

        try {
            validateFileUpload(avatar, '頭像', {
                required: true,
                maxBytes: 2 * 1024 * 1024,
                allowedTypes: new Set([
                    'image/jpeg',
                    'image/png',
                    'image/webp',
                    'image/gif'
                ])
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : '頭像上傳失敗';
            return fail(400, { message });
        }

        if (!avatar) {
            return fail(400, { message: '請選擇頭像檔案' });
        }

        const { data: currentProfile } = await locals.supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', session.user.id)
            .maybeSingle();

        let uploadedPath = '';
        try {
            uploadedPath = await uploadFileToStorage(locals.supabase, avatar, {
                bucket: 'avatars',
                folder: session.user.id,
                prefix: 'avatar'
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : '頭像上傳失敗';
            return fail(500, { message });
        }

        const { data: publicData } = locals.supabase.storage
            .from('avatars')
            .getPublicUrl(uploadedPath);
        const avatarUrl = publicData.publicUrl;

        const { error: updateError } = await locals.supabase
            .from('profiles')
            .update({
                avatar_url: avatarUrl,
                updated_at: new Date().toISOString()
            })
            .eq('id', session.user.id);

        if (updateError) {
            return fail(500, { message: '頭像更新失敗', error: updateError.message });
        }

        const previousUrl = currentProfile?.avatar_url;
        const bucketPrefix = '/storage/v1/object/public/avatars/';
        if (previousUrl?.includes(bucketPrefix)) {
            const oldPath = previousUrl.split(bucketPrefix)[1];
            if (oldPath && oldPath !== uploadedPath) {
                await locals.supabase.storage.from('avatars').remove([oldPath]);
            }
        }

        const { error: authUpdateError } = await locals.supabase.auth.updateUser({
            data: { avatar_url: avatarUrl }
        });
        if (authUpdateError) {
            console.warn('Failed to sync self auth metadata avatar_url:', authUpdateError.message);
        }

        return { success: true, avatarUrl };
    }
};
