<script lang="ts">
    import { enhance } from "$app/forms";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import * as Card from "$lib/components/ui/card";
    import * as Table from "$lib/components/ui/table";
    import * as Sheet from "$lib/components/ui/sheet";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import {
        ArrowLeft,
        FileText,
        Upload,
        Trash2,
        Send,
        Save,
        Paperclip,
        Eye,
        ExternalLink,
        Undo2,
        CheckCircle2,
        XCircle,
        History,
        Landmark,
        AlertCircle,
        ReceiptText,
        ArrowRight,
        Clock,
        Bell,
    } from "lucide-svelte";
    import * as Dialog from "$lib/components/ui/dialog";
    import AuditTimeline from "$lib/components/shared/AuditTimeline.svelte";
    import { fade, fly } from "svelte/transition";
    import { cn } from "$lib/utils";
    import { compressImageFile } from "$lib/client/image-compression";
    import { toast } from "svelte-sonner";

    import type { PageData } from "./$types";

    let { data, form }: { data: PageData; form: any } = $props();
    let claim = $derived(data.claim);
    let items = $derived(data.claim?.items || []);
    let history = $derived(data.claim?.history || []);
    let currentUser = $derived(data.user);

    // Drawer State
    let isDrawerOpen = $state(false);
    let selectedItem = $state<any>(null);
    let isUploading = $state(false);

    // Approval Modal State
    let isRejectModalOpen = $state(false);
    let subStatus = $state<"approve" | "reject">("approve");
    let comment = $state("");

    // Duplicate Modal State
    let isDuplicateModalOpen = $state(false);
    let duplicates = $derived(form?.duplicates || []);
    let pendingAction = $state<"submit" | "approve" | null>(null);
    let isPrimaryActionSubmitting = $state(false);
    let isConfirmModalOpen = $state(false);
    let confirmTitle = $state("確認操作");
    let confirmMessage = $state("");
    let confirmButtonLabel = $state("確認");
    let confirmButtonVariant = $state<"default" | "destructive">("default");
    let pendingConfirmForm = $state<HTMLFormElement | null>(null);
    let allowConfirmedSubmitFor = $state<HTMLFormElement | null>(null);

    $effect(() => {
        if (form?.duplicates?.length > 0) {
            isDuplicateModalOpen = true;
        }
    });

    function openAttachmentDrawer(item: any) {
        selectedItem = item;
        isDrawerOpen = true;
    }

    function requestConfirmSubmit(
        event: SubmitEvent,
        options: {
            title?: string;
            message: string;
            confirmLabel?: string;
            confirmVariant?: "default" | "destructive";
        },
    ) {
        const form = event.currentTarget as HTMLFormElement;
        if (allowConfirmedSubmitFor === form) {
            allowConfirmedSubmitFor = null;
            return;
        }
        event.preventDefault();
        pendingConfirmForm = form;
        confirmTitle = options.title || "確認操作";
        confirmMessage = options.message;
        confirmButtonLabel = options.confirmLabel || "確認";
        confirmButtonVariant = options.confirmVariant || "default";
        isConfirmModalOpen = true;
    }

    function executeConfirmedSubmit() {
        const form = pendingConfirmForm;
        pendingConfirmForm = null;
        isConfirmModalOpen = false;
        if (!form || !form.isConnected) return;
        allowConfirmedSubmitFor = form;
        form.requestSubmit();
    }

    function cancelConfirmedSubmit() {
        pendingConfirmForm = null;
        isConfirmModalOpen = false;
    }

    function enhanceAction({
        successMessage,
        onSuccess,
        onFinally,
    }: {
        successMessage?: string;
        onSuccess?: () => void;
        onFinally?: () => void;
    } = {}) {
        return async ({
            result,
            update,
        }: {
            result: any;
            update: () => Promise<void>;
        }) => {
            if (result.type === "success" && successMessage) {
                toast.success(successMessage);
            } else if (result.type === "failure") {
                toast.error(result.data?.message || "操作失敗");
            }

            if (result.type === "success") {
                onSuccess?.();
            }

            await update();
            onFinally?.();
        };
    }

    const statusMap: Record<
        string,
        { label: string; color: string; icon: any }
    > = {
        draft: {
            label: "草稿",
            color: "bg-slate-100 text-slate-600 border-slate-200",
            icon: FileText,
        },
        pending_manager: {
            label: "待主管審核",
            color: "bg-amber-100 text-amber-700 border-amber-200",
            icon: Clock,
        },
        pending_finance: {
            label: "待財務審核",
            color: "bg-blue-100 text-blue-700 border-blue-200",
            icon: Bell,
        },
        pending_payment: {
            label: "待付款",
            color: "bg-indigo-100 text-indigo-700 border-indigo-200",
            icon: Landmark,
        },
        paid: {
            label: "已付款",
            color: "bg-emerald-100 text-emerald-700 border-emerald-200",
            icon: CheckCircle2,
        },
        paid_pending_doc: {
            label: "已付款(待補件)",
            color: "bg-orange-100 text-orange-700 border-orange-200",
            icon: AlertCircle,
        },
        pending_doc_review: {
            label: "補件審核中",
            color: "bg-orange-100 text-orange-700 border-orange-200",
            icon: Clock,
        },
        returned: {
            label: "已退回",
            color: "bg-rose-100 text-rose-700 border-rose-200",
            icon: XCircle,
        },
        cancelled: {
            label: "已撤銷",
            color: "bg-slate-50 text-slate-400 border-slate-100",
            icon: XCircle,
        },
    };

    function getStatusBadge(status: string) {
        return (
            statusMap[status] || {
                label: status,
                color: "bg-slate-100 text-slate-600",
                icon: FileText,
            }
        );
    }

    function formatAmount(amount: number) {
        return new Intl.NumberFormat("zh-TW", {
            style: "currency",
            currency: "TWD",
            maximumFractionDigits: 0,
        }).format(amount);
    }

    async function handleAttachmentSelected(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const original = input.files[0];
        const compressed = await compressImageFile(original, {
            maxWidth: 1800,
            maxHeight: 1800,
            maxBytes: 5 * 1024 * 1024,
        });

        if (compressed === original) return;

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(compressed);
        input.files = dataTransfer.files;
    }
