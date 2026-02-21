export const EDITABLE_CLAIM_STATUSES = new Set(["draft", "rejected"]);
export const UPLOADABLE_CLAIM_STATUSES = new Set([
    "draft",
    "rejected",
    "pending_doc_review",
    "paid_pending_doc"
]);

export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png"
]);

export const ALLOWED_ATTACHMENT_STATUSES = new Set([
    "uploaded",
    "pending_supplement",
    "exempt"
]);
