import { EDITABLE_CLAIM_STATUSES } from "$lib/server/claims/constants";

type ClaimItemInput = {
    date?: string;
    date_start?: string;
    date_end?: string;
    category?: string;
    description?: string;
    amount?: number | string;
    invoice_number?: string;
    attachment_status?: "uploaded" | "pending_supplement" | "exempt";
    extra?: Record<string, unknown>;
};

export type EditableClaimRow = {
    id: string;
    applicant_id: string;
    claim_type: string;
    status: string;
    description?: string | null;
};

export type ParsedEditForm = {
    payeeId: string;
    isFloating: boolean;
    bankCode: string | null;
    bankAccount: string | null;
    normalizedItems: {
        claim_id: string;
        item_index: number;
        date_start: string;
        date_end: string | null;
        category: string;
        description: string;
        amount: number;
        invoice_number: string | null;
        attachment_status: "uploaded" | "pending_supplement" | "exempt";
        extra: Record<string, unknown>;
    }[];
    totalAmount: number;
    payFirstPatchDoc: boolean;
};

function parseItems(value: string): ClaimItemInput[] | null {
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export async function getOwnedClaim(
    supabase: App.Locals["supabase"],
    id: string,
    userId: string
) {
    return supabase
        .from("claims")
        .select("id, applicant_id, status")
        .eq("id", id)
        .eq("applicant_id", userId)
        .single();
}

export function parseAndValidateEditForm(
    formData: FormData,
    claimRow: EditableClaimRow,
    claimId: string,
    options: { isDraft?: boolean } = {}
): { ok: true; value: ParsedEditForm } | { ok: false; status: number; message: string } {
    const payeeId = String(formData.get("payee_id") || "");
    const isFloating = formData.get("is_floating") === "on";
    const bankCode = isFloating ? String(formData.get("bank_code") || "").trim() : null;
    const bankAccount = isFloating ? String(formData.get("bank_account") || "").trim() : null;
    const itemsJson = String(formData.get("items") || "[]");
    const payFirstPatchDoc = formData.get("pay_first_patch_doc") === "true";

    if (claimRow.claim_type !== "employee" && !payeeId && !options.isDraft) {
        return { ok: false, status: 400, message: "Payee is required for this claim type" };
    }
    if (isFloating && (!bankCode || !bankAccount) && !options.isDraft) {
        return { ok: false, status: 400, message: "Floating account details are incomplete" };
    }

    const parsedItems = parseItems(itemsJson);
    if ((!parsedItems || parsedItems.length === 0) && !options.isDraft) {
        return { ok: false, status: 400, message: "At least one item is required" };
    }

    const normalizedItems = (parsedItems || []).map((item, index) => {
        const amount = Number(item.amount);
        const rawStatus = item.attachment_status || "pending_supplement";
        const rawExtra = item.extra || {};
        const hasAttachmentPath =
            typeof (rawExtra as Record<string, unknown>).file_path === "string" &&
            String((rawExtra as Record<string, unknown>).file_path || "").trim().length > 0;
        const normalizedAttachmentStatus =
            rawStatus === "uploaded" && !hasAttachmentPath
                ? "pending_supplement"
                : rawStatus;
        return {
            claim_id: claimId,
            item_index: index + 1,
            date_start: item.date || item.date_start || new Date().toISOString().slice(0, 10),
            date_end: String(item.date_end || "").trim() || null,
            category: String(item.category || "general").trim(),
            description: String(item.description || "").trim(),
            amount: Number.isFinite(amount) ? amount : 0,
            invoice_number: item.invoice_number || null,
            attachment_status: normalizedAttachmentStatus,
            extra: rawExtra
        };
    });

    if (!options.isDraft && normalizedItems.some((item) => item.amount <= 0)) {
        return { ok: false, status: 400, message: "All item amounts must be greater than 0" };
    }
    if (claimRow.claim_type === "personal_service") {
        if (normalizedItems.length !== 1) {
            return { ok: false, status: 400, message: "個人勞務請款僅能有一筆費用明細" };
        }

        const first = normalizedItems[0];
        first.attachment_status = "exempt";
        first.invoice_number = null;
        first.extra = {};

        if (!options.isDraft) {
            if (!first.date_start || !first.date_end || !first.category || !first.description) {
                return { ok: false, status: 400, message: "個人勞務請款需填寫完整明細欄位" };
            }
            if (first.date_end < first.date_start) {
                return { ok: false, status: 400, message: "服務結束日不得早於服務開始日" };
            }
        }
    }
    // ... (rest of validation)

    const totalAmount = normalizedItems.reduce((sum, item) => sum + item.amount, 0);
    return {
        ok: true,
        value: {
            payeeId,
            isFloating,
            bankCode,
            bankAccount,
            normalizedItems,
            totalAmount,
            payFirstPatchDoc
        }
    };
}

export async function persistEditedClaim(
    supabase: App.Locals["supabase"],
    claimRow: EditableClaimRow,
    parsed: ParsedEditForm
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
    const { error: updateClaimError } = await supabase.rpc("update_claim", {
        _claim_id: claimRow.id,
        _payee_id: claimRow.claim_type === "employee" ? null : parsed.payeeId,
        _total_amount: parsed.totalAmount,
        _bank_code: parsed.isFloating ? parsed.bankCode : null,
        _bank_account: parsed.isFloating ? parsed.bankAccount : null,
        _pay_first_patch_doc: parsed.payFirstPatchDoc
    });

    if (updateClaimError) {
        console.error("Error updating claim:", updateClaimError);
        return { ok: false, status: 500, message: `Failed to update claim: ${updateClaimError.message}` };
    }

    const { error: deleteItemsError } = await supabase
        .from("claim_items")
        .delete()
        .eq("claim_id", claimRow.id);
    if (deleteItemsError) {
        console.error("Error clearing claim items:", deleteItemsError);
        return { ok: false, status: 500, message: "Failed to update claim items" };
    }

    const { error: insertItemsError } = await supabase
        .from("claim_items")
        .insert(parsed.normalizedItems);
    if (insertItemsError) {
        console.error("Error inserting claim items:", insertItemsError);
        return { ok: false, status: 500, message: "Failed to update claim items" };
    }

    return { ok: true };
}

export async function ensureApproverAssigned(
    supabase: App.Locals["supabase"],
    applicantId: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
    const { data: applicantProfile, error: profileError } = await supabase
        .from("profiles")
        .select("approver_id")
        .eq("id", applicantId)
        .single();
    if (profileError) {
        return { ok: false, status: 500, message: "讀取申請人資料失敗" };
    }
    if (!applicantProfile?.approver_id) {
        return { ok: false, status: 400, message: "您尚未指派核准人，請聯繫管理員進行設定。" };
    }
    return { ok: true };
}

export async function moveClaimToPendingManager(
    supabase: App.Locals["supabase"],
    claimId: string,
    applicantId: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
    const nowIso = new Date().toISOString();
    const { data: updatedClaim, error: updateError } = await supabase
        .from("claims")
        .update({
            status: "pending_manager",
            submitted_at: nowIso,
            updated_at: nowIso
        })
        .eq("id", claimId)
        .eq("applicant_id", applicantId)
        .in("status", Array.from(EDITABLE_CLAIM_STATUSES))
        .select("id, status")
        .maybeSingle();

    if (updateError) return { ok: false, status: 500, message: "提交失敗" };
    if (!updatedClaim) {
        return { ok: false, status: 409, message: "請款單狀態已變更，請重新整理後再試" };
    }
    return { ok: true };
}
