import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type ClaimItemInput = {
    date?: string;
    category?: string;
    description?: string;
    amount?: number | string;
    invoice_number?: string;
    extra?: Record<string, unknown>;
};

function normalizeItems(itemsRaw: string): ClaimItemInput[] | null {
    try {
        const parsed = JSON.parse(itemsRaw);
        if (!Array.isArray(parsed)) return null;
        return parsed;
    } catch {
        return null;
    }
}

export const load: PageServerLoad = async ({ locals: { supabase, getSession } }) => {
    const session = await getSession();
    if (!session) {
        throw redirect(303, '/auth');
    }

    const { data: payees, error } = await supabase
        .from('payees')
        .select('id, name, type, tax_id')
        .eq('status', 'available')
        .order('name');

    if (error) {
        console.error('Error fetching payees:', error);
        return { payees: [] };
    }

    return { payees };
};

export const actions: Actions = {
    create: async ({ request, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const formData = await request.formData();
        const claimType = String(formData.get('claim_type') || '');
        const payeeId = String(formData.get('payee_id') || '');
        const itemsJson = String(formData.get('items') || '');

        const isFloatingAccount = formData.get('is_floating_account') === 'true';
        const bankCode = String(formData.get('bank_code') || '').trim();
        const bankBranch = String(formData.get('bank_branch') || '').trim();
        const accountName = String(formData.get('account_name') || '').trim();
        const bankAccount = String(formData.get('bank_account') || '').trim();

        if (!claimType || !itemsJson) {
            return fail(400, { message: 'Missing required fields' });
        }

        const allowedTypes = new Set(['employee', 'vendor', 'personal_service']);
        if (!allowedTypes.has(claimType)) {
            return fail(400, { message: 'Invalid claim type' });
        }

        const items = normalizeItems(itemsJson);
        if (!items || items.length === 0) {
            return fail(400, { message: 'At least one item is required' });
        }

        const claimItems = items.map((item, index) => {
            const amount = Number(item.amount);
            return {
                claim_id: '',
                item_index: index + 1,
                date_start: item.date || new Date().toISOString().slice(0, 10),
                date_end: null,
                category: (item.category || 'general').trim(),
                description: String(item.description || '').trim(),
                amount,
                invoice_number: item.invoice_number || null,
                attachment_status: 'pending_supplement',
                extra: item.extra || {}
            };
        });

        if (claimItems.some((item) => !Number.isFinite(item.amount) || item.amount <= 0)) {
            return fail(400, { message: 'All item amounts must be greater than 0' });
        }

        const totalAmount = claimItems.reduce((sum, item) => sum + item.amount, 0);

        let normalizedPayeeId: string | null = null;
        if (claimType !== 'employee') {
            if (!payeeId) {
                return fail(400, { message: 'Payee is required for this claim type' });
            }
            normalizedPayeeId = payeeId;
        }

        if (isFloatingAccount && claimType === 'employee') {
            return fail(400, { message: 'Employee claim cannot use floating account' });
        }

        if (isFloatingAccount && (!bankCode || !accountName || !bankAccount)) {
            return fail(400, { message: 'Missing required bank information for floating account' });
        }

        const { data: claimId, error: claimError } = await supabase.rpc('create_claim', {
            _claim_type: claimType,
            _applicant_id: session.user.id,
            _payee_id: normalizedPayeeId,
            _total_amount: totalAmount,
            _bank_code: isFloatingAccount ? bankCode : null,
            _bank_branch: isFloatingAccount ? (bankBranch || null) : null,
            _bank_account: isFloatingAccount ? bankAccount : null,
            _account_name: isFloatingAccount ? accountName : null
        });

        if (claimError || !claimId) {
            console.error('Error creating claim:', claimError);
            return fail(500, { message: 'Failed to create claim' });
        }

        const { error: itemsError } = await supabase
            .from('claim_items')
            .insert(claimItems.map((item) => ({ ...item, claim_id: claimId })));

        if (itemsError) {
            console.error('Error creating claim items:', itemsError);
            return fail(500, { message: 'Failed to create claim items' });
        }

        throw redirect(303, `/claims/${claimId}`);
    }
};
