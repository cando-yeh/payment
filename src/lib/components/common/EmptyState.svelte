<script lang="ts">
    import { cn } from "$lib/utils";
    import { type Component, type Snippet } from "svelte";

    let {
        icon: Icon,
        title,
        description,
        colspan = 1,
        className,
        action,
    }: {
        icon: any;
        title?: string;
        description?: string;
        colspan?: number;
        className?: string;
        action?: Snippet;
    } = $props();
</script>

<tr class={cn("group hover:bg-transparent", className)}>
    <td {colspan} class="h-72 text-center">
        <div class="flex flex-col items-center justify-center space-y-4">
            <div
                class="h-16 w-16 rounded-3xl bg-linear-to-br from-primary/14 to-accent/35 flex items-center justify-center border border-border/40"
            >
                <Icon class="h-8 w-8 text-primary/55" />
            </div>
            {#if title || description}
                <div class="space-y-1">
                    {#if title}
                        <h3 class="font-bold text-lg text-foreground">
                            {title}
                        </h3>
                    {/if}
                    {#if description}
                        <p class="text-muted-foreground font-medium text-sm">
                            {description}
                        </p>
                    {/if}
                </div>
            {/if}
            {@render action?.()}
        </div>
    </td>
</tr>
