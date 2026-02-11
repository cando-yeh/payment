<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Table from "$lib/components/ui/table";
    import * as Tabs from "$lib/components/ui/tabs";
    import * as Card from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import {
        FileText,
        Search,
        Filter,
        CheckCircle2,
        User,
        Landmark,
        History,
    } from "lucide-svelte";
    import StatusBadge from "$lib/components/claims/StatusBadge.svelte";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";

    let { data }: { data: PageData } = $props();

    let {
        pendingManager,
        pendingFinance,
        pendingPayment,
        pendingDocReview,
        userRole,
    } = $derived(data);

    function formatDate(date: string) {
        if (!date) return "-";
        return new Date(date).toLocaleDateString("zh-TW");
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
            <h1 class="text-3xl font-bold tracking-tight">審核中心</h1>
            <p class="text-muted-foreground">
                管理待核准、待撥款及補件審核中的單據。
            </p>
        </div>
    </div>

    <Tabs.Root value="manager" class="space-y-4">
        <Tabs.List class="grid w-full grid-cols-4 max-w-2xl">
            <Tabs.Trigger value="manager" class="gap-2">
                <User class="h-4 w-4" /> 主管審核
                {#if pendingManager.length > 0}
                    <Badge
                        variant="destructive"
                        class="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]"
                        >{pendingManager.length}</Badge
                    >
                {/if}
            </Tabs.Trigger>
            {#if userRole.isFinance || userRole.isAdmin}
                <Tabs.Trigger value="finance" class="gap-2">
                    <CheckCircle2 class="h-4 w-4" /> 財務審核
                    {#if pendingFinance.length > 0}
                        <Badge
                            variant="destructive"
                            class="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]"
                            >{pendingFinance.length}</Badge
                        >
                    {/if}
                </Tabs.Trigger>
                <Tabs.Trigger value="payment" class="gap-2">
                    <Landmark class="h-4 w-4" /> 待撥款
                    {#if pendingPayment.length > 0}
                        <Badge
                            variant="destructive"
                            class="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]"
                            >{pendingPayment.length}</Badge
                        >
                    {/if}
                </Tabs.Trigger>
                <Tabs.Trigger value="doc" class="gap-2">
                    <History class="h-4 w-4" /> 補件審核
                    {#if pendingDocReview.length > 0}
                        <Badge
                            variant="destructive"
                            class="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]"
                            >{pendingDocReview.length}</Badge
                        >
                    {/if}
                </Tabs.Trigger>
            {/if}
        </Tabs.List>

        <Tabs.Content value="manager" class="space-y-4">
            <Card.Root>
                <Card.Header>
                    <Card.Title>待主管審核單據</Card.Title>
                    <Card.Description
                        >這些單據需要您的核准才能進入財務審查階段。</Card.Description
                    >
                </Card.Header>
                <Card.Content>
                    {#if pendingManager.length === 0}
                        <div
                            class="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg"
                        >
                            目前無待審核單據
                        </div>
                    {:else}
                        <Table.Root>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head>單號</Table.Head>
                                    <Table.Head>申請人</Table.Head>
                                    <Table.Head>事由</Table.Head>
                                    <Table.Head>金額</Table.Head>
                                    <Table.Head>提交日期</Table.Head>
                                    <Table.Head class="text-right"
                                        >操作</Table.Head
                                    >
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {#each pendingManager as claim}
                                    <Table.Row
                                        class="cursor-pointer"
                                        onclick={() =>
                                            goto(`/claims/${claim.id}`)}
                                    >
                                        <Table.Cell class="font-bold"
                                            >{claim.id}</Table.Cell
                                        >
                                        <Table.Cell>
                                            <div class="font-medium">
                                                {claim.applicant?.full_name}
                                            </div>
                                            <div
                                                class="text-xs text-muted-foreground"
                                            >
                                                {claim.applicant?.email}
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell
                                            >{claim.description}</Table.Cell
                                        >
                                        <Table.Cell
                                            class="font-mono text-blue-600"
                                            >{formatAmount(
                                                claim.total_amount,
                                            )}</Table.Cell
                                        >
                                        <Table.Cell
                                            >{formatDate(
                                                claim.submitted_at,
                                            )}</Table.Cell
                                        >
                                        <Table.Cell class="text-right">
                                            <Button variant="ghost" size="sm"
                                                >詳情</Button
                                            >
                                        </Table.Cell>
                                    </Table.Row>
                                {/each}
                            </Table.Body>
                        </Table.Root>
                    {/if}
                </Card.Content>
            </Card.Root>
        </Tabs.Content>

        {#if userRole.isFinance || userRole.isAdmin}
            <Tabs.Content value="finance" class="space-y-4">
                <Card.Root>
                    <Card.Header>
                        <Card.Title>待財務審核單據</Card.Title>
                        <Card.Description
                            >主管已核准，請確認憑證與明細正確性。</Card.Description
                        >
                    </Card.Header>
                    <Card.Content>
                        {#if pendingFinance.length === 0}
                            <div
                                class="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg"
                            >
                                目前無待審核單據
                            </div>
                        {:else}
                            <Table.Root>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.Head>單號</Table.Head>
                                        <Table.Head>申請人</Table.Head>
                                        <Table.Head>事由</Table.Head>
                                        <Table.Head>金額</Table.Head>
                                        <Table.Head>提交日期</Table.Head>
                                        <Table.Head class="text-right"
                                            >操作</Table.Head
                                        >
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {#each pendingFinance as claim}
                                        <Table.Row
                                            class="cursor-pointer"
                                            onclick={() =>
                                                goto(`/claims/${claim.id}`)}
                                        >
                                            <Table.Cell class="font-bold"
                                                >{claim.id}</Table.Cell
                                            >
                                            <Table.Cell>
                                                <div class="font-medium">
                                                    {claim.applicant?.full_name}
                                                </div>
                                            </Table.Cell>
                                            <Table.Cell
                                                >{claim.description}</Table.Cell
                                            >
                                            <Table.Cell
                                                class="font-mono text-blue-600"
                                                >{formatAmount(
                                                    claim.total_amount,
                                                )}</Table.Cell
                                            >
                                            <Table.Cell
                                                >{formatDate(
                                                    claim.submitted_at,
                                                )}</Table.Cell
                                            >
                                            <Table.Cell class="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm">詳情</Button
                                                >
                                            </Table.Cell>
                                        </Table.Row>
                                    {/each}
                                </Table.Body>
                            </Table.Root>
                        {/if}
                    </Card.Content>
                </Card.Root>
            </Tabs.Content>

            <Tabs.Content value="payment" class="space-y-4">
                <Card.Root>
                    <Card.Header>
                        <Card.Title>待撥款單據</Card.Title>
                        <Card.Description
                            >已通過審核，待匯款處理。</Card.Description
                        >
                    </Card.Header>
                    <Card.Content>
                        {#if pendingPayment.length === 0}
                            <div
                                class="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg"
                            >
                                目前無待撥款單據
                            </div>
                        {:else}
                            <Table.Root>
                                <!-- Similar to above tables -->
                                <Table.Header>
                                    <Table.Row>
                                        <Table.Head>單號</Table.Head>
                                        <Table.Head>申請人</Table.Head>
                                        <Table.Head>金額</Table.Head>
                                        <Table.Head class="text-right"
                                            >操作</Table.Head
                                        >
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {#each pendingPayment as claim}
                                        <Table.Row
                                            class="cursor-pointer"
                                            onclick={() =>
                                                goto(`/claims/${claim.id}`)}
                                        >
                                            <Table.Cell class="font-bold"
                                                >{claim.id}</Table.Cell
                                            >
                                            <Table.Cell
                                                >{claim.applicant
                                                    ?.full_name}</Table.Cell
                                            >
                                            <Table.Cell
                                                class="font-mono text-blue-600"
                                                >{formatAmount(
                                                    claim.total_amount,
                                                )}</Table.Cell
                                            >
                                            <Table.Cell class="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm">詳情</Button
                                                >
                                            </Table.Cell>
                                        </Table.Row>
                                    {/each}
                                </Table.Body>
                            </Table.Root>
                        {/if}
                    </Card.Content>
                </Card.Root>
            </Tabs.Content>

            <Tabs.Content value="doc" class="space-y-4">
                <Card.Root>
                    <Card.Header>
                        <Card.Title>補件審核中</Card.Title>
                        <Card.Description
                            >已撥款但有缺失憑證，且申請人已上傳新憑證待確認。</Card.Description
                        >
                    </Card.Header>
                    <Card.Content>
                        {#if pendingDocReview.length === 0}
                            <div
                                class="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg"
                            >
                                目前無待審核補件
                            </div>
                        {:else}
                            <Table.Root>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.Head>單號</Table.Head>
                                        <Table.Head>申請人</Table.Head>
                                        <Table.Head class="text-right"
                                            >操作</Table.Head
                                        >
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {#each pendingDocReview as claim}
                                        <Table.Row
                                            class="cursor-pointer"
                                            onclick={() =>
                                                goto(`/claims/${claim.id}`)}
                                        >
                                            <Table.Cell class="font-bold"
                                                >{claim.id}</Table.Cell
                                            >
                                            <Table.Cell
                                                >{claim.applicant
                                                    ?.full_name}</Table.Cell
                                            >
                                            <Table.Cell class="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm">詳情</Button
                                                >
                                            </Table.Cell>
                                        </Table.Row>
                                    {/each}
                                </Table.Body>
                            </Table.Root>
                        {/if}
                    </Card.Content>
                </Card.Root>
            </Tabs.Content>
        {/if}
    </Tabs.Root>
</div>
