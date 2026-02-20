<script lang="ts">
    import * as Tabs from "$lib/components/ui/tabs";
    import * as Table from "$lib/components/ui/table";
    import { FileText, Landmark } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { fade } from "svelte/transition";
    import ListPageScaffold from "$lib/components/common/ListPageScaffold.svelte";
    import ListToolbar from "$lib/components/common/ListToolbar.svelte";
    import ListTabs from "$lib/components/common/ListTabs.svelte";
    import ListTabTrigger from "$lib/components/common/ListTabTrigger.svelte";
    import SearchField from "$lib/components/common/SearchField.svelte";
    import ClaimTable from "$lib/components/claims/ClaimTable.svelte";
    import ListTableEmptyState from "$lib/components/common/ListTableEmptyState.svelte";
    import StatusBadge from "$lib/components/common/StatusBadge.svelte";
    import { LIST_TABLE_TOKENS } from "$lib/components/common/list-table-tokens";
    import { cn } from "$lib/utils";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    let currentTab = $state<"claims" | "payments">("claims");
    let searchTerm = $state("");

    $effect(() => {
        currentTab = data.tab === "payments" ? "payments" : "claims";
        searchTerm = data.search || "";
    });

    function handleSearch(e: Event) {
        const value = (e.target as HTMLInputElement).value;
        searchTerm = value;
        const url = new URL(window.location.href);
        if (value.trim()) {
            url.searchParams.set("search", value);
        } else {
            url.searchParams.delete("search");
        }
        window.history.replaceState(window.history.state, "", url);
    }

    function handleTabChange(value: string) {
        currentTab = value === "payments" ? "payments" : "claims";
        const url = new URL(window.location.href);
        url.searchParams.set("tab", currentTab);
        window.history.replaceState(window.history.state, "", url);
    }

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

    let filteredClaims = $derived.by(() => {
        const normalized = searchTerm.trim().toLowerCase();
        if (!normalized) return data.claims || [];
        return (data.claims || []).filter((claim) => {
            const id = String(claim.id || "").toLowerCase();
            const payeeName = String(claim.payee?.name || "").toLowerCase();
            const applicantName = String(
                claim.applicant?.full_name || "",
            ).toLowerCase();
            return (
                id.includes(normalized) ||
                payeeName.includes(normalized) ||
                applicantName.includes(normalized)
            );
        });
    });

    function getPaymentViewStatus(
        payment: any,
    ): "paid" | "paid_pending_doc" | "cancelled" {
        const hasPendingDoc =
            (payment.status === "completed" || payment.status === "paid") &&
            payment.claims?.some((c: { status: string }) => c.status !== "paid");
        if (hasPendingDoc) return "paid_pending_doc";
        if (payment.status === "cancelled") return "cancelled";
        return "paid";
    }

    let filteredPayments = $derived.by(() => {
        const normalized = searchTerm.trim().toLowerCase();
        if (!normalized) return data.payments || [];
        return (data.payments || []).filter((payment) => {
            const id = String(payment.id || "").toLowerCase();
            const payee = String(payment.payee_name || "").toLowerCase();
            return id.includes(normalized) || payee.includes(normalized);
        });
    });

    let emptyClaimsMessage = $derived.by(() => {
        const keyword = searchTerm.trim();
        if ((data.claims?.length || 0) === 0) return "目前尚無請款紀錄";
        if (keyword && filteredClaims.length === 0)
            return `找不到符合「${keyword}」的結果`;
        return "目前尚無請款紀錄";
    });

    let emptyPaymentsMessage = $derived.by(() => {
        const keyword = searchTerm.trim();
        if ((data.payments?.length || 0) === 0) return "目前尚無付款紀錄";
        if (keyword && filteredPayments.length === 0)
            return `找不到符合「${keyword}」的結果`;
        return "目前尚無付款紀錄";
    });
</script>

<div in:fade={{ duration: 400 }}>
    <ListPageScaffold
        title="單據中心"
        description="查閱請款單與付款單紀錄（僅查閱，不在此執行審核或撥款）。"
        shellClassName="pb-2"
    >
        {#snippet statIcon()}
            <Landmark class="h-4 w-4 text-muted-foreground" />
        {/snippet}
        <ListToolbar>
            {#snippet left()}
                <Tabs.Root
                    value={currentTab}
                    onValueChange={handleTabChange}
                >
                    <ListTabs>
                        <ListTabTrigger value="claims">請款單紀錄</ListTabTrigger>
                        <ListTabTrigger value="payments">付款單紀錄</ListTabTrigger>
                    </ListTabs>
                </Tabs.Root>
            {/snippet}
            {#snippet right()}
                <SearchField
                    bind:value={searchTerm}
                    placeholder={currentTab === "claims"
                        ? "搜尋單號、收款人或申請人..."
                        : "搜尋付款單 ID 或收款人..."}
                    oninput={handleSearch}
                />
            {/snippet}
        </ListToolbar>

        {#if currentTab === "claims"}
                <ClaimTable
                    claims={filteredClaims}
                    emptyIcon={FileText}
                    emptyMessage={emptyClaimsMessage}
                />
        {:else}
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
                                    <Table.Cell class={LIST_TABLE_TOKENS.amountCell}>
                                        {@const amountParts = splitAmountParts(
                                            payment.total_amount,
                                        )}
                                        <div class={LIST_TABLE_TOKENS.amountWrap}>
                                            <span class={LIST_TABLE_TOKENS.amountSymbol}>
                                                {amountParts.symbol}
                                            </span>
                                            <span class={LIST_TABLE_TOKENS.amountValue}>
                                                {amountParts.value}
                                            </span>
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell class={LIST_TABLE_TOKENS.roleCell}>
                                        {payment.paid_by_profile?.full_name || "系統"}
                                    </Table.Cell>
                                    <Table.Cell class={LIST_TABLE_TOKENS.badgeCell}>
                                        <div class={LIST_TABLE_TOKENS.badgeWrap}>
                                            <StatusBadge
                                                status={getPaymentViewStatus(
                                                    payment,
                                                )}
                                            />
                                        </div>
                                    </Table.Cell>
                                </Table.Row>
                            {/each}
                        {:else}
                            <ListTableEmptyState
                                icon={FileText}
                                description={emptyPaymentsMessage}
                                colspan={6}
                            />
                        {/if}
                    </Table.Body>
                </Table.Root>
        {/if}
    </ListPageScaffold>
</div>
