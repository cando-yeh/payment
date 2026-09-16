import { createClient } from "@supabase/supabase-js";
import { renderNotificationEmailTemplate } from "./email-templates";
import { sendNotificationEmail } from "./email-client";

type DrainResult = {
    claimed: number;
    sent: number;
    failed: number;
};

function getEnv(name: string): string {
    return String(process.env[name] || "").trim();
}

function getSupabaseAdminClient() {
    const url = getEnv("PUBLIC_SUPABASE_URL") || getEnv("SUPABASE_URL");
    const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
        throw new Error("Missing env: PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    return createClient(url, key);
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function calcBackoffMinutes(attempts: number) {
    return Math.min(60, Math.pow(2, Math.max(0, attempts - 1)));
}

export async function drainNotificationJobs(limit?: number): Promise<DrainResult> {
    const supabase = getSupabaseAdminClient();

    const appBaseUrl = getEnv("APP_BASE_URL") || "http://localhost:5173";
    const batchSize = Number(limit || process.env.NOTIFY_BATCH_SIZE || 20);
    const timeoutMs = Number(process.env.NOTIFY_EMAIL_TIMEOUT_MS || 15000);
    const maxAttemptsHardCap = Number(process.env.NOTIFY_MAX_ATTEMPTS_CAP || 5);

    const apiKey = getEnv("RESEND_API_KEY");
    const mailFrom = getEnv("NOTIFY_EMAIL_FROM");
    if (!apiKey || !mailFrom) {
        throw new Error("Missing email config: RESEND_API_KEY / NOTIFY_EMAIL_FROM");
    }
    // Resend 預設速率上限為每秒數個請求，補送大量積壓時需要節流。
    const rateDelayMs = Number(process.env.NOTIFY_RATE_DELAY_MS || 250);

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
        .from("notification_jobs")
        .select("*")
        .in("status", ["queued", "failed"])
        .lte("scheduled_at", nowIso)
        .order("scheduled_at", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(batchSize * 3);
    if (error) throw error;

    const candidates = data || [];
    const claimedJobs: any[] = [];
    for (const job of candidates) {
        if (Number(job.attempts || 0) >= Math.min(Number(job.max_attempts || 3), maxAttemptsHardCap)) continue;

        const { data: updated, error: lockError } = await supabase
            .from("notification_jobs")
            .update({
                status: "processing",
                processing_started_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", job.id)
            .in("status", ["queued", "failed"])
            .select("*")
            .maybeSingle();

        if (!lockError && updated) {
            claimedJobs.push(updated);
            if (claimedJobs.length >= batchSize) break;
        }
    }

    let sent = 0;
    let failed = 0;

    for (const [index, job] of claimedJobs.entries()) {
        if (index > 0 && rateDelayMs > 0) await sleep(rateDelayMs);

        try {
            const payload = job.payload || {};
            const rendered = renderNotificationEmailTemplate(
                String(job.template_key || ""),
                payload,
                appBaseUrl,
            );

            const { id: providerMessageId } = await sendNotificationEmail({
                apiKey,
                from: mailFrom,
                to: [String(job.recipient_email || "")],
                cc: Array.isArray(job.cc_emails) ? job.cc_emails : [],
                subject: rendered.subject,
                text: rendered.text,
                html: rendered.html,
                timeoutMs,
                // 同一筆 job 重試時不會重複寄出
                idempotencyKey: String(job.id),
            });

            const sentAt = new Date().toISOString();
            await supabase
                .from("notification_jobs")
                .update({
                    status: "sent",
                    sent_at: sentAt,
                    last_error: null,
                    updated_at: sentAt,
                })
                .eq("id", job.id)
                .eq("status", "processing");

            await supabase.from("notification_logs").insert({
                job_id: job.id,
                event_code: job.event_code,
                channel: job.channel,
                template_key: job.template_key,
                claim_id: job.claim_id,
                recipient_user_id: job.recipient_user_id,
                recipient_email: job.recipient_email,
                cc_emails: job.cc_emails || [],
                status: "sent",
                provider: "resend",
                response_payload: providerMessageId ? { id: providerMessageId } : {},
                sent_at: sentAt,
            });

            sent += 1;
        } catch (err) {
            const attempts = Number(job.attempts || 0) + 1;
            const maxAttempts = Math.min(Number(job.max_attempts || 3), maxAttemptsHardCap);
            const shouldRetry = attempts < maxAttempts;
            const now = new Date();
            const nextAt = new Date(
                now.getTime() + calcBackoffMinutes(attempts) * 60 * 1000,
            );

            await supabase
                .from("notification_jobs")
                .update({
                    status: shouldRetry ? "queued" : "failed",
                    attempts,
                    failed_at: now.toISOString(),
                    scheduled_at: shouldRetry ? nextAt.toISOString() : job.scheduled_at,
                    last_error: err instanceof Error ? err.message : String(err),
                    updated_at: now.toISOString(),
                })
                .eq("id", job.id)
                .eq("status", "processing");

            await supabase.from("notification_logs").insert({
                job_id: job.id,
                event_code: job.event_code,
                channel: job.channel,
                template_key: job.template_key,
                claim_id: job.claim_id,
                recipient_user_id: job.recipient_user_id,
                recipient_email: job.recipient_email,
                cc_emails: job.cc_emails || [],
                status: "failed",
                provider: "resend",
                error_message: err instanceof Error ? err.message : String(err),
                response_payload: {},
            });

            failed += 1;
        }
    }

    return {
        claimed: claimedJobs.length,
        sent,
        failed,
    };
}
