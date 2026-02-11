<script lang="ts">
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import * as Table from "$lib/components/ui/table";
    import * as Tabs from "$lib/components/ui/tabs";
    import { Badge } from "$lib/components/ui/badge";
    import { Plus, Search, FileText, Filter } from "lucide-svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    let searchTimeout: NodeJS.Timeout;

    function handleSearch(e: Event) {
        const value = (e.target as HTMLInputElement).value;
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const url = new URL(page.url);
            if (value) {
                url.searchParams.set("search", value);
            } else {
                url.searchParams.delete("search");
            }
            goto(url);
        }, 500);
    }

    function handleTabChange(value: string) {
        const url = new URL(page.url);
        url.searchParams.set("tab", value);
        goto(url);
    }

    const statusMap: Record<string, { label: string; color: string }> = {
        draft: { label: "草稿", color: "bg-gray-200 text-gray-800" },
        pending_manager: {
            label: "待主管審核",
            color: "bg-yellow-100 text-yellow-800",
        },
        pending_finance: {
            label: "待財務審核",
            color: "bg-blue-100 text-blue-800",
        },
        pending_payment: {
            label: "待付款",
            color: "bg-purple-100 text-purple-800",
        },
        paid: {
            label: "已付款",
            color: "bg-green-100 text-green-800 change-green",
        },
        paid_pending_doc: {
            label: "已付款(待補件)",
            color: "bg-orange-100 text-orange-800",
        },
        pending_doc_review: {
            label: "補件審核中",
            color: "bg-orange-100 text-orange-800",
        },
        returned: { label: "已退回", color: "bg-red-100 text-red-800" },
        cancelled: { label: "已撤銷", color: "bg-gray-200 text-gray-500" },
    };

    function getStatusBadge(status: string) {
        return statusMap[status] || { label: status, color: "bg-gray-100" };
    }

    function formatDate(dateString: string) {
        return new Date(dateString).toLocaleDateString("zh-TW");
    }

    // Determine current tab from URL or default to 'drafts'
    let currentTab = $derived(page.url.searchParams.get("tab") || "drafts");
</script>

<div class="container mx-auto py-6 space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-3xl font-bold tracking-tight text-primary">
                我的請款單
            </h1>
            <p class="text-muted-foreground mt-1">管理與追蹤您的所有請款申請</p>
        </div>
        <Button href="/claims/new">
            <Plus class="mr-2 h-4 w-4" />
            建立請款單
        </Button>
    </div>

    <Tabs.Root
        value={currentTab}
        onValueChange={handleTabChange}
        class="w-full"
    >
        <div class="flex items-center justify-between mb-4">
            <Tabs.List>
                <Tabs.Trigger value="drafts">草稿與退回</Tabs.Trigger>
                <Tabs.Trigger value="processing">審核中</Tabs.Trigger>
                <Tabs.Trigger value="action_required">待補件</Tabs.Trigger>
                <Tabs.Trigger value="history">歷史紀錄</Tabs.Trigger>
            </Tabs.List>

            <div class="flex items-center space-x-2">
                <div class="relative">
                    <Search
                        class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                    />
                    <Input
                        type="search"
                        placeholder="搜尋單號或說明..."
                        class="pl-9 w-[250px]"
                        value={data.search}
                        oninput={handleSearch}
                    />
                </div>
                <!-- Future: Advanced Filter Button -->
                <!-- <Button variant="outline" size="icon"><Filter class="h-4 w-4" /></Button> -->
            </div>
        </div>

        <Tabs.Content value={currentTab} class="space-y-4">
            <div
                class="rounded-md border bg-card text-card-foreground shadow-sm"
            >
                <Table.Root>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head class="w-[120px]">單號</Table.Head>
                            <Table.Head class="w-[100px]">類別</Table.Head>
                            <Table.Head>說明</Table.Head>
                            <Table.Head class="w-[150px]">受款/對象</Table.Head>
                            <Table.Head class="text-right w-[120px]"
                                >總金額</Table.Head
                            >
                            <Table.Head class="w-[120px]">狀態</Table.Head>
                            <Table.Head class="w-[120px]">建立日期</Table.Head>
                            <Table.Head class="w-[80px]"></Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {#if data.claims && data.claims.length > 0}
                            {#each data.claims as claim}
                                <Table.Row>
                                    <Table.Cell class="font-medium"
                                        >{claim.id}</Table.Cell
                                    >
                                    <Table.Cell>
                                        {#if claim.claim_type === "employee"}
                                            <Badge variant="outline"
                                                >員工報銷</Badge
                                            >
                                        {:else if claim.claim_type === "vendor"}
                                            <Badge variant="outline"
                                                >廠商請款</Badge
                                            >
                                        {:else if claim.claim_type === "personal_service"}
                                            <Badge variant="outline"
                                                >個人勞務</Badge
                                            >
                                        {/if}
                                    </Table.Cell>
                                    <Table.Cell
                                        class="max-w-[300px] truncate"
                                        title={claim.description}
                                    >
                                        {claim.description}
                                        {#if claim.items && claim.items[0]?.count > 0}
                                            <span
                                                class="text-xs text-muted-foreground ml-2"
                                                >({claim.items[0].count} items)</span
                                            >
                                        {/if}
                                    </Table.Cell>
                                    <Table.Cell>
                                        {claim.payee?.name ||
                                            claim.approver?.full_name ||
                                            "-"}
                                    </Table.Cell>
                                    <Table.Cell class="text-right font-mono">
                                        {new Intl.NumberFormat("zh-TW", {
                                            style: "currency",
                                            currency: "TWD",
                                            maximumFractionDigits: 0,
                                        }).format(claim.total_amount)}
                                    </Table.Cell>
                                    <Table.Cell>
                                        {@const status = getStatusBadge(
                                            claim.status,
                                        )}
                                        <Badge
                                            class={status.color}
                                            variant="secondary"
                                            >{status.label}</Badge
                                        >
                                    </Table.Cell>
                                    <Table.Cell
                                        >{formatDate(
                                            claim.created_at,
                                        )}</Table.Cell
                                    >
                                    <Table.Cell>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            href={`/claims/${claim.id}`}
                                        >
                                            查看
                                        </Button>
                                    </Table.Cell>
                                </Table.Row>
                            {/each}
                        {:else}
                            <Table.Row>
                                <Table.Cell
                                    colspan={8}
                                    class="h-24 text-center"
                                >
                                    <div
                                        class="flex flex-col items-center justify-center text-muted-foreground"
                                    >
                                        <FileText
                                            class="h-8 w-8 mb-2 opacity-20"
                                        />
                                        <p>尚無資料</p>
                                    </div>
                                </Table.Cell>
                            </Table.Row>
                        {/if}
                    </Table.Body>
                </Table.Root>
            </div>
        </Tabs.Content>
    </Tabs.Root>
</div>
