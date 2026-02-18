import type { BadgeVariant } from "$lib/components/ui/badge";

export type AppBadgeSize = "xs" | "sm" | "md";
export type AppBadgeShape = "pill" | "rounded";
export type AppBadgePreset = {
    tone: string;
    label: string;
    size?: AppBadgeSize;
    shape?: AppBadgeShape;
};

export const APP_BADGE_SIZE_CLASS: Record<AppBadgeSize, string> = {
    xs: "text-[10px] h-4 px-2 py-0",
    sm: "text-xs h-5 px-2.5 py-0",
    md: "text-sm h-6 px-3 py-0.5",
};

export const APP_BADGE_SHAPE_CLASS: Record<AppBadgeShape, string> = {
    pill: "rounded-full",
    rounded: "rounded-md",
};

export const APP_BADGE_TONE: Record<
    string,
    { variant: BadgeVariant; className: string }
> = {
    "status.available": {
        variant: "secondary",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    "status.enabled": {
        variant: "secondary",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    "status.active": {
        variant: "secondary",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    "status.disabled": {
        variant: "secondary",
        className: "bg-slate-100 text-slate-700 border-slate-200",
    },
    "status.inactive": {
        variant: "secondary",
        className: "bg-slate-100 text-slate-700 border-slate-200",
    },
    "status.pending_create": {
        variant: "secondary",
        className: "bg-amber-100 text-amber-700 border-amber-200",
    },
    "status.pending_update": {
        variant: "secondary",
        className: "bg-cyan-100 text-cyan-800 border-cyan-200",
    },
    "status.pending_disable": {
        variant: "secondary",
        className: "bg-rose-100 text-rose-700 border-rose-200",
    },
    "status.draft": {
        variant: "secondary",
        className: "bg-slate-100 text-slate-600 border-slate-200",
    },
    "status.pending_manager": {
        variant: "secondary",
        className: "bg-amber-100 text-amber-700 border-amber-200",
    },
    "status.pending_finance": {
        variant: "secondary",
        className: "bg-cyan-100 text-cyan-800 border-cyan-200",
    },
    "status.pending_payment": {
        variant: "secondary",
        className: "bg-violet-100 text-violet-700 border-violet-200",
    },
    "status.paid": {
        variant: "secondary",
        className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    "status.paid_pending_doc": {
        variant: "secondary",
        className: "bg-orange-100 text-orange-800 border-orange-200",
    },
    "status.pending_doc_review": {
        variant: "secondary",
        className: "bg-orange-100 text-orange-800 border-orange-200",
    },
    "status.returned": {
        variant: "secondary",
        className: "bg-rose-100 text-rose-800 border-rose-200",
    },
    "status.cancelled": {
        variant: "secondary",
        className: "bg-slate-100 text-slate-700 border-slate-200",
    },
    "role.admin": {
        variant: "secondary",
        className: "bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap",
    },
    "role.finance": {
        variant: "secondary",
        className:
            "bg-amber-50 text-amber-700 border-amber-200 whitespace-nowrap",
    },
    "role.employee": {
        variant: "outline",
        className: "whitespace-nowrap",
    },
    "claim.type": {
        variant: "secondary",
        className: "font-bold",
    },
    "timeline.from": {
        variant: "outline",
        className: "font-normal opacity-60",
    },
    "timeline.to": {
        variant: "outline",
        className: "font-normal bg-muted/20",
    },
};

export const APP_BADGE_PRESET: Record<string, AppBadgePreset> = {
    "status.available": { tone: "status.available", label: "已啟用" },
    "status.enabled": { tone: "status.enabled", label: "啟用中" },
    "status.active": { tone: "status.active", label: "啟用中" },
    "status.disabled": { tone: "status.disabled", label: "已停用" },
    "status.inactive": { tone: "status.inactive", label: "已停用" },
    "status.pending_create": { tone: "status.pending_create", label: "待審核 (新增)" },
    "status.pending_update": { tone: "status.pending_update", label: "待審核 (更新)" },
    "status.pending_disable": { tone: "status.pending_disable", label: "待審核 (停用)" },
    "status.draft": { tone: "status.draft", label: "草稿" },
    "status.pending_manager": { tone: "status.pending_manager", label: "待主管審核" },
    "status.pending_finance": { tone: "status.pending_finance", label: "待財務審核" },
    "status.pending_payment": { tone: "status.pending_payment", label: "待付款" },
    "status.paid": { tone: "status.paid", label: "已撥款" },
    "status.paid_pending_doc": { tone: "status.paid_pending_doc", label: "待補件" },
    "status.pending_doc_review": { tone: "status.pending_doc_review", label: "待補件審核" },
    "status.returned": { tone: "status.returned", label: "已退回" },
    "status.cancelled": { tone: "status.cancelled", label: "已沖帳" },
    "role.admin": { tone: "role.admin", label: "管理員" },
    "role.finance": { tone: "role.finance", label: "財務" },
    "role.employee": { tone: "role.employee", label: "員工" },
    "claim.type": { tone: "claim.type", label: "請款類型" },
    "timeline.from": { tone: "timeline.from", label: "來源", size: "xs" },
    "timeline.to": { tone: "timeline.to", label: "目標", size: "xs" },
};
