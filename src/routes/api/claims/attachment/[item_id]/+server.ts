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

    const [{ data: profile }, { data: item, error: itemError }] = await Promise.all([
        supabase
            .from('profiles')
            .select('is_admin, is_finance')
            .eq('id', session.user.id)
            .single(),
        supabase
            .from('claim_items')
            .select('extra, claim_id, claim:claims(applicant_id)')
            .eq('id', item_id)
            .single()
    ]);

    if (itemError || !item) {
        throw error(404, 'Attachment not found');
    }

    const claimRelation = Array.isArray(item.claim) ? item.claim[0] : item.claim;
    const applicantId = claimRelation?.applicant_id;
    const canView =
        applicantId === session.user.id ||
        profile?.is_admin === true ||
        profile?.is_finance === true;

    if (!canView) {
        throw error(403, 'Forbidden');
    }

    const filePath = item.extra?.file_path;
    if (!filePath) {
        throw error(404, 'File path not found');
    }

    const expectedPrefix = `${item.claim_id}/`;
    if (!filePath.startsWith(expectedPrefix)) {
        throw error(400, 'Invalid attachment path');
    }

    const { data, error: urlError } = await supabase.storage
        .from('claims')
        .createSignedUrl(filePath, 60);

    if (urlError || !data?.signedUrl) {
        console.error('Signed URL Error:', urlError);
        throw error(500, 'Failed to generate access URL');
    }

    throw redirect(303, data.signedUrl);
};
