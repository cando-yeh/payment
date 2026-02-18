<script lang="ts">
    import * as Table from "$lib/components/ui/table";
    import { Landmark, Calendar, User } from "lucide-svelte";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import ListPageScaffold from "$lib/components/common/ListPageScaffold.svelte";
    import ListToolbar from "$lib/components/common/ListToolbar.svelte";
    import SearchField from "$lib/components/common/SearchField.svelte";
    import StatusBadge from "$lib/components/common/StatusBadge.svelte";
    import ListTableEmptyState from "$lib/components/common/ListTableEmptyState.svelte";
    import { FileText } from "lucide-svelte";
    import { LIST_TABLE_TOKENS } from "$lib/components/common/list-table-tokens";
    import { cn } from "$lib/utils";
    import { fade } from "svelte/transition";

    let { data }: { data: PageData } = $props();
    let { payments } = $derived(data);
    let searchTerm = $state("");

    let filteredPayments = $derived.by(() => {
        const normalized = searchTerm.trim().toLowerCase();
        if (!normalized) return payments;
        return payments.filter((payment) => {
            const id = String(payment.id || "").toLowerCase();
            const payee = String(payment.payee_name || "").toLowerCase();
            return id.includes(normalized) || payee.includes(normalized);
        });
    });

    function formatDate(date: string) {
        if (!date) return "-";
        return new Date(date).toLocaleDateString("zh-TW", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
    }

    function formatAmount(amount: number) {
        return new Intl.NumberFormat("zh-TW", {
            style: "currency",
            currency: "TWD",
            maximumFractionDigits: 0,
        }).format(amount);
    }

    function splitAmountParts(amount: number) {
        const formatted = formatAmount(amount);
        const match = formatted.match(/^([^0-9-]*)(.*)$/);
        return {
            symbol: (match?.[1] || "NT$").trim(),
            value: (match?.[2] || formatted).trim(),
        };
    }
</script>

<div in:fade={{ duration: 400 }}>
    <ListPageScaffold
        title="付款歷史"
        description="檢視所有已產生的付款單及撥款紀錄。"
        statText={`${payments.length} 筆付款`}
        shellClassName="pb-2"
    >
        {#snippet statIcon()}
            <Landmark class="h-4 w-4 text-muted-foreground" />
        {/snippet}
        
        <ListToolbar>
            {#snippet left()}
                <div class="text-sm font-medium text-muted-foreground">
                    撥款紀錄
                </div>
            {/snippet}
            {#snippet right()}
                <SearchField
                    bind:value={searchTerm}
                    placeholder="搜尋付款單 ID 或收款人..."
                />
            {/snippet}
        </ListToolbar>
        <div class="m-0">
            <Table.Root>
                    <Table.Header class={LIST_TABLE_TOKENS.header}>
                        <Table.Row class={LIST_TABLE_TOKENS.headerRow}>
                            <Table.Head
                                class={cn(
                                    LIST_TABLE_TOKENS.headBase,
                                    LIST_TABLE_TOKENS.colId,
                                )}
                                >付款單 ID</Table.Head
                            >
                            <Table.Head class={LIST_TABLE_TOKENS.headBase}
                                >收款人</Table.Head
                            >
                            <Table.Head
                                class={cn(
                                    LIST_TABLE_TOKENS.headBase,
                                    LIST_TABLE_TOKENS.colAmount,
                                    "text-right",
                                )}
                                >總金額</Table.Head
                            >
                            <Table.Head
                                class={cn(
                                    LIST_TABLE_TOKENS.headBase,
                                    LIST_TABLE_TOKENS.colDate,
                                )}
                                >撥款時間</Table.Head
                            >
                            <Table.Head class={LIST_TABLE_TOKENS.headBase}
                                >經辦人</Table.Head
                            >
                            <Table.Head
                                class={cn(
                                    LIST_TABLE_TOKENS.headBase,
                                    LIST_TABLE_TOKENS.colStatus,
                                )}
                                >狀態</Table.Head
                            >
                        </Table.Row>
                    </Table.Header>
                    <Table.Body class={LIST_TABLE_TOKENS.body}>
                        {#if filteredPayments.length > 0}
                            {#each filteredPayments as payment}
                            <Table.Row
                                class={cn(
                                    LIST_TABLE_TOKENS.row,
                                    LIST_TABLE_TOKENS.rowClickable,
                                )}
                                onclick={() => goto(`/payments/${payment.id}`)}
                            >
                                <Table.Cell
                                    class={LIST_TABLE_TOKENS.monoMuted}
                                >
                                    {payment.id}
                                </Table.Cell>
                                <Table.Cell class="font-medium text-xs">
                                    {payment.payee_name}
                                </Table.Cell>
                                <Table.Cell class="text-right font-bold text-green-600 text-xs">
                                    {@const amountParts = splitAmountParts(
                                        payment.total_amount,
                                    )}
                                    <div class="flex items-center justify-between gap-2">
                                        <span class="text-[10px] text-muted-foreground">
                                            {amountParts.symbol}
                                        </span>
                                        <span class="font-bold text-green-600 text-xs">
                                            {amountParts.value}
                                        </span>
                                    </div>
                                </Table.Cell>
                                <Table.Cell>
                                    <div
                                        class="flex items-center gap-1 text-xs text-muted-foreground"
                                    >
                                        <Calendar class="h-3 w-3" />
                                        {formatDate(payment.paid_at)}
                                    </div>
                                </Table.Cell>
                                <Table.Cell>
                                    <div
                                        class="flex items-center gap-1 text-xs text-muted-foreground"
                                    >
                                        <User class="h-3 w-3" />
                                        {payment.paid_by_profile?.full_name ||
                                            "系統"}
                                    </div>
                                </Table.Cell>
                                <Table.Cell>
                                    {#if payment.status === "completed" || payment.status === "paid"}
                                        {#if payment.claims?.some((c: { status: string }) => c.status !== "paid")}
                                            <StatusBadge status="paid_pending_doc" />
                                        {:else}
                                            <StatusBadge status="paid" />
                                        {/if}
                                    {:else if payment.status === "cancelled"}
                                        <StatusBadge status="cancelled" />
                                    {:else}
                                        <StatusBadge status={payment.status} />
                                    {/if}
                                </Table.Cell>
                            </Table.Row>
                            {/each}
                        {:else}
                            <ListTableEmptyState
                                icon={FileText}
                                description="目前尚無付款紀錄"
                                colspan={6}
                            />
                        {/if}
                    </Table.Body>
                </Table.Root>
        </div>
    </ListPageScaffold>
</div>
