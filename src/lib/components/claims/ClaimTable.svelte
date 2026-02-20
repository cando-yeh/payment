<script lang="ts">
    import * as Table from "$lib/components/ui/table";
    import AppBadge from "$lib/components/common/AppBadge.svelte";
    import ListTableEmptyState from "$lib/components/common/ListTableEmptyState.svelte";
    import StatusBadge from "$lib/components/common/StatusBadge.svelte";
    import { formatCurrency, formatDate, cn } from "$lib/utils";
    import { LIST_TABLE_TOKENS } from "$lib/components/common/list-table-tokens";
    import { getClaimTypeLabel } from "$lib/claims/constants";
    import { goto } from "$app/navigation";
    import { type Snippet } from "svelte";

    let {
        claims = [],
        emptyMessage = "目前尚無相關請款紀錄",
        emptyIcon,
        selectable = false,
        selectedClaims = $bindable([]),
        emptyAction,
    }: {
        claims?: any[];
        emptyMessage?: string;
        emptyIcon: any;
        selectable?: boolean;
        selectedClaims?: string[];
        emptyAction?: Snippet;
    } = $props();

    function handleRowClick(e: MouseEvent, claimId: string) {
        // Prevent navigation if clicking on checkbox or input
        if ((e.target as HTMLElement).tagName === "INPUT") return;

        const currentPath = window.location.pathname;
        const currentSearch = window.location.search;
        const fromUrl = currentPath + currentSearch;

        // If we are not in the main claims section, pass the current path + search params as a "from" parameter
        // This helps the Sidebar maintain the correct active state AND allows us to return to the exact same state (e.g. active tab)
        if (!currentPath.startsWith("/claims")) {
            goto(`/claims/${claimId}?from=${encodeURIComponent(fromUrl)}`);
        } else {
            goto(`/claims/${claimId}`);
        }
    }

    function toggleSelection(claimId: string) {
        if (selectedClaims.includes(claimId)) {
            selectedClaims = selectedClaims.filter((id) => id !== claimId);
        } else {
            selectedClaims = [...selectedClaims, claimId];
        }
    }

    function toggleAll(e: Event) {
        const checked = (e.target as HTMLInputElement).checked;
        if (checked) {
            selectedClaims = claims.map((c) => c.id);
        } else {
            selectedClaims = [];
        }
    }

    function splitCurrencyParts(amount: number) {
        const formatted = formatCurrency(amount);
        const match = formatted.match(/^([^0-9-]*)(.*)$/);
        return {
            symbol: (match?.[1] || "NT$").trim(),
            value: (match?.[2] || formatted).trim(),
        };
    }
</script>

<Table.Root>
    <Table.Header class={LIST_TABLE_TOKENS.header}>
        <Table.Row class={LIST_TABLE_TOKENS.headerRow}>
            {#if selectable}
                <Table.Head class="w-[60px] pl-8 py-4">
                    <input
                        type="checkbox"
                        class="h-4 w-4 rounded border-border/40 text-primary focus:ring-primary/10"
                        checked={claims.length > 0 &&
                            selectedClaims.length === claims.length}
                        onchange={toggleAll}
                    />
                </Table.Head>
            {/if}
            <Table.Head
                class={cn(
                    LIST_TABLE_TOKENS.headBase,
                    LIST_TABLE_TOKENS.colDate,
                )}>日期</Table.Head
            >
            <Table.Head
                class={cn(
                    LIST_TABLE_TOKENS.headBase,
                    LIST_TABLE_TOKENS.colId,
                    !selectable && "pl-8",
                )}>請款單號</Table.Head
            >
            <Table.Head class={LIST_TABLE_TOKENS.headBase}>類別</Table.Head>
            <Table.Head class={LIST_TABLE_TOKENS.headBase}>收款人</Table.Head>
            <Table.Head
                class={cn(
                    LIST_TABLE_TOKENS.headBase,
                    LIST_TABLE_TOKENS.colAmount,
                    "text-right",
                )}>總金額</Table.Head
            >
            <Table.Head
                class={cn(
                    LIST_TABLE_TOKENS.headBase,
                    LIST_TABLE_TOKENS.colStatus,
                )}>申請進度</Table.Head
            >
        </Table.Row>
    </Table.Header>
    <Table.Body class={LIST_TABLE_TOKENS.body}>
        {#if claims.length > 0}
            {#each claims as claim}
                <Table.Row
                    class={cn(
                        LIST_TABLE_TOKENS.row,
                        LIST_TABLE_TOKENS.rowClickable,
                    )}
                    onclick={(e) => handleRowClick(e, claim.id)}
                >
                    {#if selectable}
                        <Table.Cell class="pl-8">
                            <input
                                type="checkbox"
                                class="h-4 w-4 rounded border-border/40 text-primary focus:ring-primary/10"
                                checked={selectedClaims.includes(claim.id)}
                                onchange={() => toggleSelection(claim.id)}
                            />
                        </Table.Cell>
                    {/if}
                    <Table.Cell class={LIST_TABLE_TOKENS.dateCell}>
                        {formatDate(claim.submitted_at || claim.created_at)}
                    </Table.Cell>
                    <Table.Cell
                        class={cn(
                            "py-0",
                            LIST_TABLE_TOKENS.idCell,
                            !selectable && "pl-8",
                        )}
                    >
                        <span
                            class={cn(LIST_TABLE_TOKENS.idText, "select-all")}
                        >
                            #{claim.id.split("-")[0]}
                        </span>
                    </Table.Cell>
                    <Table.Cell class={LIST_TABLE_TOKENS.badgeCell}>
                        <div class={LIST_TABLE_TOKENS.badgeWrap}>
                            <AppBadge
                                preset={`claim.type.${claim.claim_type || "employee"}`}
                                label={getClaimTypeLabel(claim.claim_type)}
                                className="font-semibold"
                            />
                        </div>
                    </Table.Cell>
                    <Table.Cell class={LIST_TABLE_TOKENS.roleCell}>
                        {claim.payee?.name || claim.applicant?.full_name || "—"}
                    </Table.Cell>
                    <Table.Cell class={LIST_TABLE_TOKENS.amountCell}>
                        {@const amountParts = splitCurrencyParts(
                            claim.total_amount,
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
                    <Table.Cell class={LIST_TABLE_TOKENS.badgeCell}>
                        <div class={LIST_TABLE_TOKENS.badgeWrap}>
                            <StatusBadge status={claim.status} />
                        </div>
                    </Table.Cell>
                </Table.Row>
            {/each}
        {:else}
            <ListTableEmptyState
                icon={emptyIcon}
                description={emptyMessage}
                colspan={selectable ? 7 : 6}
                action={emptyAction}
            />
        {/if}
    </Table.Body>
</Table.Root>