</script>

<div class="space-y-10 pb-20" in:fade={{ duration: 400 }}>
    <div class="flex items-center justify-between">
        <Button
            variant="ghost"
            href="/claims"
            class="rounded-lg h-9 px-3 hover:bg-secondary gap-1.5 font-bold text-muted-foreground text-xs"
        >
            <ArrowLeft class="h-3.5 w-3.5" /> 返回清單
        </Button>

        <div class="flex items-center gap-2">
            <!-- Applicant Actions -->
            {#if (claim.status === "draft" || claim.status === "returned") && claim.applicant_id === currentUser.id}
                <form
                    action="?/delete"
                    method="POST"
                    data-testid="claim-delete-form"
                    use:enhance={() =>
                        enhanceAction({
                            successMessage: "草稿已刪除",
                        })}
                    onsubmit={(event) =>
                        requestConfirmSubmit(event, {
                            title: "確認刪除草稿",
                            message: "確定要刪除此草稿嗎？",
                            confirmLabel: "刪除草稿",
                            confirmVariant: "destructive",
                        })}
                >
                    <Button
                        variant="ghost"
                        type="submit"
                        size="sm"
                        data-testid="claim-delete-button"
                        class="text-destructive hover:text-destructive hover:bg-destructive/5 font-bold rounded-lg h-9 px-4"
                    >
                        <Trash2 class="mr-1.5 h-3.5 w-3.5" /> 刪除草稿
                    </Button>
                </form>
                <form
                    action="?/submit"
                    method="POST"
                    data-testid="claim-submit-form"
                    use:enhance={() => {
                        isPrimaryActionSubmitting = true;
                        return enhanceAction({
                            successMessage: "已送出審核",
                            onFinally: () => {
                                isPrimaryActionSubmitting = false;
                            },
                        });
                    }}
                >
                    <Button
                        type="submit"
                        data-testid="claim-submit-button"
                        class="rounded-lg shadow-md shadow-primary/10 font-bold px-6 h-9"
                        onclick={() => (pendingAction = "submit")}
                        disabled={isPrimaryActionSubmitting}
                    >
                        <Send class="mr-1.5 h-3.5 w-3.5" />
                        {isPrimaryActionSubmitting ? "提交中..." : "提交審核"}
                    </Button>
                </form>
            {/if}

            {#if claim.status === "returned" && claim.applicant_id === currentUser.id}
                <form
                    action="?/cancel"
                    method="POST"
                    use:enhance={() =>
                        enhanceAction({
                            successMessage: "申請已撤銷",
                        })}
                >
                    <Button
                        variant="outline"
                        type="submit"
                        class="rounded-lg font-bold h-9 px-4 border-border/50"
                    >
                        <XCircle class="mr-1.5 h-3.5 w-3.5" /> 撤銷申請
                    </Button>
                </form>
            {/if}

            {#if claim.status === "pending_manager" && claim.applicant_id === currentUser.id}
                <form
                    action="?/withdraw"
                    method="POST"
                    data-testid="claim-withdraw-form"
                    use:enhance={() =>
                        enhanceAction({
                            successMessage: "已撤回為草稿",
                        })}
                    onsubmit={(event) =>
                        requestConfirmSubmit(event, {
                            title: "確認撤回草稿",
                            message:
                                "確定要撤回此申請嗎？撤回後將變為草稿狀態。",
                            confirmLabel: "撤回草稿",
                        })}
                >
                    <Button
                        variant="outline"
                        type="submit"
                        data-testid="claim-withdraw-button"
                        class="rounded-lg font-bold h-9 px-4 border-border/50"
                    >
                        <Undo2 class="mr-1.5 h-3.5 w-3.5" /> 撤回草稿
                    </Button>
                </form>
            {/if}

            <!-- Approver/Finance Actions -->
            {#if (claim.status === "pending_manager" && currentUser.isApprover) || (claim.status === "pending_finance" && currentUser.isFinance) || (claim.status === "pending_doc_review" && currentUser.isFinance)}
                <Button
                    variant="outline"
                    class="rounded-lg border-destructive/20 text-destructive hover:bg-destructive/5 font-bold h-9 px-4"
                    onclick={() => {
                        subStatus = "reject";
                        isRejectModalOpen = true;
                    }}
                >
                    <XCircle class="mr-1.5 h-3.5 w-3.5" /> 駁回
                </Button>
                <form
                    action="?/approve"
                    method="POST"
                    use:enhance={() => {
                        isPrimaryActionSubmitting = true;
                        return enhanceAction({
                            successMessage: "核准成功",
                            onFinally: () => {
                                isPrimaryActionSubmitting = false;
                            },
                        });
                    }}
                >
                    <Button
                        type="submit"
                        class="rounded-lg bg-primary hover:bg-primary/90 shadow-md shadow-primary/10 font-bold px-8 h-9"
                        onclick={() => (pendingAction = "approve")}
                        disabled={isPrimaryActionSubmitting}
                    >
                        <CheckCircle2 class="mr-1.5 h-3.5 w-3.5" />
                        {isPrimaryActionSubmitting ? "處理中..." : "核准"}
                    </Button>
                </form>
            {/if}
        </div>
    </div>

    <!-- Header Section -->
    <div
        class="bg-background border border-border/50 p-10 rounded-3xl shadow-sm"
    >
        <div
            class="flex flex-col lg:flex-row lg:items-center justify-between gap-8"
        >
            <div class="space-y-6">
                <div class="flex items-center gap-4">
                    <div
                        class="h-12 w-12 rounded-xl bg-primary shadow-lg shadow-primary/20 flex items-center justify-center text-primary-foreground"
                    >
                        <ReceiptText class="h-6 w-6" />
                    </div>
                    <div>
                        <div class="flex flex-wrap items-center gap-3 mb-1">
                            <h1
                                class="text-3xl font-bold tracking-tight text-foreground"
                            >
                                請款單
                                <span
                                    class="text-muted-foreground font-medium opacity-30 select-all"
                                    >#{claim.id}</span
                                >
                            </h1>
                            <Badge
                                variant="outline"
                                class={cn(
                                    "rounded-full px-3 py-0.5 text-[10px] font-bold border-none",
                                    getStatusBadge(claim.status).color,
                                )}
                            >
                                {getStatusBadge(claim.status).label}
                            </Badge>
                        </div>
                        <p
                            class="text-muted-foreground text-sm font-medium flex items-center gap-2"
                        >
                            {new Date(claim.created_at).toLocaleDateString(
                                "zh-TW",
                                {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                },
                            )} 建立
                            <span class="w-1 h-1 rounded-full bg-border"></span>
                            申請人:
                            <span class="text-foreground/80"
                                >{claim.applicant?.full_name || "..."}</span
                            >
                        </p>
                    </div>
                </div>
            </div>
            <div
                class="lg:text-right bg-secondary/30 p-6 rounded-2xl border border-secondary/50 min-w-[240px]"
            >
                <p
                    class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5"
                >
                    請款總額
                </p>
                <div
                    class="text-4xl font-bold text-foreground tracking-tighter"
                >
                    {formatAmount(claim.total_amount)}
                </div>
            </div>
        </div>
    </div>

    <div class="grid gap-10 lg:grid-cols-3">
        <div class="lg:col-span-2 space-y-10">
            <!-- Details -->
            <div class="space-y-4">
                <h3
                    class="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2"
                >
                    基本資訊
                </h3>
                <Card.Root
                    class="border border-border/50 shadow-sm bg-background rounded-3xl overflow-hidden"
                >
                    <Card.Content class="p-0">
                        <div class="divide-y divide-border/20">
                            <div
                                class="grid grid-cols-2 p-6 hover:bg-secondary/10 transition-colors"
                            >
                                <Label
                                    class="text-xs font-bold text-muted-foreground uppercase tracking-widest self-center"
                                    >申請類別</Label
                                >
                                <div
                                    class="text-sm font-bold text-foreground text-right"
                                >
                                    {#if claim.claim_type === "employee"}員工報銷
                                    {:else if claim.claim_type === "vendor"}廠商請款
                                    {:else}個人勞務{/if}
                                </div>
                            </div>
                            <div
                                class="grid grid-cols-2 p-6 hover:bg-secondary/10 transition-colors"
                            >
                                <Label
                                    class="text-xs font-bold text-muted-foreground uppercase tracking-widest self-center"
                                    >受款對象</Label
                                >
                                <div
                                    class="text-sm font-bold text-foreground text-right"
                                >
                                    {claim.payee?.name ||
                                        claim.applicant?.full_name ||
                                        "本人"}
                                </div>
                            </div>
                        </div>
                    </Card.Content>
                </Card.Root>
            </div>

            <!-- Line Items -->
            <div class="space-y-4">
                <h3
                    class="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2"
                >
                    費用明細
                </h3>
                <Card.Root
                    class="border border-border/50 shadow-sm bg-background rounded-3xl overflow-hidden"
                >
                    <Card.Content class="p-0">
                        <Table.Root>
                            <Table.Header class="bg-secondary/30">
                                <Table.Row
                                    class="hover:bg-transparent border-none h-12"
                                >
                                    <Table.Head
                                        class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-8 w-12"
                                        >#</Table.Head
                                    >
                                    <Table.Head
                                        class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-24"
                                        >日期</Table.Head
                                    >
                                    <Table.Head
                                        class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-32"
                                        >類別</Table.Head
                                    >
                                    <Table.Head
                                        class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest"
                                        >項目</Table.Head
                                    >
                                    <Table.Head
                                        class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right pr-8"
                                        >金額</Table.Head
                                    >
                                    <Table.Head
                                        class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center w-20"
                                        >憑證</Table.Head
                                    >
                                </Table.Row>
                            </Table.Header>
                            <Table.Body class="divide-y divide-border/10">
                                {#each items as item, i}
                                    <Table.Row
                                        class="group border-none hover:bg-secondary/40 transition-colors h-16"
                                    >
                                        <Table.Cell
                                            class="pl-8 text-muted-foreground font-medium text-xs"
                                            >{i + 1}</Table.Cell
                                        >
                                        <Table.Cell
                                            class="font-bold text-foreground/80 text-xs"
                                        >
                                            {new Date(
                                                item.date_start,
                                            ).toLocaleDateString("zh-TW", {
                                                month: "2-digit",
                                                day: "2-digit",
                                            })}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Badge
                                                variant="secondary"
                                                class="rounded-md font-bold text-[10px] px-2 py-0"
                                            >
                                                {item.category}
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <div
                                                class="font-bold text-foreground text-[13px]"
                                            >
                                                {item.description}
                                            </div>
                                            {#if item.invoice_number}
                                                <div
                                                    class="text-[10px] text-muted-foreground font-medium mt-0.5 opacity-60"
                                                >
                                                    發票: {item.invoice_number}
                                                </div>
                                            {/if}
                                        </Table.Cell>
                                        <Table.Cell
                                            class="text-right pr-8 font-bold text-foreground text-[14px]"
                                        >
                                            {formatAmount(item.amount).replace(
                                                "$",
                                                "",
                                            )}
                                        </Table.Cell>
                                        <Table.Cell class="text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                class="rounded-lg h-10 w-10 p-0 hover:bg-background transition-all border border-transparent hover:border-border/40"
                                                onclick={() =>
                                                    openAttachmentDrawer(item)}
                                            >
                                                {#if item.attachment_status === "uploaded"}
                                                    <Paperclip
                                                        class="h-4 w-4 text-primary"
                                                    />
                                                {:else if item.attachment_status === "exempt"}
                                                    <span
                                                        class="text-[10px] font-bold text-muted-foreground/30"
                                                        >N/A</span
                                                    >
                                                {:else}
                                                    <Upload
                                                        class="h-4 w-4 text-muted-foreground/40"
                                                    />
                                                {/if}
                                            </Button>
                                        </Table.Cell>
                                    </Table.Row>
                                {/each}
                            </Table.Body>
                        </Table.Root>
                    </Card.Content>
                </Card.Root>
            </div>
        </div>

        <div class="space-y-10">
            <!-- Special Flags -->
            {#if claim.pay_first_patch_doc}
                <div
                    class="bg-primary/5 border border-primary/10 p-6 rounded-3xl space-y-3"
                >
                    <div class="flex items-center gap-2 text-primary">
                        <AlertCircle class="h-4 w-4" />
                        <span class="text-xs font-bold uppercase tracking-wider"
                            >特殊處理</span
                        >
                    </div>
                    <p
                        class="text-sm font-medium text-foreground/70 leading-relaxed"
                    >
                        此申請已標記為「先付款後補憑證」。請儘速補齊相關憑證件以利銷帳。
                    </p>
                </div>
            {/if}

            <!-- Payment Info -->
            {#if claim.payment_id}
                <div class="space-y-4">
                    <h3
                        class="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2"
                    >
                        付款資訊
                    </h3>
                    <Card.Root
                        class="border-none shadow-lg bg-primary text-primary-foreground rounded-3xl overflow-hidden p-8"
                    >
                        <div class="space-y-6">
                            <div
                                class="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center"
                            >
                                <CheckCircle2 class="h-5 w-5" />
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <p
                                        class="text-[10px] font-bold opacity-60 uppercase mb-1"
                                    >
                                        付款日期
                                    </p>
                                    <p class="text-lg font-bold">
                                        {new Date(
                                            claim.paid_at,
                                        ).toLocaleDateString("zh-TW", {
                                            month: "2-digit",
                                            day: "2-digit",
                                        })}
                                    </p>
                                </div>
                                <div>
                                    <p
                                        class="text-[10px] font-bold opacity-60 uppercase mb-1"
                                    >
                                        付款單號
                                    </p>
                                    <a
                                        href="/payments/{claim.payment_id}"
                                        class="inline-flex items-center gap-1.5 hover:underline decoration-white/30"
                                    >
                                        <span class="text-sm font-bold"
                                            >#{claim.payment_id.split(
                                                "-",
                                            )[0]}</span
                                        >
                                        <ArrowRight class="h-3 w-3" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </Card.Root>
                </div>
            {/if}

            <!-- Audit History -->
            <div class="space-y-4">
                <h3
                    class="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2"
                >
                    審核歷程
                </h3>
                <Card.Root
                    class="border border-border/50 shadow-sm bg-background rounded-3xl overflow-hidden"
                >
                    <Card.Content class="p-8">
                        <AuditTimeline {history} />
                    </Card.Content>
                </Card.Root>
            </div>
        </div>
    </div>

    <!-- Modals & Drawers remain mostly same for logic but updated for visuals -->
    <Dialog.Root bind:open={isRejectModalOpen}>
        <Dialog.Content
            class="rounded-3xl border-none shadow-2xl p-8 bg-background max-w-md"
        >
            <Dialog.Header class="space-y-3">
                <Dialog.Title class="text-xl font-bold text-foreground"
                    >駁回此申請</Dialog.Title
                >
                <Dialog.Description
                    class="text-sm font-medium text-muted-foreground leading-relaxed"
                >
                    請提供具體的駁回原因，這將發送通知給申請人。
                </Dialog.Description>
            </Dialog.Header>
            <form
                action="?/reject"
                method="POST"
                use:enhance={() =>
                    enhanceAction({
                        successMessage: "已駁回申請",
                        onSuccess: () => {
                            isRejectModalOpen = false;
                            comment = "";
                        },
                    })}
                class="space-y-6 py-4"
            >
                <div class="space-y-2">
                    <Label
                        class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest"
                        >駁回原因</Label
                    >
                    <Textarea
                        id="comment"
                        name="comment"
                        placeholder="請輸入詳情..."
                        bind:value={comment}
                        required
                        class="min-h-[120px] rounded-xl bg-secondary/30 border-border/50 focus:ring-destructive/20 text-sm font-medium"
                    />
                </div>
                <div class="flex flex-col gap-3">
                    <Button
                        type="submit"
                        class="w-full rounded-xl bg-destructive hover:bg-destructive/90 font-bold h-12"
                        disabled={!comment.trim()}
                    >
                        確認駁回
                    </Button>
                    <Button
                        variant="ghost"
                        class="w-full rounded-xl font-bold h-10 text-muted-foreground"
                        onclick={() => (isRejectModalOpen = false)}
                    >
                        取消操作
                    </Button>
                </div>
            </form>
        </Dialog.Content>
    </Dialog.Root>

    <!-- Attachment Sidebox -->
    <Sheet.Root bind:open={isDrawerOpen}>
        <Sheet.Content
            class="w-full sm:max-w-md border-none shadow-2xl rounded-l-3xl p-10 bg-background/95 backdrop-blur-xl"
        >
            <Sheet.Header class="mb-10">
                <Sheet.Title class="text-2xl font-bold text-foreground"
                    >憑證文件</Sheet.Title
                >
                <Sheet.Description class="font-bold text-primary text-xs">
                    項目: {selectedItem?.description}
                </Sheet.Description>
            </Sheet.Header>

            <div class="space-y-8">
                {#if selectedItem?.attachment_status === "uploaded" && selectedItem?.extra?.file_path}
                    <div
                        class="relative group aspect-square rounded-3xl overflow-hidden bg-secondary/30 border border-border/20 flex flex-col items-center justify-center p-12"
                    >
                        <div
                            class="h-20 w-20 rounded-2xl bg-background shadow-sm flex items-center justify-center mb-6"
                        >
                            <FileText class="h-10 w-10 text-primary/40" />
                        </div>
                        <p
                            class="text-xs font-bold text-muted-foreground text-center line-clamp-2 px-4"
                        >
                            {selectedItem.extra.original_name}
                        </p>
                    </div>

                    <div class="grid grid-cols-1 gap-3">
                        <Button
                            variant="secondary"
                            class="rounded-xl font-bold h-12 bg-secondary hover:bg-secondary/80 flex items-center gap-2"
                            href={`/api/claims/attachment/${selectedItem.id}`}
                            target="_blank"
                        >
                            <Eye class="h-4 w-4" /> 檢視原文檔案
                        </Button>

                        {#if claim.status === "draft" || claim.status === "pending_doc_review" || (claim.status === "paid_pending_doc" && claim.applicant_id === currentUser.id)}
                            <form
                                action="?/delete_attachment"
                                method="POST"
                                use:enhance={() =>
                                    enhanceAction({
                                        successMessage: "附件已刪除",
                                    })}
                                class="w-full"
                                onsubmit={(event) =>
                                    requestConfirmSubmit(event, {
                                        title: "確認移除附件",
                                        message: "確定要永久移除此附件嗎？",
                                        confirmLabel: "永久移除",
                                        confirmVariant: "destructive",
                                    })}
                            >
                                <input
                                    type="hidden"
                                    name="item_id"
                                    value={selectedItem.id}
                                />
                                <input
                                    type="hidden"
                                    name="file_path"
                                    value={selectedItem.extra.file_path}
                                />
                                <Button
                                    variant="ghost"
                                    type="submit"
                                    class="w-full rounded-xl font-bold h-12 text-destructive hover:bg-destructive/5"
                                >
                                    <Trash2 class="mr-2 h-4 w-4" /> 永久移除附件
                                </Button>
                            </form>
                        {/if}
                    </div>
                {:else if claim.status === "draft" || claim.status === "pending_doc_review" || claim.status === "paid_pending_doc"}
                    <div
                        class="border-2 border-dashed border-border/60 rounded-3xl p-12 text-center group hover:border-primary/40 transition-all bg-secondary/10"
                    >
                        <form
                            action="?/upload"
                            method="POST"
                            enctype="multipart/form-data"
                            use:enhance={() => {
                                isUploading = true;
                                return enhanceAction({
                                    successMessage: "附件上傳成功",
                                    onFinally: () => {
                                        isUploading = false;
                                    },
                                });
                            }}
                            class="space-y-8"
                        >
                            <input
                                type="hidden"
                                name="item_id"
                                value={selectedItem?.id}
                            />
                            <div class="space-y-4">
                                <div
                                    class="h-16 w-16 rounded-2xl bg-background shadow-sm flex items-center justify-center mx-auto text-primary group-hover:scale-105 transition-transform"
                                >
                                    <Upload class="h-8 w-8" />
                                </div>
                                <div>
                                    <h3
                                        class="text-base font-bold text-foreground"
                                    >
                                        上傳電子憑證
                                    </h3>
                                    <p
                                        class="text-[10px] text-muted-foreground font-bold mt-1 uppercase tracking-widest opacity-60"
                                    >
                                        Support PDF, PNG, JPG (MAX 10MB)
                                    </p>
                                </div>
                            </div>

                            <Input
                                id="file-upload"
                                name="file"
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onchange={handleAttachmentSelected}
                                required
                                class="cursor-pointer file:hidden bg-transparent border-none text-center text-[11px] font-bold text-muted-foreground"
                            />

                            <Button
                                type="submit"
                                class="w-full rounded-2xl h-14 font-bold text-lg shadow-lg shadow-primary/10"
                                disabled={isUploading}
                            >
                                {isUploading ? "正在上傳..." : "確認上傳"}
                            </Button>
                        </form>
                    </div>
                {:else}
                    <div
                        class="flex flex-col items-center justify-center py-24 text-muted-foreground/30"
                    >
                        <AlertCircle class="h-16 w-16 mb-4 opacity-10" />
                        <p class="text-sm font-bold">尚無附件資料可供查閱</p>
                    </div>
                {/if}
            </div>
        </Sheet.Content>
    </Sheet.Root>

    <!-- Duplicate Invoice Warning Modal -->
    <Dialog.Root bind:open={isDuplicateModalOpen}>
        <Dialog.Content class="max-w-md rounded-3xl p-8">
            <Dialog.Header class="space-y-4">
                <div
                    class="h-14 w-14 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 mb-2"
                >
                    <AlertCircle class="h-8 w-8" />
                </div>
                <Dialog.Title class="text-2xl font-bold tracking-tight"
                    >檢測到重複發票</Dialog.Title
                >
                <Dialog.Description
                    class="text-muted-foreground font-medium leading-relaxed"
                >
                    系統發現此請款單中的發票號碼已在其他單據中使用。請確認是否為重複報銷。
                </Dialog.Description>
            </Dialog.Header>

            <div class="mt-6 space-y-4">
                {#each duplicates as dupe}
                    <div
                        class="bg-secondary/30 rounded-2xl p-5 border border-border/50"
                    >
                        <div class="flex items-center justify-between mb-3">
                            <span
                                class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
                                >發票號碼</span
                            >
                            <span
                                class="text-xs font-bold text-foreground bg-background px-2 py-0.5 rounded-md border border-border/50"
                                >{dupe.invoice_number}</span
                            >
                        </div>
                        <div class="space-y-3">
                            {#each dupe.duplicate_claims as dc}
                                <div class="flex items-start gap-3">
                                    <div
                                        class="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5"
                                    ></div>
                                    <div class="flex-1 min-w-0">
                                        <div
                                            class="flex items-center justify-between gap-2 mb-0.5"
                                        >
                                            <span
                                                class="text-xs font-bold text-foreground truncate"
                                                >#{dc.claim_id.split("-")[0]} - {dc.description}</span
                                            >
                                            <Badge
                                                variant="outline"
                                                class="h-4 px-1.5 text-[9px] font-bold border-none bg-amber-100 text-amber-700 capitalize"
                                            >
                                                {dc.status.replace("_", " ")}
                                            </Badge>
                                        </div>
                                        <div
                                            class="text-[10px] text-muted-foreground font-medium"
                                        >
                                            申請人: {dc.applicant_name}
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>

            <Dialog.Footer class="mt-8 flex flex-col sm:flex-row gap-3">
                <Button
                    variant="ghost"
                    class="flex-1 rounded-xl h-12 font-bold"
                    onclick={() => (isDuplicateModalOpen = false)}
                >
                    取消
                </Button>
                <form
                    action={pendingAction === "approve"
                        ? "?/approve"
                        : "?/submit"}
                    method="POST"
                    use:enhance={() => {
                        isPrimaryActionSubmitting = true;
                        return enhanceAction({
                            successMessage:
                                pendingAction === "approve"
                                    ? "核准成功"
                                    : "已送出審核",
                            onSuccess: () => {
                                isDuplicateModalOpen = false;
                            },
                            onFinally: () => {
                                isPrimaryActionSubmitting = false;
                            },
                        });
                    }}
                    class="flex-1"
                >
                    <input type="hidden" name="force" value="true" />
                    {#if pendingAction === "approve"}
                        <input type="hidden" name="comment" value={comment} />
                    {/if}
                    <Button
                        type="submit"
                        class="w-full rounded-xl h-12 font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/10"
                        disabled={isPrimaryActionSubmitting}
                    >
                        {isPrimaryActionSubmitting
                            ? "提交中..."
                            : "仍要強制提交"}
                    </Button>
                </form>
            </Dialog.Footer>
        </Dialog.Content>
    </Dialog.Root>

    <Dialog.Root bind:open={isConfirmModalOpen}>
        <Dialog.Content class="max-w-md rounded-2xl" data-testid="claim-confirm-dialog">
            <Dialog.Header>
                <Dialog.Title>{confirmTitle}</Dialog.Title>
                <Dialog.Description>{confirmMessage}</Dialog.Description>
            </Dialog.Header>
            <Dialog.Footer>
                <Button
                    variant="outline"
                    data-testid="claim-confirm-cancel"
                    onclick={cancelConfirmedSubmit}
                    >取消</Button
                >
                <Button
                    variant={confirmButtonVariant}
                    data-testid="claim-confirm-submit"
                    onclick={executeConfirmedSubmit}
                >
                    {confirmButtonLabel}
                </Button>
            </Dialog.Footer>
        </Dialog.Content>
    </Dialog.Root>
</div>

<style>
    /* 這裡不再需要定義背景色，已由 +layout 管理 */
</style>
