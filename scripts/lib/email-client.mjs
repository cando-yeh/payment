/**
 * 通知信寄送客戶端（Resend HTTP API）— worker 版本
 *
 * 與 src/lib/server/notifications/email-client.ts 同一套邏輯，
 * 給不經過 build 的 scripts/notification-worker.mjs 使用。
 * 取代原本手刻的 raw SMTP 實作（scripts/lib/smtp-client.mjs，已移除）。
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function sendNotificationEmail({
    apiKey,
    from,
    to = [],
    cc = [],
    subject,
    text,
    html,
    timeoutMs = 15000,
    idempotencyKey
}) {
    const toList = to.filter(Boolean);
    const ccList = (cc || []).filter(Boolean);
    if (toList.length === 0 && ccList.length === 0) throw new Error("No recipients");
    if (!apiKey) throw new Error("Missing RESEND_API_KEY");

    const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
    };
    if (idempotencyKey) headers["Idempotency-Key"] = String(idempotencyKey).slice(0, 256);

    let response;
    try {
        response = await fetch(RESEND_ENDPOINT, {
            method: "POST",
            headers,
            body: JSON.stringify({
                from,
                to: toList,
                ...(ccList.length ? { cc: ccList } : {}),
                subject,
                html: html || "",
                text: text || ""
            }),
            signal: AbortSignal.timeout(timeoutMs)
        });
    } catch (err) {
        if (err?.name === "TimeoutError") {
            throw new Error(`Resend request timeout after ${timeoutMs}ms`);
        }
        throw err;
    }

    const raw = await response.text();

    if (!response.ok) {
        let detail = raw.slice(0, 300);
        try {
            const parsed = JSON.parse(raw);
            if (parsed?.message) detail = `${parsed.name || "error"}: ${parsed.message}`;
        } catch {
            // 非 JSON 回應就直接用原始內容
        }
        throw new Error(`Resend ${response.status} ${detail}`);
    }

    try {
        return { id: JSON.parse(raw)?.id ?? null };
    } catch {
        return { id: null };
    }
}
