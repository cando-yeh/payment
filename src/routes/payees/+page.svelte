<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Table from "$lib/components/ui/table";
    import { Badge } from "$lib/components/ui/badge";
    import { Input } from "$lib/components/ui/input";
    import { Plus, Search, FilePen, Undo2 } from "lucide-svelte";
    import { goto, invalidateAll } from "$app/navigation";
    import { enhance } from "$app/forms";
    import { toast } from "svelte-sonner";

    let { data } = $props();

    // Merge active payees and pending creation requests
    let payees = $derived.by(() => {
        const active = data.payees.map((p: any) => ({
            ...p,
            source: "active",
        }));
        const pending = data.pendingCreates.map((req: any) => ({
            id: req.id, // Request ID, not Payee ID
            name: req.proposed_data?.name || "Unknown",
            type: req.proposed_data?.type || "unknown",
            tax_id: "Pending...", // Masked or just placeholder
            status: "pending_create", // Special status for UI
            source: "request",
            request_id: req.id,
        }));
        return [...pending, ...active];
    });

    let searchTerm = $state("");
    let typeFilter = $state("all"); // all, vendor, personal

    let filteredPayees = $derived(
        payees.filter((p) => {
            const matchesSearch = p.name
                ?.toLowerCase()
                .includes(searchTerm.toLowerCase());
            const matchesType = typeFilter === "all" || p.type === typeFilter;
            return matchesSearch && matchesType;
        }),
    );

    function getStatusBadge(status: string) {
        switch (status) {
            case "available":
                return { variant: "default", label: "已啟用" };
            case "disabled":
                return { variant: "destructive", label: "已停用" };
            case "pending_create":
                return { variant: "secondary", label: "待審核 (新增)" };
            case "pending_update":
                return { variant: "outline", label: "待審核 (更新)" };
            case "pending_disable":
                return { variant: "destructive", label: "待審核 (停用)" };
            default:
                return { variant: "outline", label: status };
        }
    }

    function getTypeLabel(type: string) {
        switch (type) {
            case "vendor":
                return "廠商";
            case "personal":
                return "個人";
            case "employee":
                return "員工";
            default:
                return type;
        }
    }
</script>

<div class="flex flex-col gap-6 p-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-3xl font-bold tracking-tight">受款人管理</h1>
            <p class="text-muted-foreground mt-2">
                管理所有廠商與個人受款對象。
            </p>
        </div>
        <Button onclick={() => goto("/payees/new")}>
            <Plus class="mr-2 h-4 w-4" />
            新增受款人
        </Button>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-4">
        <div class="relative w-full max-w-sm">
            <Search
                class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
            />
            <Input
                type="search"
                placeholder="搜尋名稱..."
                class="pl-8"
                bind:value={searchTerm}
            />
        </div>
        <div class="flex items-center rounded-md border p-1">
            <Button
                variant={typeFilter === "all" ? "secondary" : "ghost"}
                size="sm"
                onclick={() => (typeFilter = "all")}
            >
                全部
            </Button>
            <Button
                variant={typeFilter === "vendor" ? "secondary" : "ghost"}
                size="sm"
                onclick={() => (typeFilter = "vendor")}
            >
                廠商
            </Button>
            <Button
                variant={typeFilter === "personal" ? "secondary" : "ghost"}
                size="sm"
                onclick={() => (typeFilter = "personal")}
            >
                個人
            </Button>
        </div>
    </div>

    <!-- Data Table -->
    <div class="rounded-md border">
        <Table.Root>
            <Table.Header>
                <Table.Row>
                    <Table.Head>名稱</Table.Head>
                    <Table.Head>類型</Table.Head>
                    <Table.Head>狀態</Table.Head>
                    <Table.Head>操作</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {#each filteredPayees as payee}
                    <Table.Row>
                        <Table.Cell class="font-medium">{payee.name}</Table.Cell
                        >
                        <Table.Cell>{getTypeLabel(payee.type)}</Table.Cell>
                        <Table.Cell>
                            {@const badge = getStatusBadge(payee.status)}
                            <Badge variant={badge.variant as any}
                                >{badge.label}</Badge
                            >
                        </Table.Cell>
                        <Table.Cell>
                            <div class="flex items-center gap-2">
                                {#if payee.source === "active"}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onclick={() =>
                                            goto(`/payees/${payee.id}/edit`)}
                                    >
                                        <FilePen class="h-4 w-4" />
                                    </Button>
                                {:else if payee.source === "request"}
                                    <!-- 撤銷申請 -->
                                    <form
                                        method="POST"
                                        action="?/withdrawRequest"
                                        use:enhance={() => {
                                            return async ({ result }) => {
                                                if (result.type === "success") {
                                                    toast.success("申請已撤銷");
                                                    await invalidateAll();
                                                } else {
                                                    toast.error("撤銷失敗");
                                                }
                                            };
                                        }}
                                    >
                                        <input
                                            type="hidden"
                                            name="requestId"
                                            value={payee.request_id}
                                        />
                                        <Button
                                            type="submit"
                                            variant="ghost"
                                            size="icon"
                                            title="撤銷申請"
                                        >
                                            <Undo2 class="h-4 w-4" />
                                        </Button>
                                    </form>
                                {/if}
                            </div>
                        </Table.Cell>
                    </Table.Row>
                {:else}
                    <Table.Row>
                        <Table.Cell colspan={4} class="h-24 text-center">
                            無資料
                        </Table.Cell>
                    </Table.Row>
                {/each}
            </Table.Body>
        </Table.Root>
    </div>
</div>
