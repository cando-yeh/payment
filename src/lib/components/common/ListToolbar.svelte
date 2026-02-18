<script lang="ts">
    import { cn } from "$lib/utils";
    import { type Snippet } from "svelte";

    let {
        className,
        left,
        right,
    }: {
        className?: string;
        left?: Snippet;
        right?: Snippet;
    } = $props();
</script>

<div
    class={cn(
        "p-6 border-b border-border bg-background flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
        className,
    )}
>
    <div
        class="flex min-w-0 items-center gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-1"
    >
        {@render left?.()}
    </div>
    <div class="flex items-center gap-3 lg:shrink-0">
        {@render right?.()}
    </div>
</div>
