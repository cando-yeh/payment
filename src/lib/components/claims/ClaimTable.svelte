<script lang="ts">
    import * as Table from "$lib/components/ui/table";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import AppBadge from "$lib/components/common/AppBadge.svelte";
    import ListTableEmptyState from "$lib/components/common/ListTableEmptyState.svelte";
    import StatusBadge from "$lib/components/common/StatusBadge.svelte";
    import { formatCurrency, formatDate, cn } from "$lib/utils";
    import { LIST_TABLE_TOKENS } from "$lib/components/common/list-table-tokens";
    import { getClaimTypeLabel } from "$lib/claims/constants";
    import { goto } from "$app/navigation";
    import { enhance } from "$app/forms";
    import { handleEnhancedActionFeedback } from "$lib/utils/action-feedback";
    import { CircleCheck, CircleX } from "lucide-svelte";
    import { type Snippet } from "svelte";

    let {
        claims = [],
        emptyMessage = "目前尚無相關請款紀錄",
        emptyIcon,
        selectable = false,
        selectedClaims = $bindable([]),
        emptyAction,
        showRowActions = false,
    }: {
        claims?: any[];
        emptyMessage?: string;
        emptyIcon: any;
        selectable?: boolean;
        selectedClaims?: string[];
        emptyAction?: Snippet;
        showRowActions?: boolean;
    } = $props();

    // 逐列駁回對話框狀態
    let rejectingClaimId = $state<string | null>(null);
    let rejectComment = $state("");
    let isRejectSubmitting = $state(false);
    let approvingId = $state<string | null>(null);

    function openRejectDialog(e: Event, claimId: string) {
        e.stopPropagation();
        rejectingClaimId = claimId;
        rejectComment = "";
    }

    function closeRejectDialog() {
        rejectingClaimId = null;
        rejectComment = "";
    }

    function handleRowClick(e: MouseEvent, claimId: string) {
        // Prevent navigation if clicking on checkbox, input, or row action buttons
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT") return;
        if (target.closest("[data-row-action]")) return;

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

    function getRecipientName(claim: any) {
        const payeeName = String(claim?.payee?.name || "").trim();
        const applicantName = String(claim?.applicant?.full_name || "").trim();

        // 員工報銷應以申請人姓名為主，避免被 payee 名稱覆蓋。
        if (claim?.claim_type === "employee") {
            return applicantName || payeeName || "—";
        }

        return payeeName || applicantName || "—";
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
                )}>總金額</Table.Head
            >
            <Table.Head
                class={cn(
                    LIST_TABLE_TOKENS.headBase,
                    LIST_TABLE_TOKENS.colStatus,
                )}>申請進度</Table.Head
            >
            {#if showRowActions}
                <Table.Head
                    class={cn(
                        LIST_TABLE_TOKENS.headBase,
                        LIST_TABLE_TOKENS.colActions,
                        "text-center pr-8",
                    )}>操作</Table.Head
                >
            {/if}
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
                        {getRecipientName(claim)}
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
                    {#if showRowActions}
                        <Table.Cell class="pr-8">
                            <div
                                class="flex items-center justify-center gap-1.5"
                                data-row-action
                            >
                                <form
                                    action="/approval?/approve"
                                    method="POST"
                                    use:enhance={() => {
                                        approvingId = claim.id;
                                        return async ({ result, update }) => {
                                            await handleEnhancedActionFeedback({
                                                result: result as any,
                                                update,
                                                successMessage: "核准成功",
                                                failureMessage: "核准失敗",
                                            });
                                            approvingId = null;
                                        };
                                    }}
                                >
                                    <input
                                        type="hidden"
                                        name="claimId"
                                        value={claim.id}
                                    />
                                    <Button
                                        type="submit"
                                        variant="default"
                                        class="h-7 gap-1 px-2.5 text-xs font-semibold"
                                        disabled={approvingId === claim.id}
                                    >
                                        <CircleCheck class="h-3.5 w-3.5" /> 核准
                                    </Button>
                                </form>
                                <Button
                                    type="button"
                                    variant="outline"
                                    class="h-7 gap-1 border-destructive/20 px-2.5 text-xs font-semibold text-destructive hover:bg-destructive/5"
                                    onclick={(e) =>
                                        openRejectDialog(e, claim.id)}
                                >
                                    <CircleX class="h-3.5 w-3.5" /> 駁回
                                </Button>
                            </div>
                        </Table.Cell>
                    {/if}
                </Table.Row>
            {/each}
        {:else}
            <ListTableEmptyState
                icon={emptyIcon}
                description={emptyMessage}
                colspan={6 + (selectable ? 1 : 0) + (showRowActions ? 1 : 0)}
                action={emptyAction}
            />
        {/if}
    </Table.Body>
</Table.Root>

{#if showRowActions}
    <Dialog.Root
        open={rejectingClaimId !== null}
        onOpenChange={(open) => {
            if (!open) closeRejectDialog();
        }}
    >
        <Dialog.Content class="max-w-md rounded-2xl">
            <Dialog.Header>
                <Dialog.Title>駁回此申請</Dialog.Title>
                <Dialog.Description
                    >請提供具體的駁回原因，這將通知申請人。</Dialog.Description
                >
            </Dialog.Header>
            <form
                action="/approval?/reject"
                method="POST"
                use:enhance={() => {
                    isRejectSubmitting = true;
                    return async ({ result, update }) => {
                        const ok = await handleEnhancedActionFeedback({
                            result: result as any,
                            update,
                            successMessage: "已駁回申請",
                            failureMessage: "駁回失敗",
                        });
                        isRejectSubmitting = false;
                        if (ok) closeRejectDialog();
                    };
                }}
                class="space-y-4"
            >
                <input
                    type="hidden"
                    name="claimId"
                    value={rejectingClaimId ?? ""}
                />
                <textarea
                    name="comment"
                    bind:value={rejectComment}
                    required
                    placeholder="請輸入駁回原因"
                    class="min-h-[120px] w-full rounded-xl border p-3 text-sm"
                ></textarea>
                <Dialog.Footer>
                    <Button
                        variant="outline"
                        type="button"
                        onclick={closeRejectDialog}>取消</Button
                    >
                    <Button
                        type="submit"
                        disabled={!rejectComment.trim() || isRejectSubmitting}
                        >{isRejectSubmitting ? "處理中..." : "確認駁回"}</Button
                    >
                </Dialog.Footer>
            </form>
        </Dialog.Content>
    </Dialog.Root>
{/if}
