import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { uploadFileToStorage, validateFileUpload } from '$lib/server/storage-upload';
import { checkDuplicateInvoices } from '$lib/server/invoice-check';

const EDITABLE_CLAIM_STATUSES = new Set(['draft', 'returned']);
const UPLOADABLE_CLAIM_STATUSES = new Set(['draft', 'returned', 'pending_doc_review', 'paid_pending_doc']);
const ALLOWED_UPLOAD_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

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

async function getOwnedClaim(
    supabase: App.Locals['supabase'],
    id: string,
    userId: string
) {
    return supabase
        .from('claims')
        .select('id, applicant_id, status')
        .eq('id', id)
        .eq('applicant_id', userId)
        .single();
}

export const load: PageServerLoad = async ({ params, locals: { supabase, getSession } }) => {
    const session = await getSession();
    if (!session) {
        throw redirect(303, '/auth');
    }

    const { id } = params;

    const { data: claim, error: claimError } = await supabase
        .from('claims')
        .select(`
            *,
            payee:payees(id, name, type, bank),
            applicant:profiles!claims_applicant_id_fkey(id, full_name, approver_id),
            items:claim_items(*)
        `)
        .eq('id', id)
        .single();

    if (claimError || !claim) {
        throw error(404, 'Claim not found');
    }

    // RBAC Check for View
    const isApplicant = claim.applicant_id === session.user.id;
    const canEditAsApplicant = isApplicant && EDITABLE_CLAIM_STATUSES.has(claim.status);

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_finance, is_admin')
        .eq('id', session.user.id)
        .single();

    const isFinance = profile?.is_finance || false;
    const isAdmin = profile?.is_admin || false;

    if (!isApplicant && !isFinance && !isAdmin && claim.status !== 'pending_manager') {
        throw error(403, 'Forbidden');
    }

    // Fallback approver inference:
    // When user can access a pending_manager claim but is neither applicant nor finance/admin,
    // treat them as the current approver for UI action gating.
    const isApprover =
        claim.status === 'pending_manager' &&
        !isApplicant &&
        !isFinance &&
        !isAdmin;

    const { data: history } = await supabase
        .from('claim_history')
        .select('*, actor:profiles(full_name)')
        .eq('claim_id', id);

    let duplicateWarnings: any[] = [];
    try {
        duplicateWarnings = await checkDuplicateInvoices(supabase, id);
    } catch (e) {
        console.warn('Duplicate invoice reminder load failed:', e);
    }

    if (claim.items) {
        claim.items.sort((a: any, b: any) => a.item_index - b.item_index);
    }

    const sortedHistory = (history || []).sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    let payees: { id: string; name: string; type: string }[] = [];
    if (canEditAsApplicant) {
        const { data: payeesData, error: payeesError } = await supabase
            .from('payees')
            .select('id, name, type')
            .eq('status', 'available')
            .order('name');
        if (payeesError) {
            console.error('Error fetching payees:', payeesError);
        } else {
            payees = payeesData || [];
        }
    }

    return {
        claim: {
            ...claim,
            history: sortedHistory
        },
        user: { id: session.user.id, isFinance, isAdmin, isApprover },
        duplicateWarnings,
        payees,
        viewMode: canEditAsApplicant ? 'edit' : 'detail'
    };

};

