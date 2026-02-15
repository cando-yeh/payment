import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type ClaimItemInput = {
    date?: string;
    date_start?: string;
    category?: string;
    description?: string;
    amount?: number | string;
    invoice_number?: string;
    extra?: Record<string, unknown>;
};

function parseItems(value: string): ClaimItemInput[] | null {
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export const load: PageServerLoad = async ({ params, locals: { supabase, getSession } }) => {
    const session = await getSession();
    if (!session) {
        throw redirect(303, '/auth');
    }

    const { id } = params;

    const { data: claimData, error: claimError } = await supabase
        .rpc('get_claim_detail', { _claim_id: id })
        .single();

    const claim = claimData as any;
    if (claimError || !claim || claim.applicant_id !== session.user.id) {
        throw redirect(303, '/claims');
    }

    if (!['draft', 'returned'].includes(claim.status)) {
        throw redirect(303, `/claims/${id}`);
    }

    const { data: payees, error: payeesError } = await supabase
        .from('payees')
        .select('id, name, type')
        .eq('status', 'available')
        .order('name');

    if (payeesError) {
        console.error('Error fetching payees:', payeesError);
    }

    return {
        claim,
        payees: payees || []
    };
};

export const actions: Actions = {
    update: async ({ request, params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) {
            return fail(401, { error: 'Unauthorized' });
        }

        const { data: claimRow, error: claimFetchError } = await supabase
            .from('claims')
            .select('id, applicant_id, claim_type, status')
            .eq('id', params.id)
            .eq('applicant_id', session.user.id)
            .single();

        if (claimFetchError || !claimRow) {
            return fail(404, { error: 'Claim not found' });
        }

        if (!['draft', 'returned'].includes(claimRow.status)) {
            return fail(400, { error: 'Only draft or returned claims can be edited' });
        }

        const formData = await request.formData();
        const payee_id = String(formData.get('payee_id') || '');
        const is_floating = formData.get('is_floating') === 'on';
        const bank_code = is_floating ? String(formData.get('bank_code') || '').trim() : null;
        const bank_branch = is_floating ? String(formData.get('bank_branch') || '').trim() : null;
        const bank_account = is_floating ? String(formData.get('bank_account') || '').trim() : null;
        const account_name = is_floating ? String(formData.get('account_name') || '').trim() : null;
        const itemsJson = String(formData.get('items') || '[]');

        if (claimRow.claim_type !== 'employee' && !payee_id) {
            return fail(400, { error: 'Payee is required' });
        }

        if (is_floating) {
            if (!bank_code || !account_name || !bank_account) {
                return fail(400, { error: 'Floating account details are incomplete' });
            }
        }

        const parsedItems = parseItems(itemsJson);
        if (!parsedItems || parsedItems.length === 0) {
            return fail(400, { error: 'At least one item is required' });
        }

        const normalizedItems = parsedItems.map((item, index) => {
            const amount = Number(item.amount);
            return {
                claim_id: params.id,
                item_index: index + 1,
                date_start: item.date || item.date_start || new Date().toISOString().slice(0, 10),
                date_end: null,
                category: String(item.category || 'general').trim(),
                description: String(item.description || '').trim(),
                amount,
                invoice_number: item.invoice_number || null,
                attachment_status: 'pending_supplement',
                extra: item.extra || {}
            };
        });

        if (normalizedItems.some((item) => !Number.isFinite(item.amount) || item.amount <= 0)) {
            return fail(400, { error: 'All item amounts must be greater than 0' });
        }

        const totalAmount = normalizedItems.reduce((sum, item) => sum + item.amount, 0);

        const { error: updateClaimError } = await supabase.rpc('update_claim', {
            _claim_id: params.id,
            _payee_id: claimRow.claim_type === 'employee' ? null : payee_id,
            _total_amount: totalAmount,
            _bank_code: is_floating ? bank_code : null,
            _bank_branch: is_floating ? (bank_branch || null) : null,
            _bank_account: is_floating ? bank_account : null,
            _account_name: is_floating ? account_name : null
        });

        if (updateClaimError) {
            console.error('Error updating claim:', updateClaimError);
            return fail(500, { error: 'Failed to update claim' });
        }

        const { error: deleteItemsError } = await supabase
            .from('claim_items')
            .delete()
            .eq('claim_id', params.id);

        if (deleteItemsError) {
            console.error('Error clearing claim items:', deleteItemsError);
            return fail(500, { error: 'Failed to update claim items' });
        }

        const { error: insertItemsError } = await supabase
            .from('claim_items')
            .insert(normalizedItems);

        if (insertItemsError) {
            console.error('Error inserting claim items:', insertItemsError);
            return fail(500, { error: 'Failed to update claim items' });
        }

        throw redirect(303, `/claims/${params.id}/edit`);
    },

    submit: async ({ request, params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) {
            return fail(401, { error: 'Unauthorized' });
        }

        const { data: claimRow, error: claimFetchError } = await supabase
            .from('claims')
            .select('id, applicant_id, claim_type, status')
            .eq('id', params.id)
            .eq('applicant_id', session.user.id)
            .single();

        if (claimFetchError || !claimRow) {
            return fail(404, { error: 'Claim not found' });
        }

        if (!['draft', 'returned'].includes(claimRow.status)) {
            return fail(400, { error: 'Only draft or returned claims can be submitted' });
        }

        const formData = await request.formData();
        const payee_id = String(formData.get('payee_id') || '');
        const is_floating = formData.get('is_floating') === 'on';
        const bank_code = is_floating ? String(formData.get('bank_code') || '').trim() : null;
        const bank_branch = is_floating ? String(formData.get('bank_branch') || '').trim() : null;
        const bank_account = is_floating ? String(formData.get('bank_account') || '').trim() : null;
        const account_name = is_floating ? String(formData.get('account_name') || '').trim() : null;
        const itemsJson = String(formData.get('items') || '[]');

        if (claimRow.claim_type !== 'employee' && !payee_id) {
            return fail(400, { error: 'Payee is required' });
        }

        if (is_floating) {
            if (!bank_code || !account_name || !bank_account) {
                return fail(400, { error: 'Floating account details are incomplete' });
            }
        }

        const parsedItems = parseItems(itemsJson);
        if (!parsedItems || parsedItems.length === 0) {
            return fail(400, { error: 'At least one item is required' });
        }

        const normalizedItems = parsedItems.map((item, index) => {
            const amount = Number(item.amount);
            return {
                claim_id: params.id,
                item_index: index + 1,
                date_start: item.date || item.date_start || new Date().toISOString().slice(0, 10),
                date_end: null,
                category: String(item.category || 'general').trim(),
                description: String(item.description || '').trim(),
                amount,
                invoice_number: item.invoice_number || null,
                attachment_status: 'pending_supplement',
                extra: item.extra || {}
            };
        });

        if (normalizedItems.some((item) => !Number.isFinite(item.amount) || item.amount <= 0)) {
            return fail(400, { error: 'All item amounts must be greater than 0' });
        }

        const totalAmount = normalizedItems.reduce((sum, item) => sum + item.amount, 0);

        const { error: updateClaimError } = await supabase.rpc('update_claim', {
            _claim_id: params.id,
            _payee_id: claimRow.claim_type === 'employee' ? null : payee_id,
            _total_amount: totalAmount,
            _bank_code: is_floating ? bank_code : null,
            _bank_branch: is_floating ? (bank_branch || null) : null,
            _bank_account: is_floating ? bank_account : null,
            _account_name: is_floating ? account_name : null
        });

        if (updateClaimError) {
            console.error('Error updating claim:', updateClaimError);
            return fail(500, { error: 'Failed to update claim' });
        }

        const { error: deleteItemsError } = await supabase
            .from('claim_items')
            .delete()
            .eq('claim_id', params.id);

        if (deleteItemsError) {
            console.error('Error clearing claim items:', deleteItemsError);
            return fail(500, { error: 'Failed to update claim items' });
        }

        const { error: insertItemsError } = await supabase
            .from('claim_items')
            .insert(normalizedItems);

        if (insertItemsError) {
            console.error('Error inserting claim items:', insertItemsError);
            return fail(500, { error: 'Failed to update claim items' });
        }

        const { data: applicantProfile, error: profileError } = await supabase
            .from('profiles')
            .select('approver_id')
            .eq('id', claimRow.applicant_id)
            .single();

        if (profileError) {
            return fail(500, { error: '讀取申請人資料失敗' });
        }
        if (!applicantProfile?.approver_id) {
            return fail(400, { error: '您尚未指派核准人，請聯繫管理員進行設定。' });
        }

        const nowIso = new Date().toISOString();
        const { data: updatedClaim, error: submitError } = await supabase
            .from('claims')
            .update({
                status: 'pending_manager',
                submitted_at: nowIso,
                updated_at: nowIso
            })
            .eq('id', params.id)
            .eq('applicant_id', session.user.id)
            .in('status', ['draft', 'returned'])
            .select('id')
            .maybeSingle();

        if (submitError) {
            return fail(500, { error: '提交失敗' });
        }
        if (!updatedClaim) {
            return fail(409, { error: '請款單狀態已變更，請重新整理後再試' });
        }

        throw redirect(303, '/claims?tab=processing');
    }
};
