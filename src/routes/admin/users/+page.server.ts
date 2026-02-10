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
    }
};
