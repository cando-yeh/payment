import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const EDITABLE_CLAIM_STATUSES = new Set(['draft', 'returned']);
const UPLOADABLE_CLAIM_STATUSES = new Set(['draft', 'returned', 'pending_doc_review', 'paid_pending_doc']);
const ALLOWED_UPLOAD_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

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
            payee:payees(id, name, type, tax_id, bank),
            items:claim_items(*),
            approver:profiles!claims_applicant_id_fkey(
                approver:profiles!profiles_approver_id_fkey(id, full_name)
            ),
            history:claim_history(*, actor:profiles(full_name))
        `)
        .eq('id', id)
        .single();

    if (claimError || !claim) {
        throw error(404, 'Claim not found');
    }

    // RBAC Check for View
    const isApplicant = claim.applicant_id === session.user.id;
    const isApprover = claim.approver?.approver?.id === session.user.id;

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_finance, is_admin')
        .eq('id', session.user.id)
        .single();

    const isFinance = profile?.is_finance || false;
    const isAdmin = profile?.is_admin || false;

    if (!isApplicant && !isApprover && !isFinance && !isAdmin) {
        throw error(403, 'Forbidden');
    }

    if (claim.items) {
        claim.items.sort((a: any, b: any) => a.item_index - b.item_index);
    }

    if (claim.history) {
        claim.history.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return {
        claim,
        user: { id: session.user.id, isFinance, isAdmin, isApprover }
    };

};

export const actions: Actions = {
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

    submit: async ({ params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: 'Unauthorized' });

        const { id } = params;

        // Fetch claim and profile for validation
        const { data: claim } = await supabase
            .from('claims')
            .select('*, applicant:profiles!claims_applicant_id_fkey(approver_id)')
            .eq('id', id)
            .single();

        if (!claim || claim.applicant_id !== session.user.id) {
            return fail(404, { message: 'Claim not found' });
        }

        if (!EDITABLE_CLAIM_STATUSES.has(claim.status)) {
            return fail(400, { message: 'Only draft or returned claims can be submitted' });
        }

        if (!claim.applicant?.approver_id) {
            return fail(400, { message: '您尚未指派核准人，請聯繫管理員進行設定。' });
        }

        const { count } = await supabase
            .from('claim_items')
            .select('id', { head: true, count: 'exact' })
            .eq('claim_id', id);

        if (!count || count <= 0) {
            return fail(400, { message: '請款單必須包含至少一個項目' });
        }

        const { error: updateError } = await supabase
            .from('claims')
            .update({
                status: 'pending_manager',
                submitted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('applicant_id', session.user.id);

        if (updateError) return fail(500, { message: '提交失敗' });
        return { success: true };
    },

    approve: async ({ request, params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401, { message: 'Unauthorized' });

        const { id } = params;
        const formData = await request.formData();
        const comment = String(formData.get('comment') || '').trim();

        // Fetch claim with approver info
        const { data: claim } = await supabase
            .from('claims')
            .select('*, applicant:profiles!claims_applicant_id_fkey(approver_id)')
            .eq('id', id)
            .single();

        if (!claim) return fail(404, { message: 'Claim not found' });

        const { data: profile } = await supabase.from('profiles').select('is_finance').eq('id', session.user.id).single();
        const isFinance = profile?.is_finance;
        const isApprover = claim.applicant?.approver_id === session.user.id;

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
        return { success: true };
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
            .select('*, applicant:profiles!claims_applicant_id_fkey(approver_id)')
            .eq('id', id)
            .single();

        if (!claim) return fail(404, { message: 'Claim not found' });

        const { data: profile } = await supabase.from('profiles').select('is_finance').eq('id', session.user.id).single();
        const isFinance = profile?.is_finance;
        const isApprover = claim.applicant?.approver_id === session.user.id;

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
        return { success: true };
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

        if (file.size > 10 * 1024 * 1024) {
            return fail(400, { message: 'File size exceeds 10MB limit' });
        }

        if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.type)) {
            return fail(400, { message: 'Unsupported file type' });
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

        const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : 'bin';
        const fileName = `${itemId}_${Date.now()}.${extension || 'bin'}`;
        const filePath = `${id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('claims')
            .upload(filePath, file, { upsert: false, contentType: file.type });

        if (uploadError) {
            console.error('Upload error:', uploadError);
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
    }
};
