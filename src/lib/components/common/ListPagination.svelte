<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { ChevronLeft, ChevronRight } from "lucide-svelte";

    let {
        totalItems = 0,
        pageSize = 10,
        currentPage = $bindable(1),
        className = "",
    }: {
        totalItems: number;
        pageSize?: number;
        currentPage?: number;
        className?: string;
    } = $props();

    const totalPages = $derived(Math.max(1, Math.ceil(totalItems / pageSize)));
    const hasPagination = $derived(totalItems > pageSize);
    const safePage = $derived.by(() => {
        if (currentPage < 1) return 1;
        if (currentPage > totalPages) return totalPages;
        return currentPage;
    });

    $effect(() => {
        if (currentPage !== safePage) currentPage = safePage;
    });

    const from = $derived((safePage - 1) * pageSize + 1);
    const to = $derived(Math.min(safePage * pageSize, totalItems));
</script>

{#if hasPagination}
    <div
        class={`mt-3 flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground ${className}`.trim()}
    >
        <div>
            顯示 {from}-{to} / 共 {totalItems} 筆
        </div>
        <div class="flex items-center gap-2">
            <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-8 w-8 p-0"
                aria-label="上一頁"
                disabled={safePage <= 1}
                onclick={() => (currentPage = Math.max(1, safePage - 1))}
            >
                <ChevronLeft class="h-4 w-4" />
            </Button>
            <span class="min-w-[72px] text-center">
                第 {safePage} / {totalPages} 頁
            </span>
            <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-8 w-8 p-0"
                aria-label="下一頁"
                disabled={safePage >= totalPages}
                onclick={() =>
                    (currentPage = Math.min(totalPages, safePage + 1))}
            >
                <ChevronRight class="h-4 w-4" />
            </Button>
        </div>
    </div>
{/if}
