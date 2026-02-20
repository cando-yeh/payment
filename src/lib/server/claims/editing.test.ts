import { describe, expect, it } from "vitest";
import { parseAndValidateEditForm, type EditableClaimRow } from "./editing";

function buildFormData(payload: {
    payeeId?: string;
    items: unknown[];
    isFloating?: boolean;
    bankCode?: string;
    bankAccount?: string;
    payFirstPatchDoc?: boolean;
}) {
    const fd = new FormData();
    if (payload.payeeId) fd.set("payee_id", payload.payeeId);
    fd.set("items", JSON.stringify(payload.items));
    if (payload.isFloating) fd.set("is_floating", "on");
    if (payload.bankCode) fd.set("bank_code", payload.bankCode);
    if (payload.bankAccount) fd.set("bank_account", payload.bankAccount);
    if (payload.payFirstPatchDoc) fd.set("pay_first_patch_doc", "true");
    return fd;
}

function personalServiceClaim(): EditableClaimRow {
    return {
        id: "TEST0001",
        applicant_id: "00000000-0000-0000-0000-000000000001",
        claim_type: "personal_service",
        status: "draft"
    };
}

describe("parseAndValidateEditForm - personal_service", () => {
    it("rejects when personal_service contains multiple items", () => {
        const fd = buildFormData({
            payeeId: "00000000-0000-0000-0000-000000000099",
            items: [
                {
                    date_start: "2026-02-19",
                    date_end: "2026-02-19",
                    category: "一般雜支",
                    description: "service A",
                    amount: 100
                },
                {
                    date_start: "2026-02-20",
                    date_end: "2026-02-20",
                    category: "一般雜支",
                    description: "service B",
                    amount: 200
                }
            ]
        });

        const result = parseAndValidateEditForm(fd, personalServiceClaim(), "TEST0001");
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.message).toBe("個人勞務請款僅能有一筆費用明細");
        }
    });

    it("rejects when date_end is earlier than date_start", () => {
        const fd = buildFormData({
            payeeId: "00000000-0000-0000-0000-000000000099",
            items: [
                {
                    date_start: "2026-02-20",
                    date_end: "2026-02-19",
                    category: "一般雜支",
                    description: "service",
                    amount: 100
                }
            ]
        });

        const result = parseAndValidateEditForm(fd, personalServiceClaim(), "TEST0001");
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.message).toBe("服務結束日不得早於服務開始日");
        }
    });

    it("accepts same start/end date and normalizes voucher fields", () => {
        const fd = buildFormData({
            payeeId: "00000000-0000-0000-0000-000000000099",
            items: [
                {
                    date_start: "2026-02-19",
                    date_end: "2026-02-19",
                    category: "一般雜支",
                    description: "service",
                    amount: 100,
                    attachment_status: "uploaded",
                    invoice_number: "AB-12345678",
                    extra: { file_path: "any/path" }
                }
            ]
        });

        const result = parseAndValidateEditForm(fd, personalServiceClaim(), "TEST0001");
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.normalizedItems).toHaveLength(1);
            const item = result.value.normalizedItems[0];
            expect(item.date_start).toBe("2026-02-19");
            expect(item.date_end).toBe("2026-02-19");
            expect(item.attachment_status).toBe("exempt");
            expect(item.invoice_number).toBeNull();
            expect(item.extra).toEqual({});
        }
    });

    it("allows draft save without full required fields", () => {
        const fd = buildFormData({
            payeeId: "00000000-0000-0000-0000-000000000099",
            items: [
                {
                    date_start: "",
                    date_end: "",
                    category: "",
                    description: "",
                    amount: 0
                }
            ]
        });

        const result = parseAndValidateEditForm(
            fd,
            personalServiceClaim(),
            "TEST0001",
            { isDraft: true }
        );
        expect(result.ok).toBe(true);
    });
});
