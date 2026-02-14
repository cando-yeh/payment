<script lang="ts">
    import { Input } from "$lib/components/ui/input";
    import { Button } from "$lib/components/ui/button";
    import * as Popover from "$lib/components/ui/popover";
    import {
        BANK_LIST,
        formatBankCodeName,
        getBankDisplayLabel,
        parseBankCode,
    } from "$lib/constants/banks";
    import { Check, Search, X } from "lucide-svelte";
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
    let searchQuery = $state("");

    // 取得當前選中的銀行資訊
    const selectedBank = $derived(
        BANK_LIST.find((b) => {
            const code = parseBankCode(value);
            return b.code === code;
        }),
    );

    // 過濾後的銀行列表
    const filteredBanks = $derived(
        searchQuery.trim() === ""
            ? BANK_LIST
            : BANK_LIST.filter(
                  (b) =>
                      b.code.includes(searchQuery) ||
                      b.name.includes(searchQuery),
              ),
    );

    function toSubmitValue(code: string): string {
        return submitMode === "code-name" ? formatBankCodeName(code) : code;
    }

    function handleSelect(code: string) {
        value = toSubmitValue(code);
        open = false;
        searchQuery = "";
    }

    function clearSelection(e: MouseEvent) {
        e.stopPropagation();
        value = "";
        searchQuery = "";
    }

    // 當 Popover 打開時，重置搜尋字串
    $effect(() => {
        if (open) {
            searchQuery = "";
        }
    });
</script>

<div class={cn("relative w-full", className)}>
    <Popover.Root bind:open>
        <Popover.Trigger {disabled}>
            {#snippet child({ props })}
                <Button
                    {...props}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    class={cn(
                        "w-full justify-start font-normal hover:bg-background px-3",
                        !selectedBank && "text-muted-foreground/60",
                        inputClass,
                    )}
                >
                    <div class="flex-1 min-w-0 text-left">
                        <span class="truncate block">
                            {selectedBank
                                ? getBankDisplayLabel(selectedBank.code)
                                : placeholder}
                        </span>
                    </div>
                </Button>
            {/snippet}
        </Popover.Trigger>
        <Popover.Content
            class="w-[--bits-popover-anchor-width] p-0"
            align="start"
        >
            <div class="flex items-center border-b px-3 h-10">
                <Search class="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <input
                    class="flex h-full w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="搜尋代碼或名稱..."
                    bind:value={searchQuery}
                />
            </div>
            <div class="max-h-[300px] overflow-y-auto p-1">
                {#if filteredBanks.length === 0}
                    <div class="py-6 text-center text-sm text-muted-foreground">
                        找不到符合的銀行
                    </div>
                {:else}
                    <div class="grid">
                        {#each filteredBanks as bank}
                            <Button
                                variant="ghost"
                                class="justify-start font-normal h-9 px-2"
                                onclick={() => handleSelect(bank.code)}
                            >
                                <Check
                                    class={cn(
                                        "mr-2 h-4 w-4",
                                        selectedBank?.code === bank.code
                                            ? "opacity-100"
                                            : "opacity-0",
                                    )}
                                />
                                <span
                                    class="font-mono text-xs text-muted-foreground mr-2 w-7"
                                >
                                    {bank.code}
                                </span>
                                <span>{bank.name}</span>
                            </Button>
                        {/each}
                    </div>
                {/if}
            </div>
        </Popover.Content>
    </Popover.Root>

    <!-- 用於表單提交 -->
    <input type="hidden" {name} {value} {required} />
</div>
