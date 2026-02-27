import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { triggerNotificationDrain } from '$lib/server/notifications/qstash-trigger';

async function queueNotificationDrain(origin: string, reason: string): Promise<void> {
    try {
        await triggerNotificationDrain({ origin, reason });
    } catch (drainError) {
        console.error('[notify:qstash] trigger failed:', reason, drainError);
    }
}

export const load: PageServerLoad = async ({ locals: { supabase, getSession } }) => {
    const session = await getSession();
    if (!session) {
        throw redirect(303, '/auth');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_finance, is_admin')
        .eq('id', session.user.id)
        .single();

    const isFinance = profile?.is_finance || false;
    const isAdmin = profile?.is_admin || false;

    // 1. Pending Manager Review (Current user is the approver)
    const { data: pendingManager } = await supabase
        .from('claims')
        .select(`
            *,
            applicant:profiles!claims_applicant_id_fkey!inner(full_name, email, approver_id),
            payee:payees(name)
        `)
        .eq('status', 'pending_manager')
        .eq('applicant.approver_id', session.user.id);

    // 2. Pending Finance Review (User is finance staff)
    let pendingFinance = [];
    let pendingPayment = [];
    let pendingDocReview = [];

    if (isFinance || isAdmin) {
        const { data: pf } = await supabase
            .from('claims')
            .select('*, applicant:profiles!claims_applicant_id_fkey(full_name, email), payee:payees(name)')
            .eq('status', 'pending_finance');
        pendingFinance = pf || [];

        const { data: pp } = await supabase
            .from('claims')
            .select('*, applicant:profiles!claims_applicant_id_fkey(full_name, email), payee:payees(name)')
            .eq('status', 'pending_payment');
        pendingPayment = pp || [];

        const { data: pdr } = await supabase
            .from('claims')
            .select('*, applicant:profiles!claims_applicant_id_fkey(full_name, email), payee:payees(name)')
            .eq('status', 'pending_doc_review');
        pendingDocReview = pdr || [];
    }

    // 3. Approved By Me (User acted as manager and approved it before)
    // We use a query with an inner join on claim_history to find historical approvals.
    const { data: approvedRaw } = await supabase
        .from('claims')
        .select(`
            *,
            applicant:profiles!claims_applicant_id_fkey(full_name, email),
            payee:payees(name),
            history:claim_history!inner(actor_id, action, from_status)
        `)
        .eq('history.actor_id', session.user.id)
        .eq('history.action', 'approve_manager')
        .eq('history.from_status', 'pending_manager')
        .order('created_at', { ascending: false });

    // Deduplicate in case a claim went through the manager step multiple times
    let approvedByMe = [];
    if (approvedRaw) {
        const seen = new Set();
        for (const claim of approvedRaw) {
            if (!seen.has(claim.id)) {
                seen.add(claim.id);
                // Strip the history array so it doesn't leak or clutter the frontend
                const { history, ...cleanClaim } = claim;
                approvedByMe.push(cleanClaim);
            }
        }
    }

    return {
        pendingManager: pendingManager || [],
        pendingFinance,
        pendingPayment,
        pendingDocReview,
        approvedByMe,
        userRole: { isFinance, isAdmin }
    };
};

export const actions: Actions = {
    /**
     * 批次撥款 Action
     */
    batchPay: async ({ request, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: '尚未登入' });

        const { data: profile } = await supabase
            .from('profiles')
            .select('is_finance, is_admin')
            .eq('id', session.user.id)
            .single();
        if (!profile?.is_finance && !profile?.is_admin) {
            return fail(403, { message: '權限不足：僅財務或管理員可執行撥款' });
        }

        const formData = await request.formData();
        const claimIds = formData.getAll('claimIds') as string[];
        const paymentDate = formData.get('paymentDate') as string;

        if (!claimIds.length) {
            return fail(400, { message: '請至少選擇一筆單據' });
        }

        // 1. 取得單據詳情以驗證與彙整
        const { data: claims, error: fetchError } = await supabase
            .from('claims')
            .select(`
                *,
                applicant:profiles!claims_applicant_id_fkey(full_name, bank_account, bank),
                payee:payees(name, bank_account, bank)
            `)
            .in('id', claimIds);

        if (fetchError || !claims) {
            return fail(500, { message: '讀取請款單失敗' });
        }

        // 2. 驗證一致性
        if (claims.some((c: any) => c.status !== 'pending_payment')) {
            return fail(400, { message: '部分選取單據狀態非待撥款' });
        }

        const first = claims[0];
        const firstPayeeId = first.payee_id || first.applicant_id;

        if (claims.some((c: any) => (c.payee_id || c.applicant_id) !== firstPayeeId)) {
            return fail(400, { message: '批次付款僅限同一收款人' });
        }

        // 3. 準備付款單資料 (Snapshot)
        const totalAmount = claims.reduce((sum: number, c: any) => sum + Number(c.total_amount), 0);
        const payeeName = first.claim_type === 'employee' ? first.applicant?.full_name : first.payee?.name;
        const bankAccount = first.claim_type === 'employee' ? first.applicant?.bank_account : first.payee?.bank_account;
        const bank = first.claim_type === 'employee' ? first.applicant?.bank : first.payee?.bank;
        const paidAt = paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString();

        // 4. 建立付款單
        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .insert({
                payee_id: firstPayeeId,
                payee_name: payeeName,
                total_amount: totalAmount,
                bank_account: bankAccount,
                bank: bank,
                paid_by: session.user.id,
                paid_at: paidAt,
                status: 'completed'
            })
            .select()
            .single();

        if (paymentError || !payment) {
            console.error('Batch Pay Error:', paymentError);
            return fail(500, { message: '付款單建立失敗' });
        }

        // 5. 更新請款單狀態與關聯
        const now = new Date().toISOString();
        const updatePromises = claims.map((c: any) => {
            const nextStatus = c.pay_first_patch_doc ? 'paid_pending_doc' : 'paid';
            return supabase
                .from('claims')
                .update({
                    status: nextStatus as any,
                    payment_id: payment.id,
                    updated_at: now
                })
                .eq('id', c.id)
                .select('id')
                .maybeSingle();
        });

        const updateResults = await Promise.all(updatePromises);
        const hasUpdateError = updateResults.some((result) => result.error || !result.data);
        if (hasUpdateError) {
            console.error('Batch Pay Claim Update Errors:', updateResults);
            return fail(500, { message: '請款單狀態更新失敗' });
        }

        await queueNotificationDrain(new URL(request.url).origin, 'claim.pay');

        return { success: true, paymentId: payment.id };
    }
};
