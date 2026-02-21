import * as dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { renderClaimEmailTemplate } from "./lib/notification-templates.mjs";
import { sendMailSmtp } from "./lib/smtp-client.mjs";

dotenv.config();
try {
    const envConfig = dotenv.parse(readFileSync(".env"));
    Object.assign(process.env, envConfig);
} catch {
    // ignore missing .env file
}

const required = ["PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const key of required) {
    if (!process.env[key]) {
        throw new Error(`Missing env: ${key}`);
    }
}

const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5173";
const batchSize = Number(process.env.NOTIFY_BATCH_SIZE || 20);
const perMailDelayMs = Number(process.env.NOTIFY_RATE_DELAY_MS || 200);
const timeoutMs = Number(process.env.NOTIFY_SMTP_TIMEOUT_MS || 15000);
const maxAttemptsHardCap = Number(process.env.NOTIFY_MAX_ATTEMPTS_CAP || 5);
const smtpConfig = {
    host: process.env.NOTIFY_SMTP_HOST || "",
    port: Number(process.env.NOTIFY_SMTP_PORT || 465),
    secure: String(process.env.NOTIFY_SMTP_SECURE || "true") === "true",
    username: process.env.NOTIFY_SMTP_USERNAME || "",
    password: process.env.NOTIFY_SMTP_PASSWORD || "",
    from: process.env.NOTIFY_SMTP_FROM || ""
};

if (!smtpConfig.host || !smtpConfig.from) {
    throw new Error("Missing SMTP config: NOTIFY_SMTP_HOST / NOTIFY_SMTP_FROM");
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function calcBackoffMinutes(attempts) {
    // 1, 2, 4, 8, 16 ... capped at 60 min
    return Math.min(60, Math.pow(2, Math.max(0, attempts - 1)));
}

async function claimJobs() {
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
    if (!data?.length) return [];

    const claimed = [];
    for (const job of data) {
        if (job.attempts >= Math.min(job.max_attempts || 3, maxAttemptsHardCap)) continue;
        const { data: updated, error: lockError } = await supabase
            .from("notification_jobs")
            .update({
                status: "processing",
                processing_started_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq("id", job.id)
            .in("status", ["queued", "failed"])
            .select("*")
            .maybeSingle();

        if (lockError) continue;
        if (updated) {
            claimed.push(updated);
            if (claimed.length >= batchSize) break;
        }
    }
    return claimed;
}

async function markSent(job, providerMessageId = null) {
    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
        .from("notification_jobs")
        .update({
            status: "sent",
            sent_at: nowIso,
            last_error: null,
            updated_at: nowIso
        })
        .eq("id", job.id)
        .eq("status", "processing");
    if (updateError) throw updateError;

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
        provider_message_id: providerMessageId,
        response_payload: {},
        sent_at: nowIso
    });
}

async function markFailed(job, reason) {
    const attempts = Number(job.attempts || 0) + 1;
    const maxAttempts = Math.min(Number(job.max_attempts || 3), maxAttemptsHardCap);
    const now = new Date();
    const shouldRetry = attempts < maxAttempts;
    const nextAt = new Date(now.getTime() + calcBackoffMinutes(attempts) * 60 * 1000);

    const { error: updateError } = await supabase
        .from("notification_jobs")
        .update({
            status: shouldRetry ? "queued" : "failed",
            attempts,
            failed_at: now.toISOString(),
            scheduled_at: shouldRetry ? nextAt.toISOString() : job.scheduled_at,
            last_error: String(reason || "Unknown error"),
            updated_at: now.toISOString()
        })
        .eq("id", job.id)
        .eq("status", "processing");
    if (updateError) throw updateError;

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
        error_message: String(reason || "Unknown error"),
        response_payload: {}
    });
}

async function processOne(job) {
    const payload = job.payload || {};
    const rendered = renderClaimEmailTemplate(job.template_key || "", payload, appBaseUrl);

    const watchdog = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("SMTP send timeout")), timeoutMs)
    );

    await Promise.race([
        sendMailSmtp({
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.secure,
            username: smtpConfig.username,
            password: smtpConfig.password,
            from: smtpConfig.from,
            to: [job.recipient_email],
            cc: job.cc_emails || [],
            subject: rendered.subject,
            text: rendered.text,
            html: rendered.html,
            timeoutMs
        }),
        watchdog
    ]);
}

async function main() {
    const jobs = await claimJobs();
    if (!jobs.length) {
        console.info("[notify-worker] no queued jobs");
        return;
    }
    console.info(`[notify-worker] claimed ${jobs.length} jobs`);

    for (const job of jobs) {
        try {
            await processOne(job);
            await markSent(job);
            console.info(`[notify-worker] sent ${job.id} (${job.event_code}) -> ${job.recipient_email}`);
        } catch (err) {
            await markFailed(job, err instanceof Error ? err.message : String(err));
            console.error(`[notify-worker] failed ${job.id}:`, err);
        }
        await sleep(perMailDelayMs);
    }
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((err) => {
        console.error("[notify-worker] fatal:", err);
        process.exit(1);
    });
