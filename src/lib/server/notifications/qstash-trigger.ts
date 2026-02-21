type TriggerOptions = {
    origin?: string;
    reason?: string;
};

function normalizeAbsoluteUrl(raw: string): string | null {
    const value = String(raw || "").trim();
    if (!value) return null;

    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("//")) return `https:${value}`;
    if (value.startsWith("/")) return null;
    return `https://${value}`;
}

function resolveDrainUrl(origin?: string): string | null {
    const explicit = normalizeAbsoluteUrl(process.env.NOTIFY_DRAIN_URL || "");
    if (explicit) return explicit;

    const appBase =
        String(process.env.APP_BASE_URL || "").trim() ||
        String(process.env.PUBLIC_APP_BASE_URL || "").trim() ||
        String(origin || "").trim();
    if (!appBase) return null;
    const normalizedBase = normalizeAbsoluteUrl(appBase);
    if (!normalizedBase) return null;
    return `${normalizedBase.replace(/\/$/, "")}/api/notify/drain`;
}

export async function triggerNotificationDrain(
    options: TriggerOptions = {},
): Promise<boolean> {
    const qstashToken = String(process.env.QSTASH_TOKEN || "").trim();
    if (!qstashToken) return false;

    const drainUrl = resolveDrainUrl(options.origin);
    if (!drainUrl) return false;

    const delaySec = Number(process.env.NOTIFY_QSTASH_DELAY_SECONDS || 5);
    const retries = Number(process.env.NOTIFY_QSTASH_RETRIES || 2);
    const endpointToken = String(process.env.NOTIFY_DRAIN_TOKEN || "").trim();

    const publishUrl = `https://qstash.upstash.io/v2/publish/${encodeURIComponent(
        drainUrl,
    )}`;
    const headers: Record<string, string> = {
        Authorization: `Bearer ${qstashToken}`,
        "Content-Type": "application/json",
        "Upstash-Method": "POST",
        "Upstash-Delay": `${Math.max(0, delaySec)}s`,
        "Upstash-Retries": String(Math.max(0, retries)),
    };
    if (endpointToken) {
        headers["Upstash-Forward-Authorization"] = `Bearer ${endpointToken}`;
    }

    const response = await fetch(publishUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
            source: "claim_status_transition",
            reason: options.reason || null,
            requested_at: new Date().toISOString(),
        }),
    });
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error("[notify:qstash] publish failed", response.status, text);
        return false;
    }

    return true;
}
