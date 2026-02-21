import { error, redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { triggerNotificationDrain } from '$lib/server/notifications/qstash-trigger';

async function queueNotificationDrain(origin: string, reason: string): Promise<void> {
    try {
        await triggerNotificationDrain({ origin, reason });
    } catch (drainError) {
        console.error('[notify:qstash] trigger failed:', reason, drainError);
    }
}

export const load: PageServerLoad = async ({ params, locals: { supabase, getSession } }) => {
    const session = await getSession();
    if (!session) throw redirect(303, '/auth');

    const { id } = params;

    const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select(`
            *,
            paid_by_profile:profiles!payments_paid_by_fkey(full_name)
        `)
        .eq('id', id)
        .single();

    if (paymentError || !payment) {
        throw error(404, '找不到此付款單');
    }

    // Fetch related claims
    const { data: claims } = await supabase
        .from('claims')
        .select(`
            *,
            applicant:profiles!claims_applicant_id_fkey(full_name)
        `)
        .eq('payment_id', id);

    return {
        payment,
        claims: claims || []
    };
};

export const actions: Actions = {
    cancelPayment: async ({ request, params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: '尚未登入' });

        const { data: profile } = await supabase
            .from('profiles')
            .select('is_finance, is_admin')
            .eq('id', session.user.id)
            .single();
        if (!profile?.is_finance && !profile?.is_admin) {
            return fail(403, { message: '權限不足：僅財務或管理員可執行沖帳' });
        }

        const { id } = params;

        // 1. 取得付款單狀態
        const { data: payment, error: fetchError } = await supabase
            .from('payments')
            .select('status')
            .eq('id', id)
            .single();

        if (fetchError || !payment) return fail(404, { message: '找不到此付款單' });
        if (payment.status === 'cancelled') return fail(400, { message: '此付款單已沖帳' });

        // 2. 更新付款單為已取消
        const { error: updatePaymentError } = await supabase
            .from('payments')
            .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString()
            })
            .eq('id', id);

        if (updatePaymentError) return fail(500, { message: '付款單狀態更新失敗' });

        // 3. 回滾相關請款單狀態
        const { error: updateClaimsError } = await supabase
            .from('claims')
            .update({
                status: 'pending_payment' as any,
                payment_id: null,
                updated_at: new Date().toISOString()
            })
            .eq('payment_id', id);

        if (updateClaimsError) {
            console.error('Claims Rollback Error:', updateClaimsError);
            return fail(500, { message: '請款單狀態回滾失敗' });
        }

        await queueNotificationDrain(new URL(request.url).origin, 'payment.cancel');

        throw redirect(303, `/payments/${id}`);
    }
};
