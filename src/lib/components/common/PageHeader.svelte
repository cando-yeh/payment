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
        "flex flex-col justify-between gap-8 rounded-2xl border border-border/80 bg-background/95 px-6 py-5 shadow-sm md:flex-row md:items-center",
        className,
    )}
    in:fade={{ duration: 400 }}
>
    <div class="space-y-1.5">
        <h1
            class="text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.01em] text-foreground"
        >
            {title}
        </h1>
        {#if description}
            <p class="text-[15px] leading-6 font-medium text-foreground/65">
                {description}
            </p>
        {/if}
    </div>
    {@render actions?.()}
</div>
