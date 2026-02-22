import type { BadgeVariant } from "$lib/components/ui/badge";

export type AppBadgeSize = "xs" | "sm" | "md";
export type AppBadgeShape = "pill" | "rounded";
export type AppBadgePreset = {
    label: string;
    variant: BadgeVariant;
    className: string;
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

export const APP_BADGE_PRESET: Record<string, AppBadgePreset> = {
    "status.available": {
        label: "已啟用",
        variant: "secondary",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    "status.enabled": {
        label: "啟用中",
        variant: "secondary",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    "status.active": {
        label: "啟用中",
        variant: "secondary",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    "status.disabled": {
        label: "已停用",
        variant: "secondary",
        className: "bg-slate-100 text-slate-700 border-slate-200",
    },
    "status.inactive": {
        label: "已停用",
        variant: "secondary",
        className: "bg-slate-100 text-slate-700 border-slate-200",
    },
    "status.pending_create": {
        label: "待審核 (新增)",
        variant: "secondary",
        className: "bg-amber-100 text-amber-700 border-amber-200",
    },
    "status.pending_update": {
        label: "待審核 (更新)",
        variant: "secondary",
        className: "bg-cyan-100 text-cyan-800 border-cyan-200",
    },
    "status.pending_disable": {
        label: "待審核 (停用)",
        variant: "secondary",
        className: "bg-rose-100 text-rose-700 border-rose-200",
    },
    "status.draft": {
        label: "草稿",
        variant: "secondary",
        className: "bg-slate-100 text-slate-600 border-slate-200",
    },
    "status.pending_manager": {
        label: "待主管審核",
        variant: "secondary",
        className: "bg-amber-100 text-amber-700 border-amber-200",
    },
    "status.pending_finance": {
        label: "待財務審核",
        variant: "secondary",
        className: "bg-cyan-100 text-cyan-800 border-cyan-200",
    },
    "status.pending_payment": {
        label: "待付款",
        variant: "secondary",
        className: "bg-violet-100 text-violet-700 border-violet-200",
    },
    "status.paid": {
        label: "已撥款",
        variant: "secondary",
        className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    "status.paid_pending_doc": {
        label: "待補件",
        variant: "secondary",
        className: "bg-orange-100 text-orange-800 border-orange-200",
    },
    "status.pending_doc_review": {
        label: "待補件審核",
        variant: "secondary",
        className: "bg-orange-100 text-orange-800 border-orange-200",
    },
    "status.rejected": {
        label: "已退件",
        variant: "secondary",
        className: "bg-rose-100 text-rose-800 border-rose-200",
    },
    "status.cancelled": {
        label: "已撤銷",
        variant: "secondary",
        className: "bg-slate-100 text-slate-700 border-slate-200",
    },
    "payment.reversed": {
        label: "已沖帳",
        variant: "secondary",
        className: "bg-slate-100 text-slate-700 border-slate-200",
    },
    "role.admin": {
        label: "管理員",
        variant: "secondary",
        className: "bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap",
    },
    "role.finance": {
        label: "財務",
        variant: "secondary",
        className: "bg-amber-50 text-amber-700 border-amber-200 whitespace-nowrap",
    },
    "role.employee": {
        label: "員工",
        variant: "outline",
        className: "whitespace-nowrap",
    },
    "claim.type.employee": {
        label: "員工報銷",
        variant: "secondary",
        className: "bg-sky-100 text-sky-800 border-sky-200 whitespace-nowrap",
    },
    "claim.type.vendor": {
        label: "廠商請款",
        variant: "secondary",
        className: "bg-violet-100 text-violet-800 border-violet-200 whitespace-nowrap",
    },
    "claim.type.personal_service": {
        label: "個人勞務",
        variant: "secondary",
        className: "bg-emerald-100 text-emerald-800 border-emerald-200 whitespace-nowrap",
    },
    "timeline.from": {
        label: "來源",
        size: "xs",
        variant: "outline",
        className: "font-normal opacity-60",
    },
    "timeline.to": {
        label: "目標",
        size: "xs",
        variant: "outline",
        className: "font-normal bg-muted/20",
    },
};
