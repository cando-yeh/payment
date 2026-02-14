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
        Eye,
        EyeOff,
        LoaderCircle,
        Building2,
        User,
        Ban,
        Trash2,
        UserX,
        UserCheck,
    } from "lucide-svelte";
    import { invalidateAll } from "$app/navigation";
    import { enhance, deserialize } from "$app/forms";
    import { toast } from "svelte-sonner";
    import PayeeSheet from "$lib/components/layout/PayeeSheet.svelte";
    import PayeeRequestSheet from "$lib/components/layout/PayeeRequestSheet.svelte";

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
                        ? req.proposed_data?.name || "未知收款人"
                        : `[${req.change_type === "update" ? "更新" : "停用"}] ${linkedPayee?.name || req.payee_id}`,
                type:
                    req.change_type === "create"
                        ? req.proposed_data?.type || "unknown"
                        : linkedPayee?.type || "unknown",
                bank_code:
                    req.change_type === "create"
                        ? req.proposed_data?.bank_code || "-"
                        : linkedPayee?.bank || "-",
                bank_account: req.proposed_bank_account_tail
                    ? `*******${String(req.proposed_bank_account_tail).slice(-5)}`
                    : req.proposed_bank_account
                      ? "*******"
                      : "-",
                status: `pending_${req.change_type}`,
                source: "request",
                payload: {
                    ...req,
                    linked_payee: linkedPayee || null,
                }, // Store full request + current payee snapshot for detail view
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
                bank_account: p.bank_account_tail
                    ? `*******${String(p.bank_account_tail).slice(-5)}`
                    : p.bank_account
                      ? "*******"
                      : "-",
            })),
        ];
    });

    let searchTerm = $state("");
    let typeFilter = $state("all");
    let isActionSubmitting = $state(false);
    let revealedAccounts = $state<Record<string, string>>({});
    let revealingById = $state<Record<string, boolean>>({});

    // Detail Dialog State (for requests)
    let selectedPayee = $state<any>(null);
    let isDetailOpen = $state(false);

    // Edit Sheet State (for active payees)
    let editingPayee = $state<any>(null);
    let isSheetOpen = $state(false);

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
        queueMicrotask(() => {
            isDetailOpen = true;
        });
    }

    function openEditSheet(payee: any) {
        editingPayee = payee;
        queueMicrotask(() => {
            isSheetOpen = true;
        });
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

    async function handleWithdrawRequestFromList(payee: any) {
        const requestId = payee?.payload?.id || payee?.id;
        if (!requestId) return;
        openSystemConfirm({
            title: "確認撤銷申請",
            description: `確定要撤銷「${payee.name}」的申請？`,
            buttonLabel: "撤銷申請",
            buttonVariant: "destructive",
            action: async () => {
                isActionSubmitting = true;
                const formData = new FormData();
                formData.append("requestId", requestId);

                try {
                    const response = await fetch("?/withdrawRequest", {
                        method: "POST",
                        body: formData,
                        headers: { "x-sveltekit-action": "true" },
                    });
                    const result = deserialize(await response.text()) as any;
                    if (result.type === "success") {
                        toast.success("申請已撤銷");
                        await invalidateAll();
                    } else {
                        toast.error(result.data?.message || "撤銷失敗");
                    }
                } catch {
                    toast.error("連線錯誤");
                } finally {
                    isActionSubmitting = false;
                }
            },
        });
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
                } catch {
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
                } catch {
                    toast.error("連線錯誤");
                } finally {
                    isActionSubmitting = false;
                }
            },
        });
    }

    async function handleSubmitDisableRequest(payee: any) {
        openSystemConfirm({
            title: "確認提交停用申請",
            description: `確定要提交收款人「${payee.name}」的停用申請？`,
            buttonLabel: "提交停用申請",
            buttonVariant: "destructive",
            action: async () => {
                isActionSubmitting = true;
                const formData = new FormData();
                formData.append("payeeId", payee.id);
                formData.append("reason", "停用收款人申請");

                try {
                    const response = await fetch("?/submitDisableRequest", {
                        method: "POST",
                        body: formData,
                        headers: { "x-sveltekit-action": "true" },
                    });
                    const result = deserialize(await response.text()) as any;
                    if (result.type === "success") {
                        toast.success(
                            result.data?.message ||
                                "停用申請已提交，請等待財務審核",
                        );
                        await invalidateAll();
                    } else {
                        toast.error(result.data?.message || "提交停用申請失敗");
                    }
                } catch {
                    toast.error("連線錯誤");
                } finally {
                    isActionSubmitting = false;
                }
            },
        });
    }

    async function handleToggleRowBankAccount(payee: any, e: MouseEvent) {
        e.stopPropagation();
        if (!payee?.id || payee?.source !== "active") return;

        if (revealedAccounts[payee.id]) {
            const next = { ...revealedAccounts };
            delete next[payee.id];
            revealedAccounts = next;
            return;
        }

        revealingById = { ...revealingById, [payee.id]: true };
        try {
            const formData = new FormData();
            formData.append("payeeId", payee.id);
            const response = await fetch("?/revealPayeeAccount", {
                method: "POST",
                body: formData,
                headers: { "x-sveltekit-action": "true" },
            });
            const result = deserialize(await response.text()) as any;
            if (
                result?.type === "success" &&
                result?.data &&
                "decryptedAccount" in result.data
            ) {
                revealedAccounts = {
                    ...revealedAccounts,
                    [payee.id]: String(result.data.decryptedAccount),
                };
            } else {
                toast.error(result?.data?.message || "無法讀取帳號資訊");
            }
        } catch {
            toast.error("連線錯誤");
        } finally {
            const next = { ...revealingById };
            delete next[payee.id];
            revealingById = next;
        }
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
        <Button href="/payees/new" role="button">
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
                        data-testid={`payee-row-${payee.id}`}
                        onclick={() => {
                            if (payee.source === "active") {
                                openEditSheet(payee);
                            } else {
                                openDetail(payee);
                            }
                        }}
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
                        <Table.Cell>
                            <div class="flex items-center w-full">
                                <span class="flex-1 min-w-0 text-left truncate">
                                    {payee.source === "active" &&
                                    revealedAccounts[payee.id]
                                        ? revealedAccounts[payee.id]
                                        : payee.bank_account || "-"}
                                </span>
                                {#if payee.source === "active" && payee.bank_account && payee.bank_account !== "-"}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        class="h-7 w-7 ml-2 shrink-0 text-muted-foreground"
                                        onclick={(e) =>
                                            handleToggleRowBankAccount(
                                                payee,
                                                e,
                                            )}
                                        disabled={Boolean(
                                            revealingById[payee.id],
                                        )}
                                        title={revealedAccounts[payee.id]
                                            ? "隱藏帳號"
                                            : "顯示帳號"}
                                    >
                                        {#if revealingById[payee.id]}
                                            <LoaderCircle
                                                class="h-3.5 w-3.5 animate-spin"
                                            />
                                        {:else if revealedAccounts[payee.id]}
                                            <Eye class="h-3.5 w-3.5" />
                                        {:else}
                                            <EyeOff class="h-3.5 w-3.5" />
                                        {/if}
                                    </Button>
                                {/if}
                            </div>
                        </Table.Cell>
                        <Table.Cell>
                            {@const badge = getStatusBadge(payee.status)}
                            <Badge variant={badge.variant as any}
                                >{badge.label}</Badge
                            >
                        </Table.Cell>
                        <Table.Cell class="text-right">
                            <div class="flex items-center justify-end gap-1">
                                {#if payee.source === "active" && (data.is_finance || data.is_admin)}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        data-testid={`payee-toggle-${payee.id}`}
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
                                        data-testid={`payee-delete-${payee.id}`}
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
                                {#if payee.source === "active" && !(data.is_finance || data.is_admin) && payee.status === "available"}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        data-testid={`payee-request-disable-${payee.id}`}
                                        class="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            handleSubmitDisableRequest(payee);
                                        }}
                                        disabled={isActionSubmitting}
                                        title="提交停用申請"
                                    >
                                        <Ban class="h-4 w-4" />
                                    </Button>
                                {/if}
                                {#if payee.source === "request" &&
                                    payee?.payload?.requested_by === data.user?.id &&
                                    payee?.payload?.status === "pending"}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        data-testid={`payee-request-withdraw-${payee.id}`}
                                        class="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            handleWithdrawRequestFromList(payee);
                                        }}
                                        disabled={isActionSubmitting}
                                        title="撤銷申請"
                                    >
                                        <Undo2 class="h-4 w-4" />
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

<!-- Request Drawer -->
<PayeeRequestSheet
    bind:open={isDetailOpen}
    request={selectedPayee}
    isFinance={data.is_finance}
/>

<PayeeSheet
    bind:open={isSheetOpen}
    payee={editingPayee}
    isFinance={data.is_finance}
/>

<Dialog.Root bind:open={isConfirmOpen}>
    <Dialog.Content class="max-w-md">
        <Dialog.Header>
            <Dialog.Title>{confirmTitle}</Dialog.Title>
            <Dialog.Description>{confirmDescription}</Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
            <Button
                variant="outline"
                data-testid="system-confirm-cancel"
                onclick={() => (isConfirmOpen = false)}>取消</Button
            >
            <Button
                variant={confirmButtonVariant}
                data-testid="system-confirm-submit"
                onclick={runConfirmedAction}
                disabled={!confirmAction}
            >
                {confirmButtonLabel}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
