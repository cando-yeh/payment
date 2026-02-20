<script lang="ts">
    import * as Tabs from "$lib/components/ui/tabs";
    import { cn } from "$lib/utils";
    import { LIST_TOOLBAR_TOKENS } from "$lib/components/common/list-toolbar-tokens";
    import { type Snippet } from "svelte";

    let {
        value,
        count = 0,
        className,
        children,
        ...restProps
    }: {
        value: string;
        count?: number;
        className?: string;
        children?: Snippet;
    } & Record<string, unknown> = $props();
</script>

<Tabs.Trigger
    value={value}
    class={cn(LIST_TOOLBAR_TOKENS.tabTrigger, className)}
    {...restProps}
>
    {@render children?.()}
    {#if count > 0}
        <span class={LIST_TOOLBAR_TOKENS.counterBadge}>{count}</span>
    {/if}
</Tabs.Trigger>
