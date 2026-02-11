import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
    const { id } = params;

    // Fetch claim details using the RPC
    const { data: claim, error: claimError } = await supabase
        .rpc('get_claim_detail', { _claim_id: id })
        .single();

    if (claimError || !claim) {
        console.error('Error fetching claim:', claimError);
        throw redirect(303, '/claims');
    }

    // Fetch active payees for the dropdown
    const { data: payees, error: payeesError } = await supabase
        .from('payees')
        .select('id, name, type, tax_id')
        .eq('status', 'active')
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
    update: async ({ request, params, locals: { supabase } }) => {
        const formData = await request.formData();
        const description = formData.get('description') as string;
        const payee_id = formData.get('payee_id') as string;
        const total_amount = parseFloat(formData.get('total_amount') as string);

        // Floating Account fields
        const is_floating = formData.get('is_floating') === 'on';
        const bank_code = is_floating ? (formData.get('bank_code') as string) : null;
        const bank_branch = is_floating ? (formData.get('bank_branch') as string) : null;
        const bank_account = is_floating ? (formData.get('bank_account') as string) : null;
        const account_name = is_floating ? (formData.get('account_name') as string) : null;

        // Validation
        if (!description || !payee_id || isNaN(total_amount)) {
            return fail(400, {
                error: 'Missing required fields',
                values: { description, payee_id, total_amount, is_floating, bank_code, bank_branch, bank_account, account_name }
            });
        }

        if (is_floating) {
            if (!bank_code || !bank_branch || !account_name) {
                return fail(400, {
                    error: 'Floating account details are incomplete',
                    values: { description, payee_id, total_amount, is_floating, bank_code, bank_branch, bank_account, account_name }
                });
            }
            // Note: bank_account can be empty if not changing (masked), but we handle that in RPC logic
            // If it's a new floating account entry, it must be provided? 
            // Frontend should handle "required" logic. 
            // If existing claim had floating account, frontend might show masked.
            // If user switches to floating, they must provide all.
        }

        const { error } = await supabase.rpc('update_claim', {
            _claim_id: params.id,
            _description: description,
            _payee_id: payee_id,
            _total_amount: total_amount,
            _bank_code: bank_code,
            _bank_branch: bank_branch,
            _bank_account: bank_account,
            _account_name: account_name
        });

        if (error) {
            console.error('Error updating claim:', error);
            return fail(500, {
                error: 'Failed to update claim',
                values: { description, payee_id, total_amount, is_floating, bank_code, bank_branch, bank_account, account_name }
            });
        }

        throw redirect(303, `/claims/${params.id}`);
    }
};
