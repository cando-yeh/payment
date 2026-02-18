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
        "p-6 border-b border-border/30 flex flex-col md:flex-row md:items-center justify-between gap-6",
        className,
    )}
>
    <div class="flex items-center gap-3 flex-wrap">
        {@render left?.()}
    </div>
    <div class="flex items-center gap-3 flex-wrap">
        {@render right?.()}
    </div>
</div>
