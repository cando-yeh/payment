<script lang="ts">
    import { Input } from "$lib/components/ui/input";
    import { Search } from "lucide-svelte";
    import { cn } from "$lib/utils";

    let {
        value = $bindable(""),
        placeholder = "搜尋...",
        className,
        inputClassName,
        widthClass = "w-full md:w-[214px]",
        oninput,
    }: {
        value?: string;
        placeholder?: string;
        className?: string;
        inputClassName?: string;
        widthClass?: string;
        oninput?: (event: Event) => void;
    } = $props();
</script>

<div class={cn("relative group", widthClass, className)}>
    <Search
        class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/80 group-focus-within:text-primary transition-colors"
    />
    <Input
        type="search"
        {placeholder}
        class={cn(
            "pl-10 pr-4 h-10 rounded-xl border border-border bg-background shadow-xs focus:border-primary/45 focus:ring-primary/25 transition-all text-sm font-medium",
            inputClassName,
        )}
        bind:value
        {oninput}
    />
</div>
