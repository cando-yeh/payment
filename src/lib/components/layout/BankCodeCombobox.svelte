<script lang="ts">
    import { Input } from "$lib/components/ui/input";
    import {
        BANK_LIST,
        formatBankCodeName,
        getBankDisplayLabel,
        parseBankCode,
    } from "$lib/constants/banks";
    import { cn } from "$lib/utils";

    type SubmitMode = "code" | "code-name";

    let {
        id = "bank_code",
        name = "bank_code",
        value = $bindable(""),
        required = false,
        disabled = false,
        submitMode = "code" as SubmitMode,
        placeholder = "搜尋銀行代碼或名稱",
        class: className = "",
        inputClass = "",
    } = $props();

    let open = $state(false);
    let query = $state("");

    function normalizeSearchText(value: string): string {
        return value.replace(/[\s-]/g, "").toLowerCase();
    }

    const selectedBank = $derived(
        BANK_LIST.find((bank) => bank.code === parseBankCode(value)),
    );
    const filteredBanks = $derived(
        query.trim()
            ? BANK_LIST.filter((bank) => {
                  const normalizedQuery = normalizeSearchText(query.trim());
                  const candidates = [
                      bank.code,
                      bank.name,
                      `${bank.code}${bank.name}`,
                      `${bank.code}-${bank.name}`,
                      `${bank.code} ${bank.name}`,
                  ].map(normalizeSearchText);
                  return candidates.some((value) =>
                      value.includes(normalizedQuery),
                  );
              })
            : BANK_LIST,
    );

    function toSubmitValue(code: string): string {
        return submitMode === "code-name" ? formatBankCodeName(code) : code;
    }

    function handleSelect(code: string) {
        value = toSubmitValue(code);
        query = getBankDisplayLabel(code);
        open = false;
    }

    function handleFocus() {
        if (disabled) return;
        if (!query && selectedBank) query = getBankDisplayLabel(selectedBank.code);
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
                const matched = BANK_LIST.find((bank) => {
                    const display = getBankDisplayLabel(bank.code);
                    return (
                        bank.code === raw ||
                        bank.name === raw ||
                        `${bank.code}-${bank.name}` === raw ||
                        display === raw
                    );
                });
                if (matched) {
                    value = toSubmitValue(matched.code);
                    query = getBankDisplayLabel(matched.code);
                } else {
                    value = "";
                    query = "";
                }
                return;
            }
            const selected = BANK_LIST.find(
                (bank) => bank.code === parseBankCode(value),
            );
            if (selected) {
                query = getBankDisplayLabel(selected.code);
            } else {
                value = "";
                query = "";
            }
        }, 120);
    }

    function handleInput(inputValue: string) {
        query = inputValue;
        open = true;
        if (selectedBank && inputValue !== getBankDisplayLabel(selectedBank.code)) {
            value = "";
        }
    }

    $effect(() => {
        if (!query && selectedBank) {
            query = getBankDisplayLabel(selectedBank.code);
        }
    });
</script>

<div class={cn("relative w-full", className)}>
    <div class="relative">
        <Input
            {id}
            role="combobox"
            aria-expanded={open}
            placeholder={placeholder}
            disabled={disabled}
            value={query}
            class={cn(inputClass)}
            oninput={(event) =>
                handleInput((event.currentTarget as HTMLInputElement).value)}
            onfocus={handleFocus}
            onblur={handleBlur}
        />
    </div>

    {#if open}
        <div class="absolute z-50 mt-1 max-h-[300px] w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
            {#if filteredBanks.length === 0}
                <p class="py-6 text-center text-sm text-muted-foreground">
                    找不到符合的銀行
                </p>
            {:else}
                <div class="grid gap-1">
                    {#each filteredBanks as bank}
                        <button
                            type="button"
                            class={cn(
                                "flex h-9 w-full items-center gap-2 rounded-sm px-2 text-left text-sm hover:bg-accent",
                                selectedBank?.code === bank.code &&
                                    "bg-accent/70 font-semibold",
                            )}
                            onclick={() => handleSelect(bank.code)}
                        >
                            <span class="font-mono text-xs text-muted-foreground w-8 text-left">
                                {bank.code}
                            </span>
                            <span class="truncate">{bank.name}</span>
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}

    <input type="hidden" {name} {value} {required} />
</div>
