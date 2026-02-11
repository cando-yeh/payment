import type { SupabaseClient } from '@supabase/supabase-js';

export interface DuplicateInvoiceResult {
    invoice_number: string;
    duplicate_claims: {
        claim_id: string;
        description: string;
        status: string;
        applicant_name: string;
        submitted_at: string | null;
    }[];
}

/**
 * Checks for duplicate invoice numbers across all claims.
 * @param supabase Supabase client
 * @param claimId The current claim ID to check (to exclude from results)
 * @returns A list of duplicate invoice results
 */
export async function checkDuplicateInvoices(
    supabase: SupabaseClient,
    claimId: string
): Promise<DuplicateInvoiceResult[]> {
    // 1. Fetch current claim's invoice numbers
    const { data: currentItems, error: currentError } = await supabase
        .from('claim_items')
        .select('invoice_number')
        .eq('claim_id', claimId)
        .not('invoice_number', 'is', null);

    if (currentError || !currentItems || currentItems.length === 0) {
        return [];
    }

    const invoiceNumbers = currentItems
        .map((item) => item.invoice_number?.trim())
        .filter((num): num is string => !!num && num.length > 0);

    if (invoiceNumbers.length === 0) {
        return [];
    }

    // 2. Search for duplicate items in other claims
    const { data: duplicateItems, error: duplicateItemsError } = await supabase
        .from('claim_items')
        .select('invoice_number, claim_id')
        .in('invoice_number', invoiceNumbers)
        .neq('claim_id', claimId);

    if (duplicateItemsError || !duplicateItems || duplicateItems.length === 0) {
        if (duplicateItemsError) {
            console.error('Duplicate check (items) failed:', duplicateItemsError);
        }
        return [];
    }

    // 3. Fetch claim details for duplicate claim IDs
    const duplicateClaimIds = Array.from(
        new Set(
            duplicateItems
                .map((item) => item.claim_id)
                .filter((id): id is string => !!id)
        )
    );

    if (duplicateClaimIds.length === 0) {
        return [];
    }

    const { data: duplicateClaims, error: duplicateClaimsError } = await supabase
        .from('claims')
        .select(`
            id,
            description,
            status,
            submitted_at,
            applicant:profiles!claims_applicant_id_fkey(full_name)
        `)
        .in('id', duplicateClaimIds);

    if (duplicateClaimsError || !duplicateClaims || duplicateClaims.length === 0) {
        if (duplicateClaimsError) {
            console.error('Duplicate check (claims) failed:', duplicateClaimsError);
        }
        return [];
    }

    const claimMap = new Map(
        duplicateClaims.map((claim: any) => [claim.id, claim] as const)
    );

    // 4. Group by invoice number
    const resultsMap = new Map<string, DuplicateInvoiceResult>();

    for (const item of duplicateItems) {
        const invNum = item.invoice_number?.trim();
        if (!invNum) continue;
        const claim = claimMap.get(item.claim_id as string) as any;
        if (!claim) continue;
        if (claim.status === 'cancelled') continue;
        const applicantName = claim.applicant?.full_name || '未知使用者';

        if (!resultsMap.has(invNum)) {
            resultsMap.set(invNum, {
                invoice_number: invNum,
                duplicate_claims: []
            });
        }

        const existing = resultsMap.get(invNum)!;
        // Avoid duplicate claim entries if multiple items in the same claim have the same invoice number (rare but possible)
        if (!existing.duplicate_claims.some((c) => c.claim_id === item.claim_id)) {
            existing.duplicate_claims.push({
                claim_id: claim.id,
                description: claim.description,
                status: claim.status,
                applicant_name: applicantName,
                submitted_at: claim.submitted_at
            });
        }
    }

    return Array.from(resultsMap.values());
}
