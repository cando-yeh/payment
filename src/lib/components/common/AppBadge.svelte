<script lang="ts">
    import { Badge } from "$lib/components/ui/badge";
    import { cn } from "$lib/utils";
    import {
        APP_BADGE_PRESET,
        APP_BADGE_SHAPE_CLASS,
        APP_BADGE_SIZE_CLASS,
        APP_BADGE_TONE,
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

    const presetDef = $derived(
        (preset ? APP_BADGE_PRESET[preset] : undefined) as
            | AppBadgePreset
            | undefined,
    );
    const resolvedTone = $derived(presetDef?.tone || tone);
    const resolvedLabel = $derived(label || presetDef?.label || tone);
    const resolvedSize = $derived(presetDef?.size || size);
    const resolvedShape = $derived(presetDef?.shape || shape);
    const toneDef = $derived(
        APP_BADGE_TONE[resolvedTone] || {
            variant: "outline",
            className: "text-muted-foreground",
        },
    );
</script>

<Badge
    variant={toneDef.variant}
    class={cn(
        APP_BADGE_SIZE_CLASS[resolvedSize],
        APP_BADGE_SHAPE_CLASS[resolvedShape],
        toneDef.className,
        className,
    )}
>
    {resolvedLabel}
</Badge>
