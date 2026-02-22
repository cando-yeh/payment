import { createClient } from "@supabase/supabase-js";
import { renderNotificationEmailTemplate } from "./email-templates";
import { sendMailSmtp } from "./smtp-client";

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

function calcBackoffMinutes(attempts: number) {
    return Math.min(60, Math.pow(2, Math.max(0, attempts - 1)));
}

export async function drainNotificationJobs(limit?: number): Promise<DrainResult> {
    const supabase = getSupabaseAdminClient();

    const appBaseUrl = getEnv("APP_BASE_URL") || "http://localhost:5173";
    const batchSize = Number(limit || process.env.NOTIFY_BATCH_SIZE || 20);
    const timeoutMs = Number(process.env.NOTIFY_SMTP_TIMEOUT_MS || 15000);
    const maxAttemptsHardCap = Number(process.env.NOTIFY_MAX_ATTEMPTS_CAP || 5);

    const smtp = {
        host: getEnv("NOTIFY_SMTP_HOST"),
        port: Number(process.env.NOTIFY_SMTP_PORT || 465),
        secure: String(process.env.NOTIFY_SMTP_SECURE || "true") === "true",
        username: getEnv("NOTIFY_SMTP_USERNAME"),
        password: getEnv("NOTIFY_SMTP_PASSWORD"),
        from: getEnv("NOTIFY_SMTP_FROM"),
    };
    if (!smtp.host || !smtp.from) {
        throw new Error("Missing SMTP config: NOTIFY_SMTP_HOST / NOTIFY_SMTP_FROM");
    }

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

    for (const job of claimedJobs) {
        try {
            const payload = job.payload || {};
            const rendered = renderNotificationEmailTemplate(
                String(job.template_key || ""),
                payload,
                appBaseUrl,
            );

            await sendMailSmtp({
                host: smtp.host,
                port: smtp.port,
                secure: smtp.secure,
                username: smtp.username,
                password: smtp.password,
                from: smtp.from,
                to: [String(job.recipient_email || "")],
                cc: Array.isArray(job.cc_emails) ? job.cc_emails : [],
                subject: rendered.subject,
                text: rendered.text,
                html: rendered.html,
                timeoutMs,
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
                provider: "smtp",
                response_payload: {},
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
                provider: "smtp",
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
