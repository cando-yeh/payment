<script lang="ts">
    import { cn } from "$lib/utils";
    import { getClaimStatusLabel } from "$lib/claims/constants";
    import AppBadge from "$lib/components/common/AppBadge.svelte";
    import { Clock, User, MessageCircle } from "lucide-svelte";

    interface HistoryItem {
        id: string;
        action: string;
        from_status: string;
        to_status: string;
        comment: string | null;
        created_at: string;
        actor: {
            full_name: string;
        };
    }

    let { history }: { history: HistoryItem[] } = $props();

    const actionMap: Record<string, string> = {
        submit: "送出申請",
        approve: "審核通過",
        reject: "審核駁回",
        pay: "完成撥款",
        withdraw: "撤回草稿",
        cancel: "撤銷申請",
    };

    function getStatusChangeLabel(item: HistoryItem): string {
        const from = item.from_status;
        const to = item.to_status;

        if (from === "paid" && to === "pending_payment") return "撤銷撥款";
        if (from === "pending_payment" && to === "pending_finance")
            return "退回財審";
        if (from === "pending_payment" && to === "paid") return "完成撥款";
        if (from === "pending_payment" && to === "paid_pending_doc")
            return "完成撥款";
        if (from === "paid_pending_doc" && to === "pending_doc_review")
            return "補件送審";
        if (from === "pending_doc_review" && to === "paid_pending_doc")
            return "退回補件";
        return "狀態異動";
    }

    function getActionLabel(item: HistoryItem): string {
        if (item.action === "status_change") return getStatusChangeLabel(item);
        return actionMap[item.action] || "狀態異動";
    }

    function formatDate(date: string) {
        return new Date(date).toLocaleString("zh-TW", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }
</script>

{#if history && history.length > 0}
    <div class="space-y-6">
        {#each history as item, i}
            <div class="flex gap-4 relative">
                <!-- Connector Line -->
                {#if i !== history.length - 1}
                    <div
                        class="absolute left-[11px] top-6 w-[2px] h-[calc(100%+8px)] bg-muted/60"
                    ></div>
                {/if}

                <!-- Icon/Dot -->
                <div
                    class={cn(
                        "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground",
                        item.action === "approve" &&
                            "text-green-600 border-green-200 bg-green-50",
                        item.action === "reject" &&
                            "text-red-600 border-red-200 bg-red-50",
                        item.action === "submit" &&
                            "text-blue-600 border-blue-200 bg-blue-50",
                    )}
                >
                    {#if item.action === "submit"}
                        <Clock class="h-3 w-3" />
                    {:else if item.action === "approve" || item.action === "pay"}
                        <User class="h-3 w-3" />
                    {:else}
                        <Clock class="h-3 w-3" />
                    {/if}
                </div>

                <!-- Content -->
                <div class="flex-1 pb-4">
                    <div class="flex items-center justify-between mb-1">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-sm">
                                {getActionLabel(item)}
                            </span>
                            <span class="text-xs text-muted-foreground">
                                • {item.actor?.full_name || "系統"}
                            </span>
                        </div>
                        <time class="text-xs text-muted-foreground">
                            {formatDate(item.created_at)}
                        </time>
                    </div>

                    <div class="flex flex-wrap gap-2 items-center mb-2">
                        {#if item.from_status}
                            <AppBadge
                                preset="timeline.from"
                                label={getClaimStatusLabel(item.from_status)}
                            />
                            <span class="text-muted-foreground text-[10px]"
                                >→</span
                            >
                        {/if}
                        <AppBadge
                            preset="timeline.to"
                            label={getClaimStatusLabel(item.to_status)}
                        />
                    </div>

                    {#if item.comment}
                        <div
                            class="mt-2 text-sm bg-muted/30 p-2 rounded-md border border-muted/50 flex gap-2 italic text-muted-foreground"
                        >
                            <MessageCircle
                                class="h-4 w-4 shrink-0 mt-0.5 opacity-50"
                            />
                            <span>{item.comment}</span>
                        </div>
                    {/if}
                </div>
            </div>
        {/each}
    </div>
{:else}
    <div class="text-center py-8 text-muted-foreground italic text-sm">
        尚無審核歷程紀錄
    </div>
{/if}
