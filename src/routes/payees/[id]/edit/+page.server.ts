import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
    const { supabase, getSession, user } = locals;
    const session = await getSession();
    if (!session) {
        throw redirect(303, '/auth');
    }

    const { id } = params;

    // Fetch basic payee data
    const { data: payee, error: fetchError } = await supabase
        .from('payees')
        .select('*')
        .eq('id', id)
        .single();

    if (fetchError || !payee) {
        throw error(404, '找不到此受款人');
    }

    let decryptedTaxId = null;
    let decryptedBankAccount = null;

    // If user is finance or admin, try to decrypt sensitive data for the form
    if (user?.is_finance || user?.role === 'admin') {
        const [taxIdRes, bankAccRes] = await Promise.all([
            supabase.rpc('reveal_payee_tax_id', { _payee_id: id }),
            supabase.rpc('reveal_payee_bank_account', { _payee_id: id })
        ]);

        if (!taxIdRes.error) decryptedTaxId = taxIdRes.data;
        if (!bankAccRes.error) decryptedBankAccount = bankAccRes.data;
    }

    return {
        payee: {
            ...payee,
            tax_id: decryptedTaxId,
            bank_account: decryptedBankAccount
        },
        is_finance: user?.is_finance || false
    };
};

export const actions: Actions = {
    updatePayeeRequest: async ({ params, request, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const { id: payeeId } = params;
        const formData = await request.formData();

        // Extract fields
        const type = (formData.get('type') as string || '').trim();
        const name = (formData.get('name') as string || '').trim();
        const tax_id = (formData.get('tax_id') as string || '').trim();
        const bank_account = (formData.get('bank_account') as string || '').trim();
        const bank_code = (formData.get('bank_code') as string || '').trim();
        const email = (formData.get('email') as string || '').trim();
        const address = (formData.get('address') as string || '').trim();
        const service_description = (formData.get('service_description') as string || '').trim();
        const reason = (formData.get('reason') as string || '').trim() || '資料更新申請';

        // --- Basic Validation ---
        if (!name) return fail(400, { message: '受款人名稱為必填' });

        if (type === 'vendor' && tax_id && !/^\d{8}$/.test(tax_id)) {
            return fail(400, { message: '統一編號格式不正確：須為 8 碼數字' });
        }
        if (type === 'personal' && tax_id && !/^[A-Z][0-9]{9}$/.test(tax_id)) {
            return fail(400, { message: '身分證字號格式不正確：須為「1 碼大寫英文字母」+「9 碼數字」' });
        }
        if (bank_code && !/^\d{3}$/.test(bank_code)) {
            return fail(400, { message: '銀行代碼需為3碼數字' });
        }

        // In update, we might allow some fields to be empty if they are not changing, 
        // but since we pre-fill the form, they should be present.

        const proposed_data: Record<string, string> = {
            name,
            type,
            bank_code,
            service_description,
            email,
            address
        };

        const { error: rpcError } = await supabase.rpc('submit_payee_change_request', {
            _change_type: 'update',
            _payee_id: payeeId,
            _proposed_data: proposed_data,
            _proposed_tax_id: tax_id || null,
            _proposed_bank_account: bank_account || null,
            _reason: reason
        });

        if (rpcError) {
            console.error('Update Request Error:', rpcError);
            return fail(500, { message: '提交更新申請失敗：' + rpcError.message });
        }

        return redirect(303, '/payees');
    }
};
