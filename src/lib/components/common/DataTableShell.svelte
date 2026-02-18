<script lang="ts">
    import { cn } from "$lib/utils";
    import { type Snippet } from "svelte";

    let {
        className,
        children,
    }: {
        className?: string;
        children?: Snippet;
    } = $props();
</script>

<div
    class={cn(
        "rounded-3xl border border-border/70 bg-background/95 shadow-md shadow-primary/7 overflow-hidden backdrop-blur-[1px]",
        className,
    )}
>
    {@render children?.()}
</div>
