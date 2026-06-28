/**
 * 請款單附件自動命名
 *
 * 規則：日期_發票號碼_費用類別_金額.副檔名
 *   例：2026-05-14_BM46971952_勞務費_200000.pdf
 *
 * 設計重點：
 * - 命名在「提交請款單」時計算，因部分欄位（發票號碼、金額、類別）會在編輯時變動。
 * - 不搬動 storage 實體檔（避免複製/刪除與路徑驗證風險），只更新 claim_items.extra.original_name；
 *   下載 API 以此名稱輸出檔名。
 */

// 檔名非法字元。刻意保留連字號（-）與空白，日期與部分發票號碼會用到。
const ILLEGAL_CHARS = new Set(["\\", "/", ":", "*", "?", '"', "<", ">", "|"]);

/** 移除檔名非法字元與控制字元。 */
function stripIllegal(value: unknown): string {
    let out = "";
    for (const ch of String(value ?? "")) {
        if (ILLEGAL_CHARS.has(ch)) continue;
        if (ch.charCodeAt(0) < 0x20) continue;
        out += ch;
    }
    return out;
}

function clean(value: unknown): string {
    return stripIllegal(value).replace(/\s+/g, " ").trim();
}

/** 取 YYYY-MM-DD；無法解析時用 fallback，再無則「無日期」。 */
function formatDate(value: unknown, fallback?: string): string {
    const raw = String(value ?? "").trim();
    const match = raw.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
    const fb = String(fallback ?? "").trim();
    const fbMatch = fb.match(/^\d{4}-\d{2}-\d{2}/);
    if (fbMatch) return fbMatch[0];
    return "無日期";
}

/** 由現有 original_name 或 file_path 推回副檔名（含點，如 ".pdf"）。 */
function getExtension(extra: Record<string, unknown> | null | undefined): string {
    const originalName = String(extra?.original_name ?? "");
    const filePath = String(extra?.file_path ?? "");
    const source = originalName.includes(".") ? originalName : filePath;
    if (!source.includes(".")) return "";
    const ext = source.split(".").pop() || "";
    const safeExt = clean(ext).toLowerCase();
    return safeExt ? `.${safeExt}` : "";
}

export type AttachmentNamingItem = {
    id: string;
    item_index?: number | null;
    date_start?: string | null;
    invoice_number?: string | null;
    category?: string | null;
    amount?: number | string | null;
    extra?: Record<string, unknown> | null;
};

/** 組出不含副檔名的基底檔名：日期_發票號碼_費用類別_金額 */
export function buildAttachmentBaseName(
    item: AttachmentNamingItem,
    fallbackDate?: string
): string {
    const date = formatDate(item.date_start, fallbackDate);
    const invoice = clean(item.invoice_number) || "無發票";
    const category = clean(item.category) || "未分類";
    const amount = Math.round(Number(item.amount) || 0).toString();
    return `${date}_${invoice}_${category}_${amount}`;
}

function hasFilePath(item: AttachmentNamingItem): boolean {
    return (
        !!item.extra &&
        typeof item.extra.file_path === "string" &&
        String(item.extra.file_path).trim().length > 0
    );
}

/**
 * 計算每筆「有附件」明細的完整檔名（含副檔名）。
 * 同一張單若基底檔名重複，結尾加「_項N」（N = item_index）以保持唯一。
 * 回傳 Map<claim_item.id, filename>。
 */
export function computeAttachmentNames(
    items: AttachmentNamingItem[],
    fallbackDate?: string
): Map<string, string> {
    const withFile = items.filter(hasFilePath);

    const baseById = new Map<string, string>();
    const baseCounts = new Map<string, number>();
    for (const item of withFile) {
        const base = buildAttachmentBaseName(item, fallbackDate);
        baseById.set(item.id, base);
        baseCounts.set(base, (baseCounts.get(base) || 0) + 1);
    }

    const result = new Map<string, string>();
    for (const item of withFile) {
        let base = baseById.get(item.id) as string;
        if ((baseCounts.get(base) || 0) > 1) {
            const idx = Number(item.item_index);
            base = `${base}_項${Number.isFinite(idx) && idx > 0 ? idx : "?"}`;
        }
        result.set(item.id, `${base}${getExtension(item.extra)}`);
    }
    return result;
}

/**
 * 讀取該請款單所有明細，將有附件者的 extra.original_name 更新為自動命名。
 * best-effort：命名失敗只記錄、不阻擋提交流程。
 */
export async function applyClaimAttachmentNames(
    supabase: App.Locals["supabase"],
    claimId: string
): Promise<void> {
    try {
        const { data: claim } = await supabase
            .from("claims")
            .select("created_at")
            .eq("id", claimId)
            .single();
        const fallbackDate = claim?.created_at
            ? String(claim.created_at).slice(0, 10)
            : undefined;

        const { data: items } = await supabase
            .from("claim_items")
            .select("id, item_index, date_start, invoice_number, category, amount, extra")
            .eq("claim_id", claimId);

        if (!items || items.length === 0) return;

        const names = computeAttachmentNames(items as AttachmentNamingItem[], fallbackDate);
        if (names.size === 0) return;

        await Promise.all(
            Array.from(names.entries()).map(([id, filename]) => {
                const item = items.find((i: any) => i.id === id);
                const nextExtra = {
                    ...((item?.extra as Record<string, unknown>) || {}),
                    original_name: filename
                };
                return supabase.from("claim_items").update({ extra: nextExtra }).eq("id", id);
            })
        );
    } catch (err) {
        console.error("applyClaimAttachmentNames failed:", err);
    }
}
