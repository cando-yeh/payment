<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Table from "$lib/components/ui/table";
    import { Badge } from "$lib/components/ui/badge";
    import { Input } from "$lib/components/ui/input";
    import * as Dialog from "$lib/components/ui/dialog";
    import {
        Plus,
        Search,
        Undo2,
        Check,
        X,
        LoaderCircle,
        Building2,
        User,
        Ban,
        Trash2,
        UserX,
        UserCheck,
    } from "lucide-svelte";
    import { goto, invalidateAll } from "$app/navigation";
    import { enhance, deserialize } from "$app/forms";
    import { toast } from "svelte-sonner";

    let { data } = $props();

    // Merge active payees and all pending requests
    let payees = $derived.by(() => {
        const active = data.payees.map((p: any) => ({
            ...p,
            source: "active",
        }));
        const payeeById = new Map(active.map((p: any) => [p.id, p]));

        // 1. Identify payees with pending requests
        const payeesWithPendingRequests = new Set();

        const pending = data.pendingRequests.map((req: any) => {
            if (req.payee_id) {
                payeesWithPendingRequests.add(req.payee_id);
            }
            const linkedPayee = req.payee_id
                ? payeeById.get(req.payee_id)
                : null;
            return {
                id: req.id, // Request ID
                name:
                    req.change_type === "create"
                        ? req.proposed_data?.name || "未知受款人"
                        : `[${req.change_type === "update" ? "更新" : "停用"}] ${linkedPayee?.name || req.payee_id}`,
                type:
                    req.change_type === "create"
                        ? req.proposed_data?.type || "unknown"
                        : linkedPayee?.type || "unknown",
                bank_code:
                    req.change_type === "create"
                        ? req.proposed_data?.bank_code || "-"
                        : linkedPayee?.bank || "-",
                bank_account: req.proposed_bank_account ? "已加密" : "-",
                status: `pending_${req.change_type}`,
                source: "request",
                payload: req, // Store full request for detail view
            };
        });

        // 2. Filter out active payees that have pending requests
        const visibleActive = active.filter(
            (p) => !payeesWithPendingRequests.has(p.id),
        );

        return [
            ...pending,
            ...visibleActive.map((p) => ({
                ...p,
                bank_code: p.bank || "-",
                bank_account: p.bank_account ? "已加密" : "-",
            })),
        ];
    });

    let searchTerm = $state("");
    let typeFilter = $state("all");
    let isActionSubmitting = $state(false);

    // Detail Dialog State
    let selectedPayee = $state<any>(null);
    let isDetailOpen = $state(false);

    // Confirmation Dialog State
    let isConfirmOpen = $state(false);
    let confirmTitle = $state("");
    let confirmDescription = $state("");
    let confirmButtonLabel = $state("確認");
    let confirmButtonVariant = $state<"default" | "destructive">("default");
    let confirmAction = $state<null | (() => Promise<void>)>(null);

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
                return { label: "廠商", icon: Building2 };
            case "personal":
                return { label: "個人", icon: User };
            case "employee":
                return { label: "員工", icon: User };
            default:
                return { label: type, icon: Building2 };
        }
    }

    function openDetail(payee: any) {
        selectedPayee = payee;
        isDetailOpen = true;
    }

    function openSystemConfirm(options: {
        title: string;
        description: string;
        buttonLabel: string;
        buttonVariant?: "default" | "destructive";
        action: () => Promise<void>;
    }) {
        confirmTitle = options.title;
        confirmDescription = options.description;
        confirmButtonLabel = options.buttonLabel;
        confirmButtonVariant = options.buttonVariant ?? "default";
        confirmAction = options.action;
        isConfirmOpen = true;
    }

    async function runConfirmedAction() {
        const action = confirmAction;
        isConfirmOpen = false;
        confirmAction = null;
        if (action) await action();
    }

    /**
     * Common form submission handler for actions (Withdraw, Approve)
     */
    function handleAction(successMsg: string) {
        return () => {
            isActionSubmitting = true;
            return async ({ result }: { result: any }) => {
                isActionSubmitting = false;
                if (result.type === "success") {
                    toast.success(successMsg);
                    isDetailOpen = false;
                    await invalidateAll();
                } else if (result.type === "failure") {
                    toast.error(result.data?.message || "操作失敗");
                }
            };
        };
    }

    async function handleToggleStatus(payee: any) {
        const action = payee.status === "available" ? "停用" : "啟用";
        openSystemConfirm({
            title: `確認${action}收款人`,
            description: `確定要${action}收款人「${payee.name}」？`,
            buttonLabel: `${action}收款人`,
            buttonVariant:
                payee.status === "available" ? "destructive" : "default",
            action: async () => {
                isActionSubmitting = true;
                const formData = new FormData();
                formData.append("payeeId", payee.id);
                formData.append("currentStatus", payee.status);

                try {
                    const response = await fetch("?/toggleStatus", {
                        method: "POST",
                        body: formData,
                        headers: { "x-sveltekit-action": "true" },
                    });
                    const result = deserialize(await response.text()) as any;
                    if (result.type === "success") {
                        toast.success(result.data?.message || `已${action}`);
                        await invalidateAll();
                    } else {
                        toast.error(result.data?.message || `${action}失敗`);
                    }
                } catch (e) {
                    toast.error("連線錯誤");
                } finally {
                    isActionSubmitting = false;
                }
            },
        });
    }

    async function handleRemovePayee(payee: any) {
        openSystemConfirm({
            title: "確認永久刪除",
            description: `確定要永久刪除收款人「${payee.name}」？此操作無法復原。`,
            buttonLabel: "永久刪除",
            buttonVariant: "destructive",
            action: async () => {
                isActionSubmitting = true;
                const formData = new FormData();
                formData.append("payeeId", payee.id);

                try {
                    const response = await fetch("?/removePayee", {
                        method: "POST",
                        body: formData,
                        headers: { "x-sveltekit-action": "true" },
                    });
                    const result = deserialize(await response.text()) as any;
                    if (result.type === "success") {
                        toast.success("收款人已永久刪除");
                        isDetailOpen = false;
                        await invalidateAll();
                    } else {
                        toast.error(result.data?.message || "刪除失敗");
                    }
                } catch (e) {
                    toast.error("連線錯誤");
                } finally {
                    isActionSubmitting = false;
                }
            },
        });
    }
