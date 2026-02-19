<script lang="ts">
    import PageHeader from "$lib/components/common/PageHeader.svelte";
    import { type Snippet } from "svelte";

    let {
        title,
        description,
        statText,
        className,
        statIcon,
        children,
    }: {
        title: string;
        description?: string;
        statText?: string;
        className?: string;
        statIcon?: Snippet;
        children?: Snippet;
    } = $props();
</script>

{#snippet headerActions()}
    <div class="flex items-center gap-3">
        {#if statText}
            <div
                class="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/70 px-4 py-2"
            >
                {@render statIcon?.()}
                <span class="text-xs font-semibold tracking-wide text-foreground/75"
                    >{statText}</span
                >
            </div>
        {/if}
        {@render children?.()}
    </div>
{/snippet}

<PageHeader {title} {description} className={className} actions={headerActions} />