export const actions: Actions = {
    editUpdate: async ({ request, params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: 'Unauthorized' });

        const { data: claimRow, error: claimFetchError } = await supabase
            .from('claims')
            .select('id, applicant_id, claim_type, status')
            .eq('id', params.id)
            .eq('applicant_id', session.user.id)
            .single();

        if (claimFetchError || !claimRow) {
            return fail(404, { message: 'Claim not found' });
        }
        if (!EDITABLE_CLAIM_STATUSES.has(claimRow.status)) {
            return fail(400, { message: 'Only draft or returned claims can be edited' });
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
            return fail(400, { message: 'Payee is required' });
        }
        if (is_floating && (!bank_code || !account_name || !bank_account)) {
            return fail(400, { message: 'Floating account details are incomplete' });
        }

        const parsedItems = parseItems(itemsJson);
        if (!parsedItems || parsedItems.length === 0) {
            return fail(400, { message: 'At least one item is required' });
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
            return fail(400, { message: 'All item amounts must be greater than 0' });
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
            return fail(500, { message: 'Failed to update claim' });
        }

        const { error: deleteItemsError } = await supabase
            .from('claim_items')
            .delete()
            .eq('claim_id', params.id);
        if (deleteItemsError) {
            console.error('Error clearing claim items:', deleteItemsError);
            return fail(500, { message: 'Failed to update claim items' });
        }

        const { error: insertItemsError } = await supabase
            .from('claim_items')
            .insert(normalizedItems);
        if (insertItemsError) {
            console.error('Error inserting claim items:', insertItemsError);
            return fail(500, { message: 'Failed to update claim items' });
        }

        throw redirect(303, `/claims/${params.id}`);
    },

    editSubmit: async ({ request, params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: 'Unauthorized' });

        const { data: claimRow, error: claimFetchError } = await supabase
            .from('claims')
            .select('id, applicant_id, claim_type, status')
            .eq('id', params.id)
            .eq('applicant_id', session.user.id)
            .single();
        if (claimFetchError || !claimRow) {
            return fail(404, { message: 'Claim not found' });
        }
        if (!EDITABLE_CLAIM_STATUSES.has(claimRow.status)) {
            return fail(400, { message: 'Only draft or returned claims can be submitted' });
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
            return fail(400, { message: 'Payee is required' });
        }
        if (is_floating && (!bank_code || !account_name || !bank_account)) {
            return fail(400, { message: 'Floating account details are incomplete' });
        }

        const parsedItems = parseItems(itemsJson);
        if (!parsedItems || parsedItems.length === 0) {
            return fail(400, { message: 'At least one item is required' });
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
            return fail(400, { message: 'All item amounts must be greater than 0' });
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
            return fail(500, { message: 'Failed to update claim' });
        }

        const { error: deleteItemsError } = await supabase
            .from('claim_items')
            .delete()
            .eq('claim_id', params.id);
        if (deleteItemsError) {
            console.error('Error clearing claim items:', deleteItemsError);
            return fail(500, { message: 'Failed to update claim items' });
        }

        const { error: insertItemsError } = await supabase
            .from('claim_items')
            .insert(normalizedItems);
        if (insertItemsError) {
            console.error('Error inserting claim items:', insertItemsError);
            return fail(500, { message: 'Failed to update claim items' });
        }

        const { data: applicantProfile, error: profileError } = await supabase
            .from('profiles')
            .select('approver_id')
            .eq('id', claimRow.applicant_id)
            .single();
        if (profileError) {
            return fail(500, { message: '讀取申請人資料失敗' });
        }
        if (!applicantProfile?.approver_id) {
            return fail(400, { message: '您尚未指派核准人，請聯繫管理員進行設定。' });
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
        if (submitError) return fail(500, { message: '提交失敗' });
        if (!updatedClaim) {
            return fail(409, { message: '請款單狀態已變更，請重新整理後再試' });
        }

        throw redirect(303, '/claims?tab=processing');
    },

    update: async ({ request, params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: 'Unauthorized' });

        const { id } = params;
        const { data: claim, error: claimError } = await getOwnedClaim(supabase, id, session.user.id);
        if (claimError || !claim) return fail(404, { message: 'Claim not found' });
        if (!EDITABLE_CLAIM_STATUSES.has(claim.status)) {
            return fail(400, { message: 'Only draft or returned claims can be updated' });
        }

        const formData = await request.formData();
        const description = String(formData.get('description') || '').trim();
        if (!description) {
            return fail(400, { message: 'Description is required' });
        }

        const { error: updateError } = await supabase
            .from('claims')
            .update({ description, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('applicant_id', session.user.id)
            .in('status', Array.from(EDITABLE_CLAIM_STATUSES));

        if (updateError) return fail(500, { message: 'Update failed' });
        return { success: true };
    },

    submit: async ({ request, params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: 'Unauthorized' });

        const { id } = params;

        // Fetch claim and profile for validation
        const { data: claim, error: claimError } = await supabase
            .from('claims')
            .select('id, applicant_id, status')
            .eq('id', id)
            .single();

        if (claimError || !claim || claim.applicant_id !== session.user.id) {
            return fail(404, { message: 'Claim not found' });
        }

        if (!EDITABLE_CLAIM_STATUSES.has(claim.status)) {
            return fail(400, { message: 'Only draft or returned claims can be submitted' });
        }

        await request.formData();

        const { data: applicantProfile, error: profileError } = await supabase
            .from('profiles')
            .select('approver_id')
            .eq('id', claim.applicant_id)
            .single();
        if (profileError) {
            return fail(500, { message: '讀取申請人資料失敗' });
        }
        if (!applicantProfile?.approver_id) {
            return fail(400, { message: '您尚未指派核准人，請聯繫管理員進行設定。' });
        }

        const { count, error: itemCountError } = await supabase
            .from('claim_items')
            .select('id', { head: true, count: 'exact' })
            .eq('claim_id', id);
        if (itemCountError) {
            return fail(500, { message: '讀取請款項目失敗' });
        }

        if (!count || count <= 0) {
            return fail(400, { message: '請款單必須包含至少一個項目' });
        }

        const nowIso = new Date().toISOString();
        const { data: updatedClaim, error: updateError } = await supabase
            .from('claims')
            .update({
                status: 'pending_manager',
                submitted_at: nowIso,
                updated_at: nowIso
            })
            .eq('id', id)
            .eq('applicant_id', session.user.id)
            .in('status', Array.from(EDITABLE_CLAIM_STATUSES))
            .select('id, status')
            .maybeSingle();

        if (updateError) return fail(500, { message: '提交失敗' });
        if (!updatedClaim) {
            return fail(409, { message: '請款單狀態已變更，請重新整理後再試' });
        }

        throw redirect(303, '/claims?tab=processing');
    },

    approve: async ({ request, params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: 'Unauthorized' });

        const { id } = params;
        const formData = await request.formData();
        const comment = String(formData.get('comment') || '').trim();

        // Fetch claim for status + owner check
        const { data: claim } = await supabase
            .from('claims')
            .select('id, applicant_id, status')
            .eq('id', id)
            .single();

        if (!claim) return fail(404, { message: 'Claim not found' });

        const { data: profile } = await supabase
            .from('profiles')
            .select('is_finance, is_admin')
            .eq('id', session.user.id)
            .single();
        const isFinance = profile?.is_finance;
        const isAdmin = profile?.is_admin;
        const isApprover = claim.status === 'pending_manager' && claim.applicant_id !== session.user.id && !isFinance && !isAdmin;

        let nextStatus: string = '';
        if (claim.status === 'pending_manager' && isApprover) {
            nextStatus = 'pending_finance';
        } else if (claim.status === 'pending_finance' && isFinance) {
            nextStatus = 'pending_payment';
        } else if (claim.status === 'pending_doc_review' && isFinance) {
            nextStatus = 'paid';
        }

        if (!nextStatus) return fail(403, { message: 'Forbidden' });

        const { error: updateError } = await supabase
            .from('claims')
            .update({
                status: nextStatus as any,
                last_comment: comment || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (updateError) return fail(500, { message: '核准失敗' });
        throw redirect(303, '/approval');
    },

    reject: async ({ request, params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: 'Unauthorized' });

        const { id } = params;
        const formData = await request.formData();
        const comment = String(formData.get('comment') || '').trim();

        if (!comment) return fail(400, { message: '請提供駁回原因' });

        // Fetch claim
        const { data: claim } = await supabase
            .from('claims')
            .select('id, applicant_id, status')
            .eq('id', id)
            .single();

        if (!claim) return fail(404, { message: 'Claim not found' });

        const { data: profile } = await supabase
            .from('profiles')
            .select('is_finance, is_admin')
            .eq('id', session.user.id)
            .single();
        const isFinance = profile?.is_finance;
        const isAdmin = profile?.is_admin;
        const isApprover = claim.status === 'pending_manager' && claim.applicant_id !== session.user.id && !isFinance && !isAdmin;

        const isAuthorized = (claim.status === 'pending_manager' && isApprover) ||
            (claim.status === 'pending_finance' && isFinance) ||
            (claim.status === 'pending_doc_review' && isFinance);

        if (!isAuthorized) return fail(403, { message: 'Forbidden' });

        // If rejecting pending_doc_review, it goes back to paid_pending_doc
        const nextStatus = claim.status === 'pending_doc_review' ? 'paid_pending_doc' : 'returned';

        const { error: updateError } = await supabase
            .from('claims')
            .update({
                status: nextStatus,
                last_comment: comment,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (updateError) return fail(500, { message: '駁回失敗' });
        throw redirect(303, '/approval');
    },

    cancel: async ({ params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: 'Unauthorized' });

        const { id } = params;
        const { data: claim } = await supabase
            .from('claims')
            .select('id, applicant_id, status')
            .eq('id', id)
            .single();

        if (!claim || claim.applicant_id !== session.user.id) return fail(404, { message: 'Claim not found' });
        if (claim.status !== 'returned') return fail(400, { message: '只有已退回的單據可以撤銷' });

        const { error: updateError } = await supabase
            .from('claims')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', id);

        if (updateError) return fail(500, { message: '撤銷失敗' });
        return { success: true };
    },


    delete: async ({ params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: 'Unauthorized' });

        const { id } = params;
        const { data: claim, error: claimError } = await getOwnedClaim(supabase, id, session.user.id);
        if (claimError || !claim) return fail(404, { message: 'Claim not found' });
        if (!EDITABLE_CLAIM_STATUSES.has(claim.status)) {
            return fail(400, { message: 'Only draft or returned claims can be deleted' });
        }

        const { data: files } = await supabase.storage.from('claims').list(id);
        if (files && files.length > 0) {
            const paths = files.map((f) => `${id}/${f.name}`);
            await supabase.storage.from('claims').remove(paths);
        }

        const { error: deleteError } = await supabase
            .from('claims')
            .delete()
            .eq('id', id)
            .eq('applicant_id', session.user.id)
            .in('status', Array.from(EDITABLE_CLAIM_STATUSES));

        if (deleteError) return fail(500, { message: 'Delete failed' });
        throw redirect(303, '/claims');
    },

    upload: async ({ request, params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: 'Unauthorized' });

        const { id } = params;
        const { data: claim, error: claimError } = await getOwnedClaim(supabase, id, session.user.id);
        if (claimError || !claim) return fail(404, { message: 'Claim not found' });
        if (!UPLOADABLE_CLAIM_STATUSES.has(claim.status)) {
            return fail(400, { message: 'Attachments are not allowed in current claim status' });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const itemId = String(formData.get('item_id') || '');

        if (!file || !itemId) {
            return fail(400, { message: 'File and Item ID are required' });
        }

        try {
            validateFileUpload(file, '憑證檔案', {
                required: true,
                maxBytes: 10 * 1024 * 1024,
                allowedTypes: ALLOWED_UPLOAD_MIME_TYPES
            });
        } catch (err: any) {
            return fail(400, { message: err.message || 'Unsupported file' });
        }

        const { data: item, error: itemError } = await supabase
            .from('claim_items')
            .select('id, claim_id, extra')
            .eq('id', itemId)
            .eq('claim_id', id)
            .single();

        if (itemError || !item) {
            return fail(404, { message: 'Claim item not found' });
        }

        const currentPath = item.extra?.file_path as string | undefined;
        if (currentPath) {
            await supabase.storage.from('claims').remove([currentPath]);
        }

        let filePath = '';
        try {
            filePath = await uploadFileToStorage(supabase, file, {
                bucket: 'claims',
                prefix: itemId,
                folder: id
            });
        } catch (err: any) {
            console.error('Upload error:', err);
            return fail(500, { message: 'File upload failed' });
        }

        const { error: updateError } = await supabase
            .from('claim_items')
            .update({
                attachment_status: 'uploaded',
                extra: { file_path: filePath, original_name: file.name }
            })
            .eq('id', itemId)
            .eq('claim_id', id);

        if (updateError) {
            console.error('Update item error:', updateError);
            return fail(500, { message: 'Failed to link attachment' });
        }

        return { success: true };
    },

    delete_attachment: async ({ request, params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: 'Unauthorized' });

        const { id } = params;
        const { data: claim, error: claimError } = await getOwnedClaim(supabase, id, session.user.id);
        if (claimError || !claim) return fail(404, { message: 'Claim not found' });
        if (!UPLOADABLE_CLAIM_STATUSES.has(claim.status)) {
            return fail(400, { message: 'Attachments are not editable in current claim status' });
        }

        const formData = await request.formData();
        const itemId = String(formData.get('item_id') || '');
        if (!itemId) return fail(400, { message: 'Item ID is required' });

        const { data: item, error: itemError } = await supabase
            .from('claim_items')
            .select('id, claim_id, extra')
            .eq('id', itemId)
            .eq('claim_id', id)
            .single();

        if (itemError || !item) return fail(404, { message: 'Claim item not found' });

        const dbFilePath = item.extra?.file_path as string | undefined;
        if (dbFilePath) {
            const { error: removeError } = await supabase.storage.from('claims').remove([dbFilePath]);
            if (removeError) {
                console.error('Remove file error:', removeError);
                return fail(500, { message: 'Failed to delete file' });
            }
        }

        const { error: updateError } = await supabase
            .from('claim_items')
            .update({ attachment_status: 'pending_supplement', extra: {} })
            .eq('id', itemId)
            .eq('claim_id', id);

        if (updateError) return fail(500, { message: 'Failed to update attachment status' });

        return { success: true };
    },

    withdraw: async ({ params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: 'Unauthorized' });

        const { id } = params;

        const { data: claim, error: fetchError } = await getOwnedClaim(supabase, id, session.user.id);
        if (fetchError || !claim) return fail(404, { message: 'Claim not found' });

        if (claim.status !== 'pending_manager') {
            return fail(400, { message: 'Only pending manager review claims can be withdrawn' });
        }

        const { error: updateError } = await supabase
            .from('claims')
            .update({ status: 'draft', updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('applicant_id', session.user.id)
            .eq('status', 'pending_manager');

        if (updateError) return fail(500, { message: 'Withdraw failed' });
        return { success: true };
    },

    togglePayFirst: async ({ request, params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: 'Unauthorized' });

        const { id } = params;
        const formData = await request.formData();
        const value = formData.get('value') === 'true';

        // Fetch claim to check role
        const { data: claim } = await supabase
            .from('claims')
            .select('applicant_id, status')
            .eq('id', id)
            .single();

        if (!claim) return fail(404, { message: 'Claim not found' });

        const { data: profile } = await supabase
            .from('profiles')
            .select('is_finance, is_admin')
            .eq('id', session.user.id)
            .single();

        const isApplicant = claim.applicant_id === session.user.id;
        const isFinance = profile?.is_finance || profile?.is_admin;

        // Restriction: Only applicant in draft/returned or Finance can toggle
        const canToggle = (isApplicant && EDITABLE_CLAIM_STATUSES.has(claim.status)) || isFinance;
        if (!canToggle) return fail(403, { message: 'Forbidden' });

        const { error: updateError } = await supabase
            .from('claims')
            .update({ pay_first_patch_doc: value, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (updateError) return fail(500, { message: '更新失敗' });
        return { success: true };
    }
};
