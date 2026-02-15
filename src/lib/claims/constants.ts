export const CLAIM_TYPE_OPTIONS = [
    { value: "employee", label: "員工報銷" },
    { value: "vendor", label: "廠商請款" },
    { value: "personal_service", label: "個人勞務" }
] as const;

export const CLAIM_TYPE_LABELS: Record<string, string> = Object.fromEntries(
    CLAIM_TYPE_OPTIONS.map((option) => [option.value, option.label])
);

export const CLAIM_STATUS_LABELS: Record<string, string> = {
    draft: "草稿",
    pending_manager: "待主管審核",
    pending_finance: "待財務審核",
    pending_payment: "待付款",
    paid: "已付款",
    paid_pending_doc: "已付款(待補件)",
    pending_doc_review: "補件審核中",
    returned: "已退回",
    cancelled: "已撤銷"
};

export const CLAIM_ITEM_CATEGORIES = [
    { value: "travel", label: "差旅費" },
    { value: "food", label: "伙食費" },
    { value: "general", label: "一般雜支" }
] as const;

export function getClaimTypeLabel(type: string): string {
    return CLAIM_TYPE_LABELS[type] || type;
}

export function getClaimStatusLabel(status?: string | null): string {
    if (!status) return "編輯中";
    return CLAIM_STATUS_LABELS[status] || status;
}

