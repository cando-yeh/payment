import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
    authSignInWithRetry,
    supabaseAdmin,
    supabaseAnonKey,
    supabaseUrl
} from "./helpers";

describe("Notification enqueue on claim status transition", () => {
    const password = "Test1234!notify";
    let applicantUser: any = null;
    let approverUser: any = null;
    let claimId: string | null = null;

    beforeAll(async () => {
        const stamp = Date.now();
        const { data: approverData, error: approverError } = await supabaseAdmin.auth.admin.createUser({
            email: `notify_approver_${stamp}@example.com`,
            password,
            user_metadata: { full_name: "通知核准人" },
            email_confirm: true
        });
        if (approverError) throw approverError;
        approverUser = approverData.user;

        const { data: applicantData, error: applicantError } = await supabaseAdmin.auth.admin.createUser({
            email: `notify_applicant_${stamp}@example.com`,
            password,
            user_metadata: { full_name: "通知申請人" },
            email_confirm: true
        });
        if (applicantError) throw applicantError;
        applicantUser = applicantData.user;

        await supabaseAdmin
            .from("profiles")
            .update({ approver_id: approverUser.id })
            .eq("id", applicantUser.id);
    }, 30000);

    afterAll(async () => {
        if (claimId) {
            await supabaseAdmin.from("notification_logs").delete().eq("claim_id", claimId);
            await supabaseAdmin.from("notification_jobs").delete().eq("claim_id", claimId);
            await supabaseAdmin.from("claim_history").delete().eq("claim_id", claimId);
            await supabaseAdmin.from("claim_items").delete().eq("claim_id", claimId);
            await supabaseAdmin.from("claims").delete().eq("id", claimId);
        }
        if (applicantUser) await supabaseAdmin.auth.admin.deleteUser(applicantUser.id);
        if (approverUser) await supabaseAdmin.auth.admin.deleteUser(approverUser.id);
    }, 30000);

    it("enqueues submit notification job after claim is submitted", async () => {
        const applicantClient = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false }
        });
        await authSignInWithRetry(applicantClient, applicantUser.email, password);

        const { data: createdId, error: createError } = await applicantClient.rpc("create_claim", {
            _claim_type: "employee",
            _applicant_id: applicantUser.id,
            _payee_id: null,
            _total_amount: 100,
            _bank_code: null,
            _bank_account: null,
            _pay_first_patch_doc: false
        });
        expect(createError).toBeNull();
        expect(createdId).toBeTruthy();
        claimId = createdId as string;

        const { error: submitError } = await applicantClient
            .from("claims")
            .update({
                status: "pending_manager",
                submitted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq("id", claimId)
            .eq("applicant_id", applicantUser.id)
            .eq("status", "draft");

        expect(submitError).toBeNull();

        const { data: jobs, error: jobsError } = await supabaseAdmin
            .from("notification_jobs")
            .select("event_code, template_key, recipient_user_id, recipient_email, payload")
            .eq("claim_id", claimId)
            .eq("event_code", "submit");

        expect(jobsError).toBeNull();
        expect(jobs && jobs.length > 0).toBe(true);

        const job = jobs![0] as any;
        expect(job.template_key).toBe("claim.submit");
        expect(job.recipient_user_id).toBe(approverUser.id);
        expect(String(job.recipient_email || "").toLowerCase()).toBe(
            String(approverUser.email || "").toLowerCase()
        );
        expect(job.payload?.claim_id).toBe(claimId);
        expect(job.payload?.event_code).toBe("submit");
        expect(job.payload?.to_status).toBe("pending_manager");
    });
});
