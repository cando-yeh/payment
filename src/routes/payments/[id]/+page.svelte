<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Table from "$lib/components/ui/table";
    import * as Card from "$lib/components/ui/card";
    import StatusBadge from "$lib/components/common/StatusBadge.svelte";
    import ConfirmActionDialog from "$lib/components/common/ConfirmActionDialog.svelte";
    import {
        ArrowLeft,
        CircleAlert,
        ExternalLink,
        RotateCcw,
    } from "lucide-svelte";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import { enhance } from "$app/forms";

    let { data }: { data: PageData } = $props();
    let { payment, claims } = $derived(data);
    let isConfirmOpen = $state(false);
    let pendingConfirmForm = $state<HTMLFormElement | null>(null);
    let allowConfirmedSubmitFor = $state<HTMLFormElement | null>(null);

    function requestConfirmSubmit(event: SubmitEvent) {
        const form = event.currentTarget as HTMLFormElement;
        if (allowConfirmedSubmitFor === form) {
            allowConfirmedSubmitFor = null;
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        pendingConfirmForm = form;
        isConfirmOpen = true;
    }

    function executeConfirmedSubmit() {
        const form = pendingConfirmForm;
        pendingConfirmForm = null;
        isConfirmOpen = false;
        if (!form || !form.isConnected) return;
        allowConfirmedSubmitFor = form;
        form.requestSubmit();
    }

    function cancelConfirmedSubmit() {
        pendingConfirmForm = null;
        isConfirmOpen = false;
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
</script>

<div class="space-y-6">
    <div class="flex items-center gap-4">
        <Button variant="ghost" size="icon" onclick={() => goto("/payments")}>
            <ArrowLeft class="h-4 w-4" />
        </Button>
        <div>
            <h1 class="text-2xl font-bold tracking-tight">付款單詳情</h1>
            <p class="text-sm text-muted-foreground font-mono">{payment.id}</p>
        </div>
        <div class="ml-auto flex items-center gap-2">
            {#if payment.status === "completed" || payment.status === "paid"}
                {#if claims?.some((c: { status: string }) => c.status !== "paid")}
                    <StatusBadge status="paid_pending_doc" />
                {:else}
                    <StatusBadge status="paid" />
                {/if}
                <form
                    action="?/cancelPayment"
                    method="POST"
                    use:enhance
                    onsubmitcapture={requestConfirmSubmit}
                >
                    <Button
                        variant="outline"
                        size="sm"
                        class="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1"
                    >
                        <RotateCcw class="h-4 w-4" /> 撤銷撥款 (沖帳)
                    </Button>
                </form>
            {:else if payment.status === "cancelled"}
                <StatusBadge status="cancelled" />
                <div
                    class="text-xs text-muted-foreground flex items-center gap-1"
                >
                    <CircleAlert class="h-3 w-3" />
                    於 {formatDate(payment.cancelled_at)} 撤銷
                </div>
            {/if}
        </div>
    </div>

    <div class="grid gap-6 md:grid-cols-3">
        <Card.Root class="md:col-span-1">
            <Card.Header>
                <Card.Title>收款資訊</Card.Title>
            </Card.Header>
            <Card.Content class="space-y-4">
                <div>
                    <div class="text-sm text-muted-foreground">收款人</div>
                    <div class="font-medium text-lg">{payment.payee_name}</div>
                </div>
                <div>
                    <div class="text-sm text-muted-foreground">總金額</div>
                    <div class="font-bold text-2xl text-green-600">
                        {formatAmount(payment.total_amount)}
                    </div>
                </div>
                <div>
                    <div class="text-sm text-muted-foreground">銀行名稱</div>
                    <div class="font-medium">{payment.bank || "-"}</div>
                </div>
                <div>
                    <div class="text-sm text-muted-foreground">銀行帳號</div>
                    <div class="font-mono text-sm bg-muted p-2 rounded mt-1">
                        ******** (已加密快照)
                    </div>
                </div>
                <div class="pt-4 border-t space-y-2">
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-muted-foreground">經辦人</span>
                        <span class="font-medium"
                            >{payment.paid_by_profile?.full_name ||
                                "系統"}</span
                        >
                    </div>
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-muted-foreground">撥款時間</span>
                        <span class="font-medium"
                            >{formatDate(payment.paid_at)}</span
                        >
                    </div>
                </div>
            </Card.Content>
        </Card.Root>

        <Card.Root class="md:col-span-2">
            <Card.Header>
                <Card.Title>包含的請款單 ({claims.length})</Card.Title>
            </Card.Header>
            <Card.Content>
                <Table.Root>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>單號</Table.Head>
                            <Table.Head>申請人</Table.Head>
                            <Table.Head>摘要</Table.Head>
                            <Table.Head>金額</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {#each claims as claim}
                            <Table.Row>
                                <Table.Cell class="font-bold"
                                    >{claim.id}</Table.Cell
                                >
                                <Table.Cell
                                    >{claim.applicant?.full_name}</Table.Cell
                                >
                                <Table.Cell class="max-w-[200px] truncate"
                                    >{claim.description || "-"}</Table.Cell
                                >
                                <Table.Cell
                                    class="text-right font-mono font-medium"
                                    >{formatAmount(
                                        claim.total_amount,
                                    )}</Table.Cell
                                >
                            </Table.Row>
                        {/each}
                    </Table.Body>
                </Table.Root>
            </Card.Content>
        </Card.Root>
    </div>
</div>

<ConfirmActionDialog
    bind:open={isConfirmOpen}
    title="確認撤銷撥款"
    description="確定要撤銷此付款嗎？系統將回滾相關請款單狀態。"
    confirmLabel="確認撤銷"
    confirmVariant="destructive"
    onCancel={cancelConfirmedSubmit}
    onConfirm={executeConfirmedSubmit}
/>