</script>

<div class="flex flex-col gap-6 p-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-3xl font-bold tracking-tight">收款人管理</h1>
            <p class="text-muted-foreground mt-2">
                管理所有廠商與個人收款對象。
            </p>
        </div>
        <Button onclick={() => goto("/payees/new")}>
            <Plus class="mr-2 h-4 w-4" />
            新增收款人
        </Button>
    </div>

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
            {#each ["all", "vendor", "personal"] as filter}
                <Button
                    variant={typeFilter === filter ? "secondary" : "ghost"}
                    size="sm"
                    onclick={() => (typeFilter = filter)}
                >
                    {filter === "all"
                        ? "全部"
                        : filter === "vendor"
                          ? "廠商"
                          : "個人"}
                </Button>
            {/each}
        </div>
    </div>

    <div class="rounded-md border">
        <Table.Root>
            <Table.Header>
                <Table.Row>
                    <Table.Head>名稱</Table.Head>
                    <Table.Head>類型</Table.Head>
                    <Table.Head>銀行</Table.Head>
                    <Table.Head>銀行帳號</Table.Head>
                    <Table.Head>狀態</Table.Head>
                    <Table.Head class="text-right">操作</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {#each filteredPayees as payee}
                    <Table.Row
                        class="cursor-pointer hover:bg-muted/50 transition-colors"
                        onclick={() => openDetail(payee)}
                    >
                        <Table.Cell class="font-medium">{payee.name}</Table.Cell
                        >
                        <Table.Cell>
                            {@const typeInfo = getTypeLabel(payee.type)}
                            <div class="flex items-center gap-2">
                                <typeInfo.icon
                                    class="h-4 w-4 text-muted-foreground"
                                />
                                {typeInfo.label}
                            </div>
                        </Table.Cell>
                        <Table.Cell>{payee.bank_code}</Table.Cell>
                        <Table.Cell>{payee.bank_account || "-"}</Table.Cell>
                        <Table.Cell>
                            {@const badge = getStatusBadge(payee.status)}
                            <Badge variant={badge.variant as any}
                                >{badge.label}</Badge
                            >
                        </Table.Cell>
                        <Table.Cell class="text-right">
                            <div class="flex items-center justify-end gap-1">
                                {#if payee.source === "active" && data.is_finance}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        class="h-8 w-8 text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            handleToggleStatus(payee);
                                        }}
                                        disabled={isActionSubmitting}
                                        title={payee.status === "available"
                                            ? "停用收款人"
                                            : "啟用收款人"}
                                    >
                                        {#if payee.status === "available"}
                                            <UserX class="h-4 w-4" />
                                        {:else}
                                            <UserCheck class="h-4 w-4" />
                                        {/if}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        class="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            handleRemovePayee(payee);
                                        }}
                                        disabled={isActionSubmitting}
                                        title="永久刪除"
                                    >
                                        <Trash2 class="h-4 w-4" />
                                    </Button>
                                {/if}
                            </div>
                        </Table.Cell>
                    </Table.Row>
                {:else}
                    <Table.Row>
                        <Table.Cell
                            colspan={6}
                            class="h-24 text-center text-muted-foreground"
                            >無資料</Table.Cell
                        >
                    </Table.Row>
                {/each}
            </Table.Body>
        </Table.Root>
    </div>
