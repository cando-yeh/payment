import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { getExpenseCategories } from '$lib/server/expense-categories';

function getServiceRoleClient() {
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY 未設定');
    }
    return createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

async function getUserReferenceSummary(userId: string) {
    const serviceRoleClient = getServiceRoleClient();
    const [
        claimsRes,
        paymentsRes,
        historyRes,
        requestedRes,
        reviewedRes,
        subordinateRes
    ] = await Promise.all([
        serviceRoleClient.from('claims').select('*', { count: 'exact', head: true }).eq('applicant_id', userId),
        serviceRoleClient.from('payments').select('*', { count: 'exact', head: true }).eq('paid_by', userId),
        serviceRoleClient.from('claim_history').select('*', { count: 'exact', head: true }).eq('actor_id', userId),
        serviceRoleClient.from('payee_change_requests').select('*', { count: 'exact', head: true }).eq('requested_by', userId),
        serviceRoleClient.from('payee_change_requests').select('*', { count: 'exact', head: true }).eq('reviewed_by', userId),
        serviceRoleClient.from('profiles').select('*', { count: 'exact', head: true }).eq('approver_id', userId)
    ]);

    const firstError = [
        claimsRes.error,
        paymentsRes.error,
        historyRes.error,
        requestedRes.error,
        reviewedRes.error,
        subordinateRes.error
    ].find(Boolean);

    if (firstError) {
        throw firstError;
    }

    return {
        claims: claimsRes.count || 0,
        payments: paymentsRes.count || 0,
        claimHistory: historyRes.count || 0,
        payeeRequested: requestedRes.count || 0,
        payeeReviewed: reviewedRes.count || 0,
        subordinateUsers: subordinateRes.count || 0
    };
}

