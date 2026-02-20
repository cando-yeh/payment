<script lang="ts">
    import * as Tabs from "$lib/components/ui/tabs";
    import { cn } from "$lib/utils";
    import { LIST_TOOLBAR_TOKENS } from "$lib/components/common/list-toolbar-tokens";
    import { type Snippet } from "svelte";

    let {
        className,
        children,
        ...restProps
    }: {
        className?: string;
        children?: Snippet;
    } & Record<string, unknown> = $props();
</script>

<Tabs.List class={cn(LIST_TOOLBAR_TOKENS.tabList, className)} {...restProps}>
    {@render children?.()}
</Tabs.List>
