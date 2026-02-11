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
            approver:profiles(full_name)
        `)
        .eq('id', id)
        .eq('applicant_id', session.user.id)
        .single();

    if (claimError || !claim) {
        throw error(404, 'Claim not found');
    }

    if (claim.items) {
        claim.items.sort((a: any, b: any) => a.item_index - b.item_index);
    }

    return { claim };
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
        const { data: claim, error: claimError } = await getOwnedClaim(supabase, id, session.user.id);
        if (claimError || !claim) return fail(404, { message: 'Claim not found' });

        if (!EDITABLE_CLAIM_STATUSES.has(claim.status)) {
            return fail(400, { message: 'Only draft or returned claims can be submitted' });
        }

        const { count, error: itemCountError } = await supabase
            .from('claim_items')
            .select('id', { head: true, count: 'exact' })
            .eq('claim_id', id);

        if (itemCountError) return fail(500, { message: 'Failed to verify claim items' });
        if (!count || count <= 0) return fail(400, { message: 'Claim must include at least one item' });

        const { error: updateError } = await supabase
            .from('claims')
            .update({
                status: 'pending_manager',
                submitted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('applicant_id', session.user.id)
            .in('status', Array.from(EDITABLE_CLAIM_STATUSES));

        if (updateError) return fail(500, { message: 'Submit failed' });
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
