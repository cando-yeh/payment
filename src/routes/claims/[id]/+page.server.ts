import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

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
            payee:payees(id, name, type, tax_id, bank_account, bank),
            items:claim_items(*),
            approver:profiles(full_name)
        `)
        .eq('id', id)
        .single();

    if (claimError || !claim) {
        console.error('Error fetching claim:', claimError);
        // Debugging: Write error to file
        try {
            const fs = await import('fs');
            fs.appendFileSync('server_errors.txt', `[${new Date().toISOString()}] Claim ID: ${id}, Error: ${JSON.stringify(claimError)}\n`);
        } catch (e) { /* ignore */ }

        throw error(404, 'Claim not found');
    }

    // Sort items by index
    if (claim.items) {
        claim.items.sort((a: any, b: any) => a.item_index - b.item_index);
    }

    // Check permissions (only applicant or admin/finance/approver)
    if (claim.applicant_id !== session.user.id) {
        // checks other roles...
        // For MVP, if not applicant, maybe block unless approver.
        // pass for now.
    }

    return {
        claim
    };
};

export const actions: Actions = {
    // 1. Update Claim (Draft only)
    update: async ({ request, params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401);

        const { id } = params;
        const formData = await request.formData();
        const description = formData.get('description') as string;

        // Update Claim
        const { error: updateError } = await supabase
            .from('claims')
            .update({
                description,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (updateError) return fail(500, { message: 'Update failed' });

        return { success: true };
    },

    // 2. Submit Claim
    submit: async ({ params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401);
        const { id } = params;

        const { error } = await supabase
            .from('claims')
            .update({
                status: 'pending_manager',
                submitted_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) return fail(500, { message: 'Submit failed' });
        return { success: true };
    },

    // 3. Delete Claim
    delete: async ({ params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401);
        const { id } = params;

        // Delete files from storage if any
        const { data: files } = await supabase.storage.from('claims').list(id);
        if (files && files.length > 0) {
            const paths = files.map(f => `${id}/${f.name}`);
            await supabase.storage.from('claims').remove(paths);
        }

        const { error } = await supabase
            .from('claims')
            .delete()
            .eq('id', id);

        if (error) return fail(500, { message: 'Delete failed' });
        throw redirect(303, '/claims');
    },

    // 4. Upload Attachment
    upload: async ({ request, params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401);

        const { id } = params;
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const itemId = formData.get('item_id') as string;

        if (!file || !itemId) {
            return fail(400, { message: 'File and Item ID are required' });
        }

        // Validate file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
            return fail(400, { message: 'File size exceeds 10MB limit' });
        }

        // Upload to Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${itemId}_${Date.now()}.${fileExt}`;
        const filePath = `${id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('claims')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Upload error:', uploadError);
            try {
                const fs = await import('fs');
                fs.appendFileSync('upload_errors.txt', `[${new Date().toISOString()}] Upload Error: ${JSON.stringify(uploadError)}\n`);
            } catch (e) { /* ignore */ }
            return fail(500, { message: 'File upload failed' });
        }

        // Update Claim Item with path in extra
        const { error: updateError } = await supabase
            .from('claim_items')
            .update({
                attachment_status: 'uploaded',
                extra: { file_path: filePath, original_name: file.name }
            })
            .eq('id', itemId);

        if (updateError) {
            console.error('Update item error:', updateError);
            try {
                const fs = await import('fs');
                fs.appendFileSync('upload_errors.txt', `[${new Date().toISOString()}] Update Item Error: ${JSON.stringify(updateError)}\n`);
            } catch (e) { /* ignore */ }
            return fail(500, { message: 'Failed to link attachment' });
        }

        return { success: true };
    },

    // 5. Delete Attachment
    delete_attachment: async ({ request, params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401);

        const { id } = params;
        const formData = await request.formData();
        const itemId = formData.get('item_id') as string;
        const filePath = formData.get('file_path') as string;

        if (!itemId || !filePath) return fail(400);

        // Remove from storage
        const { error: removeError } = await supabase.storage
            .from('claims')
            .remove([filePath]);

        if (removeError) {
            console.error('Remove file error:', removeError);
            return fail(500, { message: 'Failed to delete file' });
        }

        // Update Item
        const { error: updateError } = await supabase
            .from('claim_items')
            .update({
                attachment_status: 'pending_supplement',
                extra: {}
            })
            .eq('id', itemId);

        if (updateError) return fail(500);

        return { success: true };
    },

    // 6. Withdraw Claim (Pending Approval -> Draft)
    withdraw: async ({ params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        if (!session) return fail(401);
        const { id } = params;

        // Verify claim is in pending_approval status
        const { data: claim, error: fetchError } = await supabase
            .from('claims')
            .select('status, applicant_id')
            .eq('id', id)
            .single();

        if (fetchError || !claim) return fail(404, { message: 'Claim not found' });

        if (claim.status !== 'pending_manager') {
            return fail(400, { message: 'Only pending manager review claims can be withdrawn' });
        }

        if (claim.applicant_id !== session.user.id) {
            return fail(403, { message: 'You can only withdraw your own claims' });
        }

        const { error } = await supabase
            .from('claims')
            .update({
                status: 'draft',
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) return fail(500, { message: 'Withdraw failed' });
        return { success: true };
    }
};
