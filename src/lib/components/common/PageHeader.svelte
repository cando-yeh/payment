<script lang="ts">
    import { fade } from "svelte/transition";
    import { cn } from "$lib/utils";
    import { type Snippet } from "svelte";

    let {
        title,
        description,
        className,
        actions,
    }: {
        title: string;
        description?: string;
        className?: string;
        actions?: Snippet;
    } = $props();
</script>

<div
    class={cn(
        "flex flex-col md:flex-row md:items-center justify-between gap-8",
        className,
    )}
    in:fade={{ duration: 400 }}
>
    <div class="space-y-1.5">
        <h1 class="text-3xl font-bold tracking-tight text-foreground">
            {title}
        </h1>
        {#if description}
            <p class="text-muted-foreground text-sm font-medium">
                {description}
            </p>
        {/if}
    </div>
    {@render actions?.()}
</div>
