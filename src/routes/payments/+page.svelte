<script lang="ts">
    import * as Table from "$lib/components/ui/table";
    import * as Tabs from "$lib/components/ui/tabs";
    import { Landmark } from "lucide-svelte";

    import { goto } from "$app/navigation";
    import ListPageScaffold from "$lib/components/common/ListPageScaffold.svelte";
    import ListToolbar from "$lib/components/common/ListToolbar.svelte";
    import ListTabs from "$lib/components/common/ListTabs.svelte";
    import ListTabTrigger from "$lib/components/common/ListTabTrigger.svelte";
    import SearchField from "$lib/components/common/SearchField.svelte";
    import StatusBadge from "$lib/components/common/StatusBadge.svelte";
    import ListTableEmptyState from "$lib/components/common/ListTableEmptyState.svelte";
    import { FileText } from "lucide-svelte";
    import { LIST_TABLE_TOKENS } from "$lib/components/common/list-table-tokens";
    import { cn } from "$lib/utils";
    import { fade } from "svelte/transition";

    interface PaymentClaim {
        status: string;
    }

    interface Payment {
        id: string;
        status: string;
        payee_name: string | null;
        total_amount: number;
        paid_at: string;
        paid_by_profile: {
            full_name: string | null;
        } | null;
        claims: PaymentClaim[] | null;
    }

    let { data }: { data: { payments: Payment[] } } = $props();
    let { payments } = $derived(data);
    let searchTerm = $state("");
    let statusTab = $state<"paid" | "pending_doc">("paid");

    function getPaymentViewStatus(
        payment: Payment,
    ): "paid" | "pending_doc" | "cancelled" {
        const hasPendingDoc =
            (payment.status === "completed" || payment.status === "paid") &&
            payment.claims?.some((c: PaymentClaim) => c.status !== "paid");
        if (hasPendingDoc) return "pending_doc";
        if (payment.status === "cancelled") return "cancelled";
        return "paid";
    }

    let statusFilteredPayments = $derived.by(() =>
        payments.filter((payment) => {
            const viewStatus = getPaymentViewStatus(payment);
            // Keep cancelled entries together with paid tab for history continuity.
            if (statusTab === "pending_doc")
                return viewStatus === "pending_doc";
            return viewStatus === "paid" || viewStatus === "cancelled";
        }),
    );

    let filteredPayments = $derived.by(() => {
        const normalized = searchTerm.trim().toLowerCase();
        if (!normalized) return statusFilteredPayments;
        return statusFilteredPayments.filter((payment) => {
            const id = String(payment.id || "").toLowerCase();
            const payee = String(payment.payee_name || "").toLowerCase();
            return id.includes(normalized) || payee.includes(normalized);
        });
    });

    let emptyMessage = $derived.by(() => {
        const keyword = searchTerm.trim();
        if (payments.length === 0) return "目前尚無付款紀錄";
        if (keyword && filteredPayments.length === 0)
            return `找不到符合「${keyword}」的結果`;
        if (statusFilteredPayments.length === 0)
            return "目前篩選條件下沒有結果";
        return "目前尚無付款紀錄";
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
                <Tabs.Root
                    value={statusTab}
                    onValueChange={(value) =>
                        (statusTab = value as "paid" | "pending_doc")}
                >
                    <ListTabs>
                        <ListTabTrigger value="paid">已撥款</ListTabTrigger>
                        <ListTabTrigger value="pending_doc">
                            待補件
                        </ListTabTrigger>
                    </ListTabs>
                </Tabs.Root>
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
                                LIST_TABLE_TOKENS.colDate,
                            )}>撥款時間</Table.Head
                        >
                        <Table.Head
                            class={cn(
                                LIST_TABLE_TOKENS.headBase,
                                LIST_TABLE_TOKENS.colId,
                            )}>付款單號</Table.Head
                        >
                        <Table.Head class={LIST_TABLE_TOKENS.headBase}
                            >收款人</Table.Head
                        >
                        <Table.Head
                            class={cn(
                                LIST_TABLE_TOKENS.headBase,
                                LIST_TABLE_TOKENS.colAmount,
                                "text-right",
                            )}>總金額</Table.Head
                        >
                        <Table.Head class={LIST_TABLE_TOKENS.headBase}
                            >經辦人</Table.Head
                        >
                        <Table.Head
                            class={cn(
                                LIST_TABLE_TOKENS.headBase,
                                LIST_TABLE_TOKENS.colStatus,
                            )}>狀態</Table.Head
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
                                <Table.Cell class={LIST_TABLE_TOKENS.dateCell}>
                                    {formatDate(payment.paid_at)}
                                </Table.Cell>
                                <Table.Cell
                                    class={cn(
                                        LIST_TABLE_TOKENS.idCell,
                                        LIST_TABLE_TOKENS.idText,
                                    )}
                                >
                                    #{payment.id.split("-")[0]}
                                </Table.Cell>
                                <Table.Cell class={LIST_TABLE_TOKENS.roleCell}>
                                    {payment.payee_name || "—"}
                                </Table.Cell>
                                <Table.Cell
                                    class={LIST_TABLE_TOKENS.amountCell}
                                >
                                    {@const amountParts = splitAmountParts(
                                        payment.total_amount,
                                    )}
                                    <div class={LIST_TABLE_TOKENS.amountWrap}>
                                        <span
                                            class={LIST_TABLE_TOKENS.amountSymbol}
                                        >
                                            {amountParts.symbol}
                                        </span>
                                        <span
                                            class={LIST_TABLE_TOKENS.amountValue}
                                        >
                                            {amountParts.value}
                                        </span>
                                    </div>
                                </Table.Cell>
                                <Table.Cell class={LIST_TABLE_TOKENS.roleCell}>
                                    {payment.paid_by_profile?.full_name ||
                                        "系統"}
                                </Table.Cell>
                                <Table.Cell class={LIST_TABLE_TOKENS.badgeCell}>
                                    <div class={LIST_TABLE_TOKENS.badgeWrap}>
                                        {#if payment.status === "completed" || payment.status === "paid"}
                                            {#if payment.claims?.some((c: { status: string }) => c.status !== "paid")}
                                                <StatusBadge
                                                    status="paid_pending_doc"
                                                />
                                            {:else}
                                                <StatusBadge status="paid" />
                                            {/if}
                                        {:else if payment.status === "cancelled"}
                                            <StatusBadge status="cancelled" />
                                        {:else}
                                            <StatusBadge
                                                status={payment.status}
                                            />
                                        {/if}
                                    </div>
                                </Table.Cell>
                            </Table.Row>
                        {/each}
                    {:else}
                        <ListTableEmptyState
                            icon={FileText}
                            description={emptyMessage}
                            colspan={6}
                        />
                    {/if}
                </Table.Body>
            </Table.Root>
        </div>
    </ListPageScaffold>
</div>