export const load: PageServerLoad = async ({ locals, url }) => {
    const session = await locals.getSession();
    if (!session) throw redirect(303, '/auth');

    // 🔒 管理頁入口：允許 admin 與 finance 檢視
    const canViewUserModule = Boolean(locals.user?.is_admin || locals.user?.is_finance);
    if (!canViewUserModule) {
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

    const status = url.searchParams.get('status');
    const defaultTab = status === 'inactive' ? 'inactive' : 'active';
    const section = url.searchParams.get('section');
    const defaultSection = section === 'categories' ? 'categories' : 'users';

    return {
        users: users || [],
        expenseCategories: await getExpenseCategories(locals.supabase),
        approverOptions: (users || []).map((u: any) => ({ id: u.id, full_name: u.full_name })),
        defaultTab,
        defaultSection,
        currentUserId: session.user.id,
        canManagePermissions: locals.user?.is_admin ?? false,
        canManageLifecycle: locals.user?.is_admin ?? false,
        canManageProfileBasic: canViewUserModule,
        canManageCategories: locals.user?.is_finance ?? false,
        isAdminViewer: locals.user?.is_admin ?? false,
        isFinanceViewer: locals.user?.is_finance ?? false
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

        const session = await locals.getSession();
        const currentUserId = session?.user?.id;
        if (field === 'is_admin' && userId === currentUserId && value === false) {
            return fail(400, { message: '不可移除自己的管理員權限' });
        }

        const { data: profile } = await locals.supabase
            .from('profiles')
            .select('is_active')
            .eq('id', userId)
            .maybeSingle();
        if (profile && profile.is_active === false) {
            return fail(400, { message: '停用帳號不可調整權限，請先啟用。' });
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
        const approverIdRaw = formData.get('approverId');
        const approverId = typeof approverIdRaw === 'string' ? approverIdRaw.trim() : '';

        if (!userId) return fail(400, { message: '缺少必要參數' });
        if (!approverId) return fail(400, { message: '核准人為必填，不能為空' });

        const { data: targetUser } = await locals.supabase
            .from('profiles')
            .select('is_active')
            .eq('id', userId)
            .maybeSingle();
        if (targetUser && targetUser.is_active === false) {
            return fail(400, { message: '停用帳號不可指派核准人，請先啟用。' });
        }

        if (approverId) {
            const { data: approverUser } = await locals.supabase
                .from('profiles')
                .select('is_active')
                .eq('id', approverId)
                .maybeSingle();
            if (approverUser && approverUser.is_active === false) {
                return fail(400, { message: '不可指派停用中的核准人。' });
            }
        }

        const { error } = await locals.supabase
            .from('profiles')
            .update({ approver_id: approverId })
            .eq('id', userId);

        if (error) {
            return fail(500, { message: '指派失敗', error: error.message });
        }

        return { success: true };
    },

    deactivateUser: async ({ request, locals }) => {
        if (!locals.user?.is_admin) {
            return fail(403, { message: '權限不足：僅管理員可執行此操作' });
        }

        const formData = await request.formData();
        const userId = formData.get('userId');
        if (typeof userId !== 'string' || !userId.trim()) {
            return fail(400, { message: '缺少必要參數' });
        }

        const session = await locals.getSession();
        if (session?.user?.id === userId) {
            return fail(400, { message: '無法停用：您不能停用目前的登入帳號' });
        }

        const { error: clearApproverRefError } = await locals.supabase
            .from('profiles')
            .update({ approver_id: null })
            .eq('approver_id', userId);
        if (clearApproverRefError) {
            return fail(500, { message: '停用失敗：無法清理核准人關聯', error: clearApproverRefError.message });
        }

        const { error } = await locals.supabase
            .from('profiles')
            .update({
                is_active: false,
                deactivated_at: new Date().toISOString(),
                deactivated_by: session?.user?.id || null,
                is_admin: false,
                is_finance: false,
                approver_id: null
            })
            .eq('id', userId);

        if (error) {
            return fail(500, { message: `停用失敗：${error.message}` });
        }

        return { success: true, message: '使用者已停用' };
    },

    reactivateUser: async ({ request, locals }) => {
        if (!locals.user?.is_admin) {
            return fail(403, { message: '權限不足：僅管理員可執行此操作' });
        }

        const formData = await request.formData();
        const userId = formData.get('userId');
        if (typeof userId !== 'string' || !userId.trim()) {
            return fail(400, { message: '缺少必要參數' });
        }

        const { error } = await locals.supabase
            .from('profiles')
            .update({
                is_active: true,
                deactivated_at: null,
                deactivated_by: null
            })
            .eq('id', userId);

        if (error) {
            return fail(500, { message: `啟用失敗：${error.message}` });
        }

        return { success: true, message: '使用者已重新啟用' };
    },

    removeUser: async ({ request, locals }) => {
        // 🔒 權限驗證：僅管理員可刪除使用者
        if (!locals.user?.is_admin) {
            return fail(403, { message: '權限不足：僅管理員可執行此操作' });
        }

        const formData = await request.formData();
        const userId = formData.get('userId');

        if (typeof userId !== 'string' || !userId.trim()) {
            return fail(400, { message: '缺少必要參數' });
        }

        // 🛡️ 禁止自刪 (防止管理員把自己關在門外)
        const session = await locals.getSession();
        if (session?.user?.id === userId) {
            return fail(400, { message: '無法刪除：您不能刪除目前的登入帳號' });
        }

        let refSummary: Awaited<ReturnType<typeof getUserReferenceSummary>>;
        try {
            refSummary = await getUserReferenceSummary(userId);
        } catch (e: any) {
            return fail(500, { message: `刪除失敗：無法檢查使用者關聯 (${e?.message || '未知錯誤'})` });
        }

        const hasAnyReference = Object.values(refSummary).some((v) => v > 0);
        if (hasAnyReference) {
            if (refSummary.claims > 0 || refSummary.payments > 0) {
                return fail(409, {
                    message: '此使用者已有歷史請款/付款紀錄，僅可停用以保留稽核軌跡。'
                });
            }

            return fail(409, {
                message: '此使用者仍有系統關聯資料，請先清理關聯或改用停用。'
            });
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

        let serviceRoleClient;
        try {
            serviceRoleClient = getServiceRoleClient();
        } catch (e: any) {
            return fail(500, { message: `永久刪除失敗：${e?.message || '缺少 Service Role 設定'}` });
        }

        const { error: authDeleteError } = await serviceRoleClient.auth.admin.deleteUser(userId);
        if (authDeleteError) {
            return fail(500, {
                message: `已刪除系統資料，但無法刪除登入帳號：${authDeleteError.message}`
            });
        }

        return { success: true, message: '使用者已永久刪除' };
    },

    updateUserProfile: async ({ request, locals }) => {
        // 🔒 權限驗證：admin/finance 可更新（欄位範圍不同）
        const isAdmin = Boolean(locals.user?.is_admin);
        const isFinance = Boolean(locals.user?.is_finance);
        if (!isAdmin && !isFinance) {
            return fail(403, { message: '權限不足：僅管理員或財務可執行此操作' });
        }

        const formData = await request.formData();
        const userId = formData.get('userId') as string;
        const fullNameRaw = formData.get('fullName');
        const bankNameRaw = formData.get('bankName');
        const bankAccountRaw = formData.get('bankAccount');
        const nextIsAdmin = formData.get('isAdminValue') === 'true';
        const nextIsFinance = formData.get('isFinanceValue') === 'true';
        const approverIdRaw = formData.get('approverId');
        const approverId = typeof approverIdRaw === 'string' ? approverIdRaw.trim() : '';

        if (!userId) return fail(400, { message: '缺少使用者 ID' });

        const fullName = typeof fullNameRaw === 'string' ? fullNameRaw.trim() : '';
        const bankName = typeof bankNameRaw === 'string' ? bankNameRaw.trim() : '';
        const bankAccount = typeof bankAccountRaw === 'string' ? bankAccountRaw.trim() : '';

        if (!approverId) {
            return fail(400, { message: '核准人為必填，不能為空' });
        }

        const serviceRoleClient = getServiceRoleClient();
        const { data: currentProfile, error: currentProfileError } = await serviceRoleClient
            .from('profiles')
            .select('id, full_name, bank, bank_account_tail')
            .eq('id', userId)
            .maybeSingle();

        if (currentProfileError || !currentProfile) {
            return fail(404, { message: '找不到使用者資料，請重新整理後再試。' });
        }

        // 銀行欄位驗證：僅在「有提供新銀行帳號」時才強制要求銀行代碼
        if (bankAccount && !bankName && !String(currentProfile.bank || '').trim()) {
            return fail(400, { message: '新增銀行帳號時，銀行代碼為必填' });
        }

        const effectiveBank = bankName || String(currentProfile.bank || '').trim();

        const updatePayload: Record<string, any> = {
            approver_id: approverId
        };

        // 管理模組可更新目標使用者姓名（admin/finance 皆可）
        const session = await locals.getSession();
        const currentUserId = session?.user?.id;
        if (isAdmin && userId === currentUserId && !nextIsAdmin) {
            return fail(400, { message: '不可移除自己的管理員權限' });
        }

        if (fullName) {
            updatePayload.full_name = fullName;
        }

        if (effectiveBank) {
            updatePayload.bank = effectiveBank;
        }

        if (isAdmin) {
            updatePayload.is_admin = nextIsAdmin;
            updatePayload.is_finance = nextIsFinance;
        }

        // 1. 更新基本資料與權限
        // 使用 service role 繞過 profiles RLS，實際授權由上方 admin/finance 邏輯控管。
        const { data: updatedRow, error: updateError } = await serviceRoleClient
            .from('profiles')
            .update(updatePayload)
            .eq('id', userId)
            .select('id')
            .maybeSingle();

        if (updateError) {
            return fail(500, { message: '更新基本資料失敗', error: updateError.message });
        }
        if (!updatedRow) {
            return fail(403, { message: '更新未生效：請確認權限或資料狀態後再試。' });
        }

        // 1-1. 同步更新 auth metadata，避免依賴 user_metadata 的頁面顯示舊名稱
        if (fullName) {
            const { error: authUpdateError } = await serviceRoleClient.auth.admin.updateUserById(userId, {
                user_metadata: { full_name: fullName, name: fullName }
            });
            if (authUpdateError) {
                console.warn('Failed to sync auth metadata full_name:', authUpdateError.message);
            }
        }

        // 2. 處理銀行帳號更新 (敏感資料加密路徑)
        if (bankAccount) {
            const { error: cryptoError } = await locals.supabase.rpc('update_profile_bank_account', {
                target_id: userId,
                raw_account: bankAccount
            });

            if (cryptoError) {
                console.error('Crypto error:', cryptoError);
                return fail(500, { message: '銀行帳號加密儲存失敗', error: cryptoError.message });
            }
        }

        return { success: true };
    },

    revealUserBankAccount: async ({ request, locals }) => {
        // 🔒 權限驗證：admin/finance 可查看（細節由 RPC 驗證）
        if (!locals.user?.is_admin && !locals.user?.is_finance) {
            return fail(403, { message: '權限不足：僅管理員或財務可執行此操作' });
        }

        const formData = await request.formData();
        const targetId = formData.get('targetId') as string;

        if (!targetId) return fail(400, { message: '缺少目標使用者 ID' });

        const { data, error } = await locals.supabase.rpc('reveal_profile_bank_account', {
            target_id: targetId
        });

        if (error) {
            console.error('Reveal error:', error);
            return fail(500, { message: '無法讀取帳號資訊', error: error.message });
        }

        return { success: true, decryptedAccount: data };
    },

    getUserProfileSnapshot: async ({ request, locals }) => {
        if (!locals.user?.is_admin && !locals.user?.is_finance) {
            return fail(403, { message: '權限不足：僅管理員或財務可執行此操作' });
        }

        const formData = await request.formData();
        const targetId = formData.get('targetId') as string;
        if (!targetId) return fail(400, { message: '缺少目標使用者 ID' });

        const { data, error } = await locals.supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url, is_admin, is_finance, approver_id, bank, bank_account_tail')
            .eq('id', targetId)
            .single();

        if (error || !data) {
            return fail(500, { message: '讀取使用者資料失敗', error: error?.message });
        }

        return { success: true, profile: data };
    },

    createExpenseCategory: async ({ request, locals }) => {
        if (!locals.user?.is_finance) {
            return fail(403, { message: '權限不足：僅財務可管理費用類別' });
        }

        const formData = await request.formData();
        const name = String(formData.get('name') || '').trim();
        const description = String(formData.get('description') || '').trim();
        if (!name) return fail(400, { message: '請輸入費用類別名稱' });
        if (!description) return fail(400, { message: '請輸入適用情境說明' });

        const { error } = await locals.supabase.from('expense_categories').insert({
            name,
            description,
            is_active: true
        });
        if (error) {
            if (error.code === '23505') {
                return fail(409, { message: '此費用類別已存在' });
            }
            return fail(500, { message: '新增費用類別失敗', error: error.message });
        }

        return { success: true };
    },

    toggleExpenseCategory: async ({ request, locals }) => {
        if (!locals.user?.is_finance) {
            return fail(403, { message: '權限不足：僅財務可管理費用類別' });
        }

        const formData = await request.formData();
        const id = String(formData.get('id') || '').trim();
        const isActive = String(formData.get('is_active') || '') === 'true';
        if (!id) return fail(400, { message: '缺少費用類別 ID' });

        const { error } = await locals.supabase
            .from('expense_categories')
            .update({ is_active: isActive })
            .eq('id', id);
        if (error) {
            return fail(500, { message: '更新費用類別狀態失敗', error: error.message });
        }

        return { success: true };
    },

    deleteExpenseCategory: async ({ request, locals }) => {
        if (!locals.user?.is_finance) {
            return fail(403, { message: '權限不足：僅財務可管理費用類別' });
        }

        const formData = await request.formData();
        const id = String(formData.get('id') || '').trim();
        if (!id) return fail(400, { message: '缺少費用類別 ID' });

        const { data: category, error: categoryError } = await locals.supabase
            .from('expense_categories')
            .select('id, name')
            .eq('id', id)
            .single();
        if (categoryError || !category) {
            return fail(404, { message: '找不到費用類別' });
        }

        const { count, error: referenceError } = await locals.supabase
            .from('claim_items')
            .select('id', { head: true, count: 'exact' })
            .eq('category', String(category.name));
        if (referenceError) {
            return fail(500, { message: '檢查類別關聯失敗', error: referenceError.message });
        }
        if ((count || 0) > 0) {
            return fail(409, { message: '此費用類別已被請款明細使用，無法刪除' });
        }

        const { error } = await locals.supabase
            .from('expense_categories')
            .delete()
            .eq('id', id);
        if (error) {
            return fail(500, { message: '刪除費用類別失敗', error: error.message });
        }

        return { success: true };
    }
};
