<script lang="ts">
    import { Input } from "$lib/components/ui/input";
    import { cn } from "$lib/utils";

    type PayeeOption = { id: string; name: string };

    let {
        value = $bindable(""),
        options = [] as PayeeOption[],
        name = "",
        required = false,
        placeholder = "請選擇收款人",
        disabled = false,
        class: className = "",
        inputClass = "",
        emptyText = "找不到符合的收款人",
    } = $props();

    let open = $state(false);
    let query = $state("");

    const selected = $derived(options.find((option) => option.id === value));
    const filteredOptions = $derived(
        query.trim()
            ? options.filter((option) =>
                  option.name.toLowerCase().includes(query.trim().toLowerCase()),
              )
            : options,
    );

    function handleSelect(nextValue: string) {
        value = nextValue;
        query = options.find((option) => option.id === nextValue)?.name || "";
        open = false;
    }

    function handleInput(valueText: string) {
        query = valueText;
        open = true;
        if (selected && valueText !== selected.name) {
            value = "";
        }
    }

    function handleFocus() {
        if (disabled) return;
        if (!query && selected) query = selected.name;
        open = true;
    }

    function handleBlur() {
        setTimeout(() => {
            open = false;
            if (!value) {
                const raw = query.trim();
                if (!raw) {
                    query = "";
                    return;
                }
                const matched = options.find((option) => option.name === raw);
                if (matched) {
                    value = matched.id;
                    query = matched.name;
                } else {
                    value = "";
                    query = "";
                }
                return;
            }
            const selectedOption = options.find((option) => option.id === value);
            if (selectedOption) {
                query = selectedOption.name;
            } else {
                value = "";
                query = "";
            }
        }, 120);
    }

    $effect(() => {
        if (!query && selected) {
            query = selected.name;
        }
    });
</script>

<div class={cn("relative w-full", className)}>
    <div class="relative">
        <Input
            role="combobox"
            aria-expanded={open}
            placeholder={placeholder}
            disabled={disabled}
            value={query}
            class={cn(inputClass)}
            oninput={(e) => handleInput((e.currentTarget as HTMLInputElement).value)}
            onfocus={handleFocus}
            onblur={handleBlur}
        />
    </div>

    {#if open}
        <div class="absolute z-50 mt-1 max-h-[260px] w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
            {#if filteredOptions.length === 0}
                <p class="py-3 text-center text-sm text-muted-foreground">
                    {emptyText}
                </p>
            {:else}
                {#each filteredOptions as option}
                    <button
                        type="button"
                        class={cn(
                            "flex h-9 w-full items-center rounded-sm px-2 text-left text-sm hover:bg-accent",
                            option.id === value && "bg-accent/70 font-semibold",
                        )}
                        onclick={() => handleSelect(option.id)}
                    >
                        <span class="truncate">{option.name}</span>
                    </button>
                {/each}
            {/if}
        </div>
    {/if}
</div>

{#if name}
    <input type="hidden" {name} {value} {required} />
{/if}
