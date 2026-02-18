<script lang="ts">
    import EmptyState from "$lib/components/common/EmptyState.svelte";
    import { type Component, type Snippet } from "svelte";

    let {
        icon,
        description = "目前尚無資料",
        colspan = 1,
        action,
    }: {
        icon: any;
        description?: string;
        colspan?: number;
        action?: Snippet;
    } = $props();
</script>

<EmptyState {icon} {description} {colspan} {action} />
