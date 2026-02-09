import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    const session = await locals.getSession();
    if (!session) throw redirect(303, '/auth');

    // 檢查管理員權限
    const { data: profile } = await locals.supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

    if (!profile?.is_admin) {
        throw redirect(303, '/');
    }

    // 取得所有使用者 Profile
    const { data: users, error } = await locals.supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching users:', error);
    }

    // 取得所有可用作核准人的清單 (通常是管理員或財務，或是所有人，依據業務規則)
    // 這裡我們假設所有人都可以被指派為核准人
    const { data: allUsers } = await locals.supabase
        .from('profiles')
        .select('id, full_name');

    return {
        users: users || [],
        approverOptions: allUsers || []
    };
};

export const actions: Actions = {
    updateUserPermissions: async ({ request, locals }) => {
        const formData = await request.formData();
        const userId = formData.get('userId') as string;
        const field = formData.get('field') as string;
        const value = formData.get('value') === 'true';

        if (!userId || !field) return fail(400, { message: '缺少必要參數' });

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
