<script lang="ts">
    import { Badge } from "$lib/components/ui/badge";
    import { cn } from "$lib/utils";
    import {
        APP_BADGE_PRESET,
        APP_BADGE_SHAPE_CLASS,
        APP_BADGE_SIZE_CLASS,
        type AppBadgePreset,
        type AppBadgeShape,
        type AppBadgeSize,
    } from "$lib/components/common/badge-tokens";

    let {
        preset,
        tone = "status.draft",
        label,
        size = "sm",
        shape = "pill",
        className,
    }: {
        preset?: string;
        tone?: string;
        label?: string;
        size?: AppBadgeSize;
        shape?: AppBadgeShape;
        className?: string;
    } = $props();

    const resolvedKey = $derived(preset || tone);
    const presetDef = $derived(
        APP_BADGE_PRESET[resolvedKey] as AppBadgePreset | undefined,
    );
    const resolvedLabel = $derived(label || presetDef?.label || resolvedKey);
    const resolvedSize = $derived(presetDef?.size || size);
    const resolvedShape = $derived(presetDef?.shape || shape);
    const resolvedVariant = $derived(presetDef?.variant || "outline");
    const resolvedToneClass = $derived(
        presetDef?.className || "text-muted-foreground",
    );
</script>

<Badge
    variant={resolvedVariant}
    class={cn(
        APP_BADGE_SIZE_CLASS[resolvedSize],
        APP_BADGE_SHAPE_CLASS[resolvedShape],
        resolvedToneClass,
        className,
    )}
>
    {resolvedLabel}
</Badge>
