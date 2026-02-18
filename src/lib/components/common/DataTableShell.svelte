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
        "rounded-3xl border border-border/50 bg-background shadow-sm overflow-hidden",
        className,
    )}
>
    {@render children?.()}
</div>
