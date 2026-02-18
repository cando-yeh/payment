<script lang="ts">
    import { cn } from "$lib/utils.js";

    let {
        checked = $bindable(false),
        disabled = false,
        class: className,
        id,
        name,
        "aria-label": ariaLabel,
        ...restProps
    }: {
        checked?: boolean;
        disabled?: boolean;
        class?: string;
        id?: string;
        name?: string;
        "aria-label"?: string;
        [key: string]: any;
    } = $props();

    function toggle() {
        if (disabled) return;
        checked = !checked;
    }
</script>

<button
    type="button"
    role="switch"
    {id}
    {name}
    aria-checked={checked}
    aria-label={ariaLabel}
    {disabled}
    data-slot="switch"
    class={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors outline-none",
        "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        checked ? "bg-primary" : "bg-muted-foreground/30",
        disabled ? "cursor-not-allowed opacity-50" : "",
        className,
    )}
    onclick={toggle}
    {...restProps}
>
    <span
        class={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-sm ring-0 transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
        )}
    ></span>
</button>
