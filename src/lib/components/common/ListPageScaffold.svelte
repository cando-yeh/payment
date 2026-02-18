<script lang="ts">
    import { type Snippet } from "svelte";
    import ListPageFrame from "$lib/components/common/ListPageFrame.svelte";
    import ListPageHeader from "$lib/components/common/ListPageHeader.svelte";
    import DataTableShell from "$lib/components/common/DataTableShell.svelte";

    let {
        title,
        description,
        statText,
        statIcon,
        frameClassName,
        shellClassName = "pb-2",
        headerActions,
        children,
    }: {
        title: string;
        description?: string;
        statText?: string;
        statIcon?: Snippet;
        frameClassName?: string;
        shellClassName?: string;
        headerActions?: Snippet;
        children?: Snippet;
    } = $props();
</script>

<ListPageFrame className={frameClassName}>
    <ListPageHeader {title} {description} {statText} {statIcon}>
        {@render headerActions?.()}
    </ListPageHeader>

    <DataTableShell className={shellClassName}>
        {@render children?.()}
    </DataTableShell>
</ListPageFrame>
