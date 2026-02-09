<script lang="ts">
    import { Dialog as DialogPrimitive } from "bits-ui";
    import SheetPortal from "./sheet-portal.svelte";
    import SheetOverlay from "./sheet-overlay.svelte";
    import XIcon from "lucide-svelte/icons/x";
    import type { Snippet } from "svelte";
    import { cn } from "$lib/utils.js";

    let {
        ref = $bindable(null),
        class: className,
        portalProps,
        children,
        ...restProps
    }: DialogPrimitive.ContentProps & {
        portalProps?: any;
        children: Snippet;
    } = $props();
</script>

<SheetPortal {...portalProps}>
    <SheetOverlay />
    <DialogPrimitive.Content
        bind:ref
        class={cn(
            "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 gap-4 p-6 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
            "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
            className,
        )}
        {...restProps}
    >
        {@render children?.()}
        <DialogPrimitive.Close
            class="ring-offset-background focus:ring-ring absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none"
        >
            <XIcon class="h-4 w-4" />
            <span class="sr-only">Close</span>
        </DialogPrimitive.Close>
    </DialogPrimitive.Content>
</SheetPortal>
