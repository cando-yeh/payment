<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Table from "$lib/components/ui/table";
    import * as Card from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import {
        Landmark,
        ChevronRight,
        Search,
        Calendar,
        User,
    } from "lucide-svelte";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";

    let { data }: { data: PageData } = $props();
    let { payments } = $derived(data);

    function formatDate(date: string) {
        if (!date) return "-";
        return new Date(date).toLocaleString("zh-TW", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
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
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-3xl font-bold tracking-tight">付款歷史</h1>
            <p class="text-muted-foreground">
                檢視所有已產生的付款單及撥款紀錄。
            </p>
        </div>
    </div>

    <Card.Root>
        <Card.Header>
            <Card.Title>撥款紀錄</Card.Title>
            <Card.Description>包含單筆與批次合併產生的付款單。</Card.Description
            >
        </Card.Header>
        <Card.Content>
            {#if payments.length === 0}
                <div
                    class="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg"
                >
                    目前尚無付款紀錄
                </div>
            {:else}
                <Table.Root>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>付款單 ID</Table.Head>
                            <Table.Head>受款人</Table.Head>
                            <Table.Head>總金額</Table.Head>
                            <Table.Head>撥款時間</Table.Head>
                            <Table.Head>經辦人</Table.Head>
                            <Table.Head>狀態</Table.Head>
                            <Table.Head class="text-right">操作</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {#each payments as payment}
                            <Table.Row
                                class="cursor-pointer"
                                onclick={() => goto(`/payments/${payment.id}`)}
                            >
                                <Table.Cell
                                    class="font-mono text-xs text-muted-foreground"
                                >
                                    {payment.id.split("-")[0]}...
                                </Table.Cell>
                                <Table.Cell class="font-medium">
                                    {payment.payee_name}
                                </Table.Cell>
                                <Table.Cell class="font-bold text-green-600">
                                    {formatAmount(payment.total_amount)}
                                </Table.Cell>
                                <Table.Cell>
                                    <div
                                        class="flex items-center gap-1 text-xs"
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
                                        <Badge
                                            class="bg-green-100 text-green-700 hover:bg-green-100"
                                            >已撥款</Badge
                                        >
                                    {:else if payment.status === "cancelled"}
                                        <Badge
                                            variant="outline"
                                            class="text-muted-foreground"
                                            >已沖帳</Badge
                                        >
                                    {:else}
                                        <Badge variant="secondary"
                                            >{payment.status}</Badge
                                        >
                                    {/if}
                                </Table.Cell>
                                <Table.Cell class="text-right">
                                    <Button variant="ghost" size="sm">
                                        詳情 <ChevronRight
                                            class="ml-1 h-4 w-4"
                                        />
                                    </Button>
                                </Table.Cell>
                            </Table.Row>
                        {/each}
                    </Table.Body>
                </Table.Root>
            {/if}
        </Card.Content>
    </Card.Root>
</div>
