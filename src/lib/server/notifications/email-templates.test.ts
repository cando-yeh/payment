import { describe, expect, it } from "vitest";
import {
    isMvpTemplateKey,
    renderClaimEmailTemplate,
    renderNotificationEmailTemplate
} from "./email-templates";

describe("email notification templates", () => {
    it("renders claim email body with required fields", () => {
        const rendered = renderClaimEmailTemplate(
            "claim.submit",
            {
                event_code: "submit",
                claim_id: "A1B2C3D4",
                from_status: "draft",
                to_status: "pending_manager",
                actor_name: "Candoo",
                reason: "送審測試",
                claim_link_path: "/claims/A1B2C3D4"
            },
            "https://example.com"
        );

        expect(rendered.subject).toContain("送出審核");
        expect(rendered.subject).toContain("#A1B2C3D4");
        expect(rendered.subject).toContain("[待辦]");
        expect(rendered.text).toContain("有新的請款單待你審核");
        expect(rendered.text).toContain("單號：#A1B2C3D4");
        expect(rendered.text).toContain("狀態：草稿 → 待主管審核");
        expect(rendered.text).toContain("操作者：Candoo");
        expect(rendered.text).toContain("原因：送審測試");
        expect(rendered.text).toContain("https://example.com/claims/A1B2C3D4");
        expect(rendered.html).toContain("前往查看請款單");
    });

    it("renders all event templates with non-empty subject/text/html", () => {
        const allEventCodes = [
            "submit",
            "withdraw",
            "approve_manager",
            "reject_manager",
            "approve_finance",
            "reject_finance",
            "reject_payment",
            "pay_completed",
            "pay_completed_need_doc",
            "supplement_submitted",
            "supplement_approved",
            "supplement_rejected",
            "cancelled",
            "payment_reversed"
        ];

        for (const eventCode of allEventCodes) {
            const rendered = renderClaimEmailTemplate(
                `claim.${eventCode}`,
                {
                    event_code: eventCode,
                    claim_id: "Z9Y8X7W6",
                    claim_type: "employee",
                    from_status: "pending_finance",
                    to_status: "pending_payment",
                    actor_name: "Animet",
                    reason: "測試原因",
                    claim_link_path: "/claims/Z9Y8X7W6"
                },
                "https://example.com"
            );

            expect(rendered.subject.length).toBeGreaterThan(10);
            expect(rendered.text).toContain("單號：#Z9Y8X7W6");
            expect(rendered.text).toContain("操作者：Animet");
            expect(rendered.text).toContain("下一步：");
            expect(rendered.html).toContain("前往查看請款單");
        }
    });

    it("flags configured mvp template keys", () => {
        expect(isMvpTemplateKey("claim.submit")).toBe(true);
        expect(isMvpTemplateKey("claim.supplement_submitted")).toBe(true);
        expect(isMvpTemplateKey("claim.approve_manager")).toBe(false);
    });

    it("renders payee request email via generic renderer", () => {
        const rendered = renderNotificationEmailTemplate(
            "payee.create_submitted",
            {
                object_type: "payee_request",
                event_code: "payee_create_submitted",
                payee_request_id: "req-001",
                payee_name: "Fuku 富可",
                change_type: "create",
                change_type_label: "新增",
                request_status: "pending",
                actor_name: "Candoo",
                reason: "新增供應商",
                request_link_path: "/payees"
            },
            "https://example.com"
        );

        expect(rendered.subject).toContain("收款人新增申請");
        expect(rendered.text).toContain("收款人：Fuku 富可");
        expect(rendered.text).toContain("申請類型：新增");
        expect(rendered.text).toContain("https://example.com/payees");
        expect(rendered.html).toContain("前往查看收款人申請");
    });
});
