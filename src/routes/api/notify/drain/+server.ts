import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { drainNotificationJobs } from "$lib/server/notifications/drain";

export const prerender = false;
export const config = {
    runtime: "nodejs20.x",
};

function isAuthorized(request: Request): boolean {
    const expected = String(process.env.NOTIFY_DRAIN_TOKEN || "").trim();
    if (!expected) return true;

    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    return token === expected;
}

export const POST: RequestHandler = async ({ request }) => {
    if (!isAuthorized(request)) {
        return json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const limit = Number(body?.limit || 0) || undefined;
        const result = await drainNotificationJobs(limit);
        return json({ ok: true, ...result });
    } catch (err) {
        console.error("[notify:drain] fatal", err);
        return json(
            {
                ok: false,
                message: err instanceof Error ? err.message : "Unknown error",
            },
            { status: 500 },
        );
    }
};
