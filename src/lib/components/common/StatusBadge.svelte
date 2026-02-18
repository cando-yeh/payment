<script lang="ts">
    import AppBadge from "$lib/components/common/AppBadge.svelte";

    let {
        status,
        className,
    }: {
        status: string;
        className?: string;
    } = $props();
</script>

<AppBadge preset={`status.${status}`} {className} />
