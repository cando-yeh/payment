import * as dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { renderClaimEmailTemplate } from "./lib/notification-templates.mjs";
import { sendNotificationEmail } from "./lib/email-client.mjs";

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
// Resend 預設速率上限為每秒數個請求，補送大量積壓時需要節流。
const perMailDelayMs = Number(process.env.NOTIFY_RATE_DELAY_MS || 250);
const timeoutMs = Number(process.env.NOTIFY_EMAIL_TIMEOUT_MS || 15000);
const maxAttemptsHardCap = Number(process.env.NOTIFY_MAX_ATTEMPTS_CAP || 5);
const resendApiKey = process.env.RESEND_API_KEY || "";
const mailFrom = process.env.NOTIFY_EMAIL_FROM || "";
if (!resendApiKey || !mailFrom) {
    throw new Error("Missing email config: RESEND_API_KEY / NOTIFY_EMAIL_FROM");
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
        // 只撈 queued。failed 是終端狀態：重試路徑會把 status 設回 queued，
        // 只有 attempts 用盡才會變 failed，因此 failed 的 job 永遠通不過下面的
        // attempts 檢查。把它們一起撈進來，只會佔掉 limit(batchSize*3) 的候選
        // 名額 —— 2026-09 就是 60 筆 6 月的 failed 剛好塞滿 60 格的視窗，
        // 導致 44 筆 queued 永遠排不進來、一封都寄不出去。
        .select("*")
        .eq("status", "queued")
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
            .eq("status", "queued")
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
        provider: "resend",
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
        provider: "resend",
        error_message: String(reason || "Unknown error"),
        response_payload: {}
    });
}

async function processOne(job) {
    const payload = job.payload || {};
    const rendered = renderClaimEmailTemplate(job.template_key || "", payload, appBaseUrl);

    await sendNotificationEmail({
        apiKey: resendApiKey,
        from: mailFrom,
        to: [job.recipient_email],
        cc: job.cc_emails || [],
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
        timeoutMs,
        // 同一筆 job 重試時不會重複寄出
        idempotencyKey: String(job.id)
    });
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
