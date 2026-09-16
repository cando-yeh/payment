import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { drainNotificationJobs } from "$lib/server/notifications/drain";

export const prerender = false;
// 不要在這裡覆寫 runtime。曾釘死在 nodejs20.x，而 @supabase/realtime-js 需要
// 原生 WebSocket（Node 22+ 才內建），導致 supabaseHandle 在 hooks 階段就拋錯，
// 這支 function 每次都回平台層 500、handler 從未執行 —— 通知因此停擺 13 天，
// 且 job 停在 attempts=0 沒有任何錯誤訊息可查。
// 交給專案設定的 Node 版本（目前 24.x）即可。

function isAuthorized(request: Request): boolean {
    const expected = String(process.env.NOTIFY_DRAIN_TOKEN || "").trim();
    if (!expected) return false;

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
