<script lang="ts">
    import * as Table from "$lib/components/ui/table";
    import { Badge } from "$lib/components/ui/badge";
    import EmptyState from "$lib/components/common/EmptyState.svelte";
    import { formatCurrency, formatDate, cn } from "$lib/utils";
    import {
        getClaimStatusLabel,
        getClaimTypeLabel,
    } from "$lib/claims/constants";
    import { goto } from "$app/navigation";
    import type { ComponentType } from "svelte";

    // Define props
    export let claims: any[] = [];
    export let emptyMessage: string = "目前尚無相關請款紀錄";
    export let emptyIcon: ComponentType;
    export let selectable: boolean = false;
    export let selectedClaims: string[] = [];
    // Callback for selection change - we'll use bind:selectedClaims instead if possible,
    // or emit an event. For now, let's use two-way binding on the prop.

    const statusColorMap: Record<string, string> = {
        draft: "bg-slate-100 text-slate-600 border-slate-200",
        pending_manager: "bg-amber-100 text-amber-700 border-amber-200",
        pending_finance: "bg-blue-100 text-blue-700 border-blue-200",
        pending_payment: "bg-indigo-100 text-indigo-700 border-indigo-200",
        paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
        paid_pending_doc: "bg-orange-100 text-orange-700 border-orange-200",
        pending_doc_review: "bg-orange-100 text-orange-700 border-orange-200",
        returned: "bg-rose-100 text-rose-700 border-rose-200",
        cancelled: "bg-slate-50 text-slate-400 border-slate-100",
    };

    function getStatusBadge(status: string) {
        return {
            label: getClaimStatusLabel(status),
            color:
                statusColorMap[status] ||
                "bg-slate-100 text-slate-600 border-slate-200",
        };
    }

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
</script>

<Table.Root>
    <Table.Header class="bg-secondary/20">
        <Table.Row class="hover:bg-transparent border-none">
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
                    "text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-4",
                    !selectable && "pl-8",
                )}>單號</Table.Head
            >
            <Table.Head
                class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-4"
                >類別</Table.Head
            >
            <Table.Head
                class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-4"
                >收款對象/申請人</Table.Head
            >
            <Table.Head
                class="text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-4"
                >總金額</Table.Head
            >
            <Table.Head
                class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-4"
                >當前狀態</Table.Head
            >
            <Table.Head
                class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-4"
                >日期</Table.Head
            >
        </Table.Row>
    </Table.Header>
    <Table.Body class="divide-y divide-border/10">
        {#if claims.length > 0}
            {#each claims as claim}
                <Table.Row
                    class="group border-none hover:bg-secondary/30 transition-all cursor-pointer h-12"
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
                    <Table.Cell class={cn("py-0", !selectable && "pl-8")}>
                        <span
                            class="text-xs font-bold text-foreground opacity-40 select-all"
                        >
                            #{claim.id.split("-")[0]}
                        </span>
                    </Table.Cell>
                    <Table.Cell>
                        <Badge
                            variant="secondary"
                            class="rounded-md font-bold text-[10px] px-2 py-0"
                        >
                            {getClaimTypeLabel(claim.claim_type)}
                        </Badge>
                    </Table.Cell>
                    <Table.Cell>
                        <div class="flex items-center gap-2">
                            <div
                                class="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground"
                            >
                                {(claim.payee?.name ||
                                    claim.applicant?.full_name ||
                                    claim.approver?.full_name ||
                                    "本")[0]}
                            </div>
                            <span class="text-xs font-bold text-foreground/70">
                                {claim.payee?.name ||
                                    claim.applicant?.full_name ||
                                    claim.approver?.full_name ||
                                    "本人"}
                            </span>
                        </div>
                    </Table.Cell>
                    <Table.Cell class="text-right pr-4">
                        <div
                            class="text-base font-bold text-foreground tracking-tight"
                        >
                            {formatCurrency(claim.total_amount)}
                        </div>
                    </Table.Cell>
                    <Table.Cell>
                        {@const status = getStatusBadge(claim.status)}
                        <Badge
                            class={cn(
                                "rounded-full px-3 py-0 scale-90 origin-left text-[10px] font-bold border-none",
                                status.color,
                            )}
                        >
                            {status.label}
                        </Badge>
                    </Table.Cell>
                    <Table.Cell class="text-muted-foreground font-bold text-xs">
                        {formatDate(claim.submitted_at || claim.created_at)}
                    </Table.Cell>
                </Table.Row>
            {/each}
        {:else}
            <EmptyState
                icon={emptyIcon}
                description={emptyMessage}
                colspan={selectable ? 7 : 6}
            >
                <div slot="action">
                    <slot name="empty-action" />
                </div>
            </EmptyState>
        {/if}
    </Table.Body>
</Table.Root>
