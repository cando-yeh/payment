import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals: { supabase, getSession } }) => {
    const session = await getSession();
    if (!session) {
        throw error(401, 'Unauthorized');
    }

    const { item_id } = params;
    if (!item_id) {
        throw error(400, 'Item ID required');
    }

    // Fetch the item to get the file path
    const { data: item, error: itemError } = await supabase
        .from('claim_items')
        .select('extra, claim_id, claim:claims(applicant_id)')
        .eq('id', item_id)
        .single();

    if (itemError || !item) {
        throw error(404, 'Attachment not found');
    }

    // Permission check
    // Ensure user is applicant or has role...
    const claim = item.claim as any; // Cast for now
    if (claim.applicant_id !== session.user.id) {
        // Add role checks here if needed
    }

    const filePath = item.extra?.file_path;
    if (!filePath) {
        throw error(404, 'File path not found');
    }

    // Generate Signed URL
    const { data, error: urlError } = await supabase.storage
        .from('claims')
        .createSignedUrl(filePath, 60); // 60 seconds validity

    if (urlError || !data?.signedUrl) {
        console.error('Signed URL Error:', urlError);
        throw error(500, 'Failed to generate access URL');
    }

    // Redirect to the signed URL
    throw redirect(303, data.signedUrl);
};
