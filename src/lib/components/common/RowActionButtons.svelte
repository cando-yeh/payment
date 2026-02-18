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

<div class={cn("flex items-center justify-end gap-1", className)}>
    {@render children?.()}
</div>
