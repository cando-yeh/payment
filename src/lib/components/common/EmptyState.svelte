<script lang="ts">
    import { cn } from "$lib/utils";
    import type { ComponentType } from "svelte";

    export let icon: ComponentType;
    export let title: string | undefined = undefined;
    export let description: string | undefined = undefined;
    export let colspan: number = 1;
    export let className: string | undefined = undefined;
</script>

<tr class={cn("group hover:bg-transparent", className)}>
    <td {colspan} class="h-72 text-center">
        <div class="flex flex-col items-center justify-center space-y-4">
            <div
                class="h-16 w-16 rounded-3xl bg-secondary/30 flex items-center justify-center"
            >
                <svelte:component
                    this={icon}
                    class="h-8 w-8 text-muted-foreground/20"
                />
            </div>
            {#if title || description}
                <div class="space-y-1">
                    {#if title}
                        <h3 class="font-bold text-lg text-foreground">
                            {title}
                        </h3>
                    {/if}
                    {#if description}
                        <p class="text-muted-foreground font-bold text-sm">
                            {description}
                        </p>
                    {/if}
                </div>
            {/if}
            <slot name="action" />
        </div>
    </td>
</tr>
