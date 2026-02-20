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
        "p-6 border-b border-border bg-background flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between",
        className,
    )}
>
    <div
        class="flex min-w-0 items-center gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:min-w-max md:flex-none md:overflow-visible"
    >
        {@render left?.()}
    </div>
    <div class="flex w-full items-center gap-3 md:w-auto md:shrink-0">
        {@render right?.()}
    </div>
</div>
