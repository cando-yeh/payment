import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { uploadFileToStorage, validateFileUpload } from '$lib/server/storage-upload';
import { checkDuplicateInvoices } from '$lib/server/invoice-check';
import {
    ALLOWED_UPLOAD_MIME_TYPES,
    EDITABLE_CLAIM_STATUSES,
    UPLOADABLE_CLAIM_STATUSES
} from '$lib/server/claims/constants';
import {
    ensureApproverAssigned,
    getOwnedClaim,
    moveClaimToPendingManager,
    parseAndValidateEditForm,
    persistEditedClaim,
    type EditableClaimRow
} from '$lib/server/claims/editing';
import {
    canRejectClaim,
    resolveApproveNextStatus,
    resolveRejectNextStatus,
    resolveReviewerFlags
} from '$lib/server/claims/review-policy';

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
        viewMode: canEditAsApplicant ? 'edit' : 'view'
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
        const parsed = parseAndValidateEditForm(formData, claimRow as EditableClaimRow, params.id, { isDraft: true });
        if (!parsed.ok) {
            return fail(parsed.status, { message: parsed.message });
        }
        const persist = await persistEditedClaim(supabase, claimRow as EditableClaimRow, parsed.value);
        if (!persist.ok) {
            return fail(persist.status, { message: persist.message });
        }

        throw redirect(303, '/claims');
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
        const parsed = parseAndValidateEditForm(formData, claimRow as EditableClaimRow, params.id);
        if (!parsed.ok) {
            return fail(parsed.status, { message: parsed.message });
        }
        const persist = await persistEditedClaim(supabase, claimRow as EditableClaimRow, parsed.value);
        if (!persist.ok) {
            return fail(persist.status, { message: persist.message });
        }

        const approverCheck = await ensureApproverAssigned(supabase, claimRow.applicant_id);
        if (!approverCheck.ok) {
            return fail(approverCheck.status, { message: approverCheck.message });
        }
        const moveResult = await moveClaimToPendingManager(supabase, params.id, session.user.id);
        if (!moveResult.ok) {
            return fail(moveResult.status, { message: moveResult.message });
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

        const approverCheck = await ensureApproverAssigned(supabase, claim.applicant_id);
        if (!approverCheck.ok) {
            return fail(approverCheck.status, { message: approverCheck.message });
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

        const moveResult = await moveClaimToPendingManager(supabase, id, session.user.id);
        if (!moveResult.ok) {
            return fail(moveResult.status, { message: moveResult.message });
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
        const reviewer = resolveReviewerFlags(claim, session.user.id, profile);
        const nextStatus = resolveApproveNextStatus(claim, reviewer);
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
        const reviewer = resolveReviewerFlags(claim, session.user.id, profile);
        if (!canRejectClaim(claim, reviewer)) return fail(403, { message: 'Forbidden' });
        const nextStatus = resolveRejectNextStatus(claim.status);

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

        if (claim.status !== 'pending_manager' && claim.status !== 'pending_finance') {
            return fail(400, { message: '只有等待審核中的單據可以撤回' });
        }

        const { error: updateError } = await supabase
            .from('claims')
            .update({ status: 'draft', updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('applicant_id', session.user.id)
            .in('status', ['pending_manager', 'pending_finance']);

        if (updateError) return fail(500, { message: 'Withdraw failed' });
        throw redirect(303, '/claims?tab=drafts');
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