</div>

<!-- Detail Dialog -->
<Dialog.Root bind:open={isDetailOpen}>
    <Dialog.Content class="max-w-md">
        <Dialog.Header>
            <Dialog.Title>{selectedPayee?.name}</Dialog.Title>
            <Dialog.Description>收款人詳細資訊與狀態管理</Dialog.Description>
        </Dialog.Header>

        {#if selectedPayee}
            <div class="grid gap-4 py-4">
                <div class="grid grid-cols-4 items-start gap-4">
                    <span class="text-sm font-medium text-muted-foreground"
                        >狀態</span
                    >
                    <div class="col-span-3">
                        <Badge
                            variant={getStatusBadge(selectedPayee.status)
                                .variant as any}
                            >{getStatusBadge(selectedPayee.status).label}</Badge
                        >
                    </div>
                </div>

                <div class="border-t pt-4 space-y-3">
                    <div class="grid grid-cols-4 items-start gap-4">
                        <span class="text-sm font-medium text-muted-foreground"
                            >銀行代碼</span
                        >
                        <span class="col-span-3 text-sm"
                            >{selectedPayee.bank_code || "-"}</span
                        >
                    </div>
                    <div class="grid grid-cols-4 items-start gap-4">
                        <span class="text-sm font-medium text-muted-foreground"
                            >銀行帳號</span
                        >
                        <span class="col-span-3 text-sm"
                            >{selectedPayee.bank_account || "-"}</span
                        >
                    </div>
                </div>

                <!-- Fields for Request -->
                {#if selectedPayee.source === "request"}
                    {@const data = selectedPayee.payload.proposed_data}
                    <div class="border-t pt-4 space-y-3">
                        <div class="grid grid-cols-4 items-start gap-4">
                            <span
                                class="text-sm font-medium text-muted-foreground"
                                >銀行代碼</span
                            >
                            <span class="col-span-3 text-sm"
                                >{data?.bank_code || "-"}</span
                            >
                        </div>
                        <div class="grid grid-cols-4 items-start gap-4">
                            <span
                                class="text-sm font-medium text-muted-foreground"
                                >服務項目</span
                            >
                            <span class="col-span-3 text-sm"
                                >{data?.service_description || "-"}</span
                            >
                        </div>
                        {#if data?.type === "personal"}
                            <div class="grid grid-cols-4 items-start gap-4">
                                <span
                                    class="text-sm font-medium text-muted-foreground"
                                    >電子郵件</span
                                >
                                <span class="col-span-3 text-sm"
                                    >{data?.email || "-"}</span
                                >
                            </div>
                            <div class="grid grid-cols-4 items-start gap-4">
                                <span
                                    class="text-sm font-medium text-muted-foreground"
                                    >通訊地址</span
                                >
                                <span class="col-span-3 text-sm"
                                    >{data?.address || "-"}</span
                                >
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>

            <Dialog.Footer class="flex sm:justify-between items-center gap-2">
                <div>
                    {#if selectedPayee.source === "request" && selectedPayee.payload.requested_by === data.user?.id}
                        <form
                            method="POST"
                            action="?/withdrawRequest"
                            use:enhance={handleAction("申請已撤銷")}
                        >
                            <input
                                type="hidden"
                                name="requestId"
                                value={selectedPayee.id}
                            />
                            <Button
                                type="submit"
                                variant="outline"
                                size="sm"
                                disabled={isActionSubmitting}
                            >
                                {#if isActionSubmitting}
                                    <LoaderCircle
                                        class="mr-2 h-3 w-3 animate-spin"
                                    />
                                {:else}
                                    <Undo2 class="mr-2 h-3 w-3" />
                                {/if}
                                撤銷申請
                            </Button>
                        </form>
                    {/if}
                </div>

                <div class="flex gap-2">
                    {#if selectedPayee.source === "active"}
                        {#if selectedPayee.status === "available"}
                            <form
                                method="POST"
                                action="?/submitDisableRequest"
                                use:enhance={handleAction("停用申請已提交")}
                            >
                                <input
                                    type="hidden"
                                    name="payeeId"
                                    value={selectedPayee.id}
                                />
                                <Button
                                    type="submit"
                                    variant="destructive"
                                    size="sm"
                                    disabled={isActionSubmitting}
                                >
                                    {#if isActionSubmitting}
                                        <LoaderCircle
                                            class="mr-2 h-3 w-3 animate-spin"
                                        />
                                    {:else}
                                        <Ban class="mr-2 h-3 w-3" />
                                    {/if}
                                    停用收款人
                                </Button>
                            </form>
                        {/if}
                    {/if}

                    {#if selectedPayee.source === "request" && data.is_finance}
                        <form
                            method="POST"
                            action="?/rejectPayeeRequest"
                            use:enhance={handleAction("申請已駁回")}
                        >
                            <input
                                type="hidden"
                                name="requestId"
                                value={selectedPayee.id}
                            />
                            <Button
                                type="submit"
                                variant="destructive"
                                size="sm"
                                disabled={isActionSubmitting}
                            >
                                {#if isActionSubmitting}
                                    <LoaderCircle
                                        class="mr-2 h-3 w-3 animate-spin"
                                    />
                                {:else}
                                    <X class="mr-2 h-3 w-3" />
                                {/if}
                                駁回
                            </Button>
                        </form>
                        <form
                            method="POST"
                            action="?/approvePayeeRequest"
                            use:enhance={handleAction("申請已核准")}
                        >
                            <input
                                type="hidden"
                                name="requestId"
                                value={selectedPayee.id}
                            />
                            <Button
                                type="submit"
                                variant="default"
                                size="sm"
                                disabled={isActionSubmitting}
                            >
                                {#if isActionSubmitting}
                                    <LoaderCircle
                                        class="mr-2 h-3 w-3 animate-spin"
                                    />
                                {:else}
                                    <Check class="mr-2 h-3 w-3" />
                                {/if}
                                核准
                            </Button>
                        </form>
                    {/if}
                    <Button
                        variant="secondary"
                        size="sm"
                        onclick={() => (isDetailOpen = false)}>關閉</Button
                    >
                </div>
            </Dialog.Footer>
        {/if}
    </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={isConfirmOpen}>
    <Dialog.Content class="max-w-md">
        <Dialog.Header>
            <Dialog.Title>{confirmTitle}</Dialog.Title>
            <Dialog.Description>{confirmDescription}</Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
            <Button variant="outline" onclick={() => (isConfirmOpen = false)}
                >取消</Button
            >
            <Button
                variant={confirmButtonVariant}
                onclick={runConfirmedAction}
                disabled={!confirmAction}
            >
                {confirmButtonLabel}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
