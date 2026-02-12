import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    const session = await locals.getSession();
    if (!session) throw redirect(303, '/auth');

    // 🔒 使用 hooks.server.ts 已注入的 locals.user 做權限檢查，無需額外查詢
    if (!locals.user?.is_admin) {
        throw redirect(303, '/');
    }

    // ✅ 單次查詢取得所有使用者，approverOptions 直接從中衍生
    const { data: users, error } = await locals.supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching users:', error);
    }

    return {
        users: users || [],
        approverOptions: (users || []).map((u: any) => ({ id: u.id, full_name: u.full_name }))
    };
};

export const actions: Actions = {
    updateUserPermissions: async ({ request, locals }) => {
        // 🔒 權限驗證：僅管理員可修改使用者權限
        if (!locals.user?.is_admin) {
            return fail(403, { message: '權限不足：僅管理員可執行此操作' });
        }

        const formData = await request.formData();
        const userId = formData.get('userId') as string;
        const field = formData.get('field') as string;
        const value = formData.get('value') === 'true';

        if (!userId || !field) return fail(400, { message: '缺少必要參數' });

        // 🔒 白名單檢查：僅允許修改特定欄位，防止動態欄位注入
        const allowedFields = ['is_admin', 'is_finance'];
        if (!allowedFields.includes(field)) {
            return fail(400, { message: '不允許修改此欄位' });
        }

        const { error } = await locals.supabase
            .from('profiles')
            .update({ [field]: value })
            .eq('id', userId);

        if (error) {
            return fail(500, { message: '更新失敗', error: error.message });
        }

        return { success: true };
    },

    assignApprover: async ({ request, locals }) => {
        // 🔒 權限驗證：僅管理員可指派核准人
        if (!locals.user?.is_admin) {
            return fail(403, { message: '權限不足：僅管理員可執行此操作' });
        }

        const formData = await request.formData();
        const userId = formData.get('userId') as string;
        const approverId = formData.get('approverId') as string;

        if (!userId) return fail(400, { message: '缺少必要參數' });

        const { error } = await locals.supabase
            .from('profiles')
            .update({ approver_id: approverId || null })
            .eq('id', userId);

        if (error) {
            return fail(500, { message: '指派失敗', error: error.message });
        }

        return { success: true };
    },

    removeUser: async ({ request, locals }) => {
        // 🔒 權限驗證：僅管理員可刪除使用者
        if (!locals.user?.is_admin) {
            return fail(403, { message: '權限不足：僅管理員可執行此操作' });
        }

        const formData = await request.formData();
        const userId = formData.get('userId') as string;

        if (!userId) return fail(400, { message: '缺少必要參數' });

        // 🛡️ 禁止自刪 (防止管理員把自己關在門外)
        const session = await locals.getSession();
        if (session?.user?.id === userId) {
            return fail(400, { message: '無法刪除：您不能刪除目前的登入帳號' });
        }

        const { data: deletedRows, error } = await locals.supabase
            .from('profiles')
            .delete()
            .eq('id', userId)
            .select('id');

        if (error) {
            console.error('Delete user error:', error);

            // 💡 PostgreSQL 錯誤代碼 23503: Foreign Key Violation
            if (error.code === '23503') {
                let context = '其他資料';
                if (error.message.includes('claims')) context = '報銷單 (Claims)';
                if (error.message.includes('payees')) context = '收款人 (Payees)';
                if (error.message.includes('profiles_approver_id_fkey')) context = '其他使用者的核准流程';

                return fail(409, {
                    message: `無法刪除：此使用者仍與 ${context} 關聯，請先移除相關數據後再試。`,
                    error: error.message
                });
            }

            if (error.code === '42501') {
                return fail(403, {
                    message: '無法刪除：目前資料庫權限不足，請聯絡系統管理員檢查 RLS/角色設定。',
                    error: error.message
                });
            }

            return fail(500, {
                message: `刪除失敗：${error.message || '未知錯誤'}`,
                error: error.message
            });
        }

        if (!deletedRows || deletedRows.length === 0) {
            return fail(409, {
                message: '無法刪除：找不到使用者或目前權限不足，請重新整理後再試。'
            });
        }

        return { success: true };
    }
};
