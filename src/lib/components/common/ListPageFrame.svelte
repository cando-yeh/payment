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

<div class={cn("space-y-10 pb-12", className)}>
    {@render children?.()}
</div>
