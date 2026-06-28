import { error } from '@sveltejs/kit';
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

    // Check if current user is the applicant's designated approver
    let isApprover = false;
    if (applicantId && applicantId !== session.user.id) {
        const { data: applicantProfile } = await supabase
            .from('profiles')
            .select('approver_id')
            .eq('id', applicantId)
            .single();
        isApprover = applicantProfile?.approver_id === session.user.id;
    }

    const canView =
        applicantId === session.user.id ||
        profile?.is_admin === true ||
        profile?.is_finance === true ||
        isApprover;

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

    // 以自動命名後的友善檔名輸出（inline 保留預覽，瀏覽器另存時也用此名稱）。
    // 取不到友善名稱時退回實體檔名。
    const friendlyName =
        String(item.extra?.original_name || '').trim() ||
        filePath.split('/').pop() ||
        'attachment';

    const upstream = await fetch(data.signedUrl);
    if (!upstream.ok || !upstream.body) {
        console.error('Attachment fetch failed:', upstream.status);
        throw error(502, 'Failed to fetch attachment');
    }

    const contentType =
        upstream.headers.get('content-type') || 'application/octet-stream';
    const encodedName = encodeURIComponent(friendlyName);

    return new Response(upstream.body, {
        headers: {
            'Content-Type': contentType,
            // RFC 5987：filename* 支援中文；filename 提供 ASCII 後備。
            'Content-Disposition': `inline; filename="attachment"; filename*=UTF-8''${encodedName}`,
            'Cache-Control': 'private, max-age=60'
        }
    });
};
