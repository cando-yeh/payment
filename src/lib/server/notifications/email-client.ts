/**
 * 通知信寄送客戶端（Resend HTTP API）
 *
 * 取代原本的 SMTP + Gmail App Password。App Password 會因寄件帳號密碼輪替、
 * 兩步驟驗證變更等事件被「靜默撤銷」，2026-06 與 2026-07 各造成過一次通知
 * 斷線且兩週後才被發現。改用 API key 後不再與登入密碼綁定，寄送結果也能在
 * Resend 儀表板直接查閱，不必再挖 notification_jobs 排查。
 *
 * 只用 fetch 呼叫 REST API，不引入 SDK：省一個相依套件，也讓 scripts/ 底下
 * 的 worker 能用同一套邏輯。
 */

type SendEmailParams = {
    apiKey: string;
    from: string;
    to: string[];
    cc?: string[];
    subject: string;
    text: string;
    html: string;
    timeoutMs?: number;
    /**
     * 同一把 key 在 24 小時內只會真正寄出一次。
     * 傳 job id 進來，避免 drain 重試或多個實例同時跑時重複寄送。
     */
    idempotencyKey?: string;
};

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
    idempotencyKey,
}: SendEmailParams): Promise<{ id: string | null }> {
    const toList = to.filter(Boolean);
    const ccList = (cc || []).filter(Boolean);
    if (toList.length === 0 && ccList.length === 0) throw new Error("No recipients");
    if (!apiKey) throw new Error("Missing RESEND_API_KEY");

    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
    };
    if (idempotencyKey) headers["Idempotency-Key"] = String(idempotencyKey).slice(0, 256);

    let response: Response;
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
                text: text || "",
            }),
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (err) {
        if (err instanceof Error && err.name === "TimeoutError") {
            throw new Error(`Resend request timeout after ${timeoutMs}ms`);
        }
        throw err;
    }

    const raw = await response.text();

    if (!response.ok) {
        // Resend 錯誤格式：{ name, statusCode, message }
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
