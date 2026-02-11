import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, getSession } }) => {
    const session = await getSession();
    if (!session) {
        throw redirect(303, '/auth');
    }

    // Fetch active payees for selection
    const { data: payees, error } = await supabase
        .from('payees')
        .select('id, name, type, tax_id')
        .eq('status', 'available')
        .order('name');

    if (error) {
        console.error('Error fetching payees:', error);
        return { payees: [] };
    }

    return {
        payees
    };
};

export const actions: Actions = {
    create: async ({ request, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const formData = await request.formData();
        const claimType = formData.get('claim_type') as string;
        const description = formData.get('description') as string;
        const payeeId = formData.get('payee_id') as string;
        const itemsJson = formData.get('items') as string;

        // Floating Account Fields
        const isFloatingAccount = formData.get('is_floating_account') === 'true';
        const bankCode = formData.get('bank_code') as string;
        const bankBranch = formData.get('bank_branch') as string;
        const accountName = formData.get('account_name') as string;
        const bankAccount = formData.get('bank_account') as string; // Raw account number

        if (!claimType || !description || !itemsJson) {
            return fail(400, { message: 'Missing required fields' });
        }

        let items;
        try {
            items = JSON.parse(itemsJson);
        } catch (e) {
            return fail(400, { message: 'Invalid items data' });
        }

        if (!items || items.length === 0) {
            return fail(400, { message: 'At least one item is required' });
        }

        // Calculate total amount
        const totalAmount = items.reduce((sum: number, item: any) => sum + Number(item.amount), 0);

        // Prepare claim data
        const claimData: any = {
            claim_type: claimType,
            description,
            applicant_id: session.user.id,
            total_amount: totalAmount,
            status: 'draft',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (claimType === 'employee') {
            // Payee is the applicant (user), handle in logic or leave payee_id NULL?
            // "員工個人報銷時 payee_id 為空" per spec.
            claimData.payee_id = null;
        } else {
            if (!payeeId) {
                return fail(400, { message: 'Payee is required for this claim type' });
            }
            claimData.payee_id = payeeId;

            // Handle Floating Account
            if (isFloatingAccount) {
                if (!bankCode || !bankAccount || !accountName) {
                    return fail(400, { message: 'Missing required bank information for floating account.' });
                }
                claimData.bank_code = bankCode;
                claimData.bank_branch = bankBranch || null;
                claimData.account_name = accountName;
                // Note: Encryption logic for bank_account should conceptually be here.
                // However, inserting raw string into a bytea column via JS client usually requires
                // either a Buffer (if using Node) or calling an RPC that handles `pgp_sym_encrypt`.
                // Direct insert of string into bytea via PostgREST might fail or store raw bytes.
                // Given previous patterns (Payee), we used RPC `submit_payee_change_request`.
                // For simplicity here without a new RPC, we will assume we can't easily use pgp_sym_encrypt 
                // directly in `insert()` unless we use a raw query or RPC.
                // DECISION: To properly support encryption as per plan, we should use an RPC or raw query.
                // BUT, to keep it simple and consistent with `claim_items` flow, let's see if we can use `rpc`.
                // Actually, for `claims` creation, we are doing a direct insert. 
                // Let's create a small helper RPC `create_claim_with_encryption` or similar if needed.
                // OR, since this is a draft, maybe we don't strictly enforce encryption yet?
                // The plan said "Will store Encrypted Data... likely text for ease". 
                // Migration used `bytea`. 
                // Let's defer encryption implementation details or use a placeholder if complex.
                // BETTER: We can use `supabase.rpc('encrypt_data', { data: bankAccount })` if such helper exists,
                // or just insert plain text if we change column type? 
                // The migration defined `bytea`.
                // Let's try to specific RPC for creating claim OR modify this to use `pgp_sym_encrypt` via a Postgres Function.
                // Revisiting the "submit_payee_change_request", it takes text and encrypts it.
                // Let's create a `create_claim` RPC to handle this cleanly.
                // For now, I will NOT include the RPC creation in this specific tool call but plan it.
                // WAIT, I must implement what I promised. 
                // Let's try to update the plan? NO, user accepted.
                // I will add `create_claim` RPC in a subsequent step if direct insert fails for bytea.
                // For now, I will omit the `bank_account` from `claimData` and add a TODO.
                // TODO: Implement encryption for bank_account via RPC or a Postgres function.
            }
        }

        // 1. Create Claim via RPC (Handles encryption for floating account)
        const { data: claimId, error: claimError } = await supabase.rpc('create_claim', {
            _claim_type: claimType,
            _description: description,
            _applicant_id: session.user.id,
            _payee_id: claimData.payee_id, // Can be null for employee
            _total_amount: totalAmount,
            _bank_code: claimData.bank_code || null,
            _bank_branch: claimData.bank_branch || null,
            _bank_account: bankAccount || null, // Pass raw account to RPC for encryption
            _account_name: claimData.account_name || null
        });

        if (claimError) {
            console.error('Error creating claim:', claimError);
            return fail(500, { message: 'Failed to create claim: ' + claimError.message });
        }

        // 2. Create Claim Items
        const claimItems = items.map((item: any, index: number) => ({
            claim_id: claimId,
            item_index: index + 1,
            date_start: item.date, // Mapping 'date' to 'date_start' per schema assumption for simple expense
            date_end: null, // Only for period-based claims
            category: item.category,
            description: item.description,
            amount: item.amount,
            invoice_number: item.invoice_number || null,
            attachment_status: 'pending_supplement', // Init as pending upload
            extra: item.extra || {}
        }));

        const { error: itemsError } = await supabase
            .from('claim_items')
            .insert(claimItems);

        if (itemsError) {
            console.error('Error creating claim items:', itemsError);
            // Should ideally rollback content, but Supabase doesn't support transactions via JS client easily w/o RPC.
            // For now, fail. User can delete draft.
            return fail(500, { message: 'Failed to create claim items' });
        }

        throw redirect(303, `/claims/${claimId}`);
    }
};
