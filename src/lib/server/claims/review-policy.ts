type ReviewClaim = {
    applicant_id: string;
    status: string;
};

type ReviewProfile = {
    is_finance?: boolean | null;
    is_admin?: boolean | null;
};

export type ReviewerFlags = {
    isFinance: boolean;
    isAdmin: boolean;
    isApprover: boolean;
};

export function resolveReviewerFlags(
    claim: ReviewClaim,
    currentUserId: string,
    profile: ReviewProfile | null | undefined
): ReviewerFlags {
    const isFinance = Boolean(profile?.is_finance);
    const isAdmin = Boolean(profile?.is_admin);
    const isApprover =
        claim.status === "pending_manager" &&
        claim.applicant_id !== currentUserId &&
        !isFinance &&
        !isAdmin;

    return { isFinance, isAdmin, isApprover };
}

export function resolveApproveNextStatus(claim: ReviewClaim, flags: ReviewerFlags): string | null {
    if (claim.status === "pending_manager" && flags.isApprover) return "pending_finance";
    if (claim.status === "pending_finance" && flags.isFinance) return "pending_payment";
    if (claim.status === "pending_doc_review" && flags.isFinance) return "paid";
    return null;
}

export function canRejectClaim(claim: ReviewClaim, flags: ReviewerFlags): boolean {
    return (
        (claim.status === "pending_manager" && flags.isApprover) ||
        (claim.status === "pending_finance" && flags.isFinance) ||
        (claim.status === "pending_doc_review" && flags.isFinance)
    );
}

export function resolveRejectNextStatus(status: string): string {
    return status === "pending_doc_review" ? "paid_pending_doc" : "returned";
}

