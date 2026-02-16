<script lang="ts">
    import { enhance, deserialize, applyAction } from "$app/forms";
    import { goto } from "$app/navigation";
    import { untrack } from "svelte";
    import { toast } from "svelte-sonner";
    import {
        CLAIM_ITEM_CATEGORIES,
        CLAIM_TYPE_OPTIONS,
        getClaimStatusLabel,
    } from "$lib/claims/constants";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import * as Card from "$lib/components/ui/card";
    import * as Select from "$lib/components/ui/select";
    import * as Sheet from "$lib/components/ui/sheet";
    import BankCodeCombobox from "$lib/components/layout/BankCodeCombobox.svelte";
    import AuditTimeline from "$lib/components/shared/AuditTimeline.svelte";
    import {
        ArrowLeft,
        ReceiptText,
        Save,
        Send,
        Plus,
        Trash2,
        Paperclip,
        Eye,
        Upload,
        ClipboardList,
    } from "lucide-svelte";

    export interface ClaimEditorClaim {
        id?: string;
        claim_type: string;
        status?: string;
        payee_id?: string | null;
        payee_name?: string | null;
        bank_code?: string | null;
        bank_branch?: string | null;
        bank_account?: string | null;
        account_name?: string | null;
        created_at?: string | null;
        applicant_name?: string | null;
        total_amount?: number | null;
        items: any;
    }

    export interface ClaimEditorPayee {
        id: string;
        name: string;
        type: string;
    }

    const statusColorMap: Record<string, string> = {
        draft: "bg-slate-100 text-slate-700",
        pending_manager: "bg-amber-100 text-amber-700",
        pending_finance: "bg-blue-100 text-blue-700",
        pending_payment: "bg-indigo-100 text-indigo-700",
        paid: "bg-emerald-100 text-emerald-700",
        paid_pending_doc: "bg-orange-100 text-orange-700",
        pending_doc_review: "bg-orange-100 text-orange-700",
        returned: "bg-rose-100 text-rose-700",
        cancelled: "bg-slate-100 text-slate-600",
    };

    let {
        claim,
        payees = [],
        backHref = "/claims",
        backLabel = "返回清單",
        mode = "edit",
        isCreate = false,
        formAction = "",
        formEnctype,
        submitAction = "",
        showSaveButton = true,
        showSubmitButton = true,
        directSubmitInSameForm = false,
        requireApproverOnDirectSubmit = false,
        hasApprover = true,
        timelineTitle = "審核歷程",
        history = [],
        deleteAction,
    }: {
        claim: ClaimEditorClaim;
        payees?: ClaimEditorPayee[];
        backHref?: string;
        backLabel?: string;
        mode?: "edit" | "view";
        isCreate?: boolean;
        formAction?: string;
        formEnctype?:
            | "multipart/form-data"
            | "application/x-www-form-urlencoded"
            | "text/plain";
        submitAction?: string;
        showSaveButton?: boolean;
        showSubmitButton?: boolean;
        directSubmitInSameForm?: boolean;
        requireApproverOnDirectSubmit?: boolean;
        hasApprover?: boolean;
        timelineTitle?: string;
        history?: any[];
        deleteAction?: string; // New prop for delete action URL
    } = $props();

    function emptyItem() {
        return {
            date: new Date().toISOString().split("T")[0],
            category: "general",
            description: "",
            amount: "",
            invoice_number: "",
            attachment_status: "pending_supplement",
            exempt_reason: "",
            extra: {},
        };
    }

    function normalizeItemForEditor(item: any) {
        return {
            id: item?.id || null,
            date: String(
                item?.date ||
                    item?.date_start ||
                    new Date().toISOString().split("T")[0],
            ),
            category: String(item?.category || "general"),
            description: String(item?.description || ""),
            amount:
                item?.amount === null || item?.amount === undefined
                    ? ""
                    : String(item.amount),
            invoice_number: String(item?.invoice_number || ""),
            attachment_status: String(
                item?.attachment_status || "pending_supplement",
            ),
            exempt_reason: String(
                item?.exempt_reason || item?.extra?.exempt_reason || "",
            ),
            extra: item?.extra || {},
        };
    }

    let claimType = $state(untrack(() => claim.claim_type || "employee"));
    let payeeId = $state(untrack(() => claim.payee_id || ""));
    let items = $state<any[]>(
        untrack(() => {
            const parsed = Array.isArray(claim.items)
                ? claim.items
                : JSON.parse(claim.items || "[]");
            if (parsed.length === 0) return [emptyItem()];
            return parsed.map(normalizeItemForEditor);
        }),
    );
    let isFloatingAccount = $state(untrack(() => !!claim.bank_code));
    let bankCode = $state(untrack(() => claim.bank_code || ""));
    let bankBranch = $state(untrack(() => claim.bank_branch || ""));
    let bankAccount = $state(untrack(() => claim.bank_account || ""));
    let accountName = $state(untrack(() => claim.account_name || ""));
    let pendingUpload = $state<Record<number, File | null>>({});
    let isSubmitting = $state(false);
    let auditDrawerOpen = $state(false);

    $effect(() => {
        claimType = claim.claim_type || "employee";
        payeeId = claim.payee_id || "";
        const newItems = Array.isArray(claim.items)
            ? claim.items
            : JSON.parse(claim.items || "[]");
        items =
            newItems.length === 0
                ? [emptyItem()]
                : newItems.map(normalizeItemForEditor);
        isFloatingAccount = !!claim.bank_code;
        bankCode = claim.bank_code || "";
        bankBranch = claim.bank_branch || "";
        bankAccount = claim.bank_account || "";
        accountName = claim.account_name || "";
    });

    const isEditable = $derived(mode === "edit");
    const canEditClaimType = $derived(isEditable && isCreate);
    const vendorPayees = $derived(payees.filter((p) => p.type === "vendor"));
    const personalPayees = $derived(
        payees.filter((p) => p.type === "personal"),
    );
    const selectedPayeeName = $derived(
        payees.find((p) => p.id === payeeId)?.name ||
            claim.payee_name ||
            claim.applicant_name ||
            "本人",
    );
    const totalAmount = $derived(
        items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    );
    const displayStatus = $derived(getClaimStatusLabel(claim.status));
    const displayStatusClass = $derived(
        statusColorMap[claim.status || "draft"] ||
            "bg-slate-100 text-slate-700",
    );

    function submitButtonText() {
        return isCreate ? "直接提交" : "提交審核";
    }

    function voucherStatusLabel(status: string) {
        if (status === "uploaded") return "上傳憑證";
        if (status === "exempt") return "無憑證";
        return "待補件";
    }

    function addItem() {
        if (!isEditable) return;
        items = [...items, emptyItem()];
    }

    function removeItem(index: number) {
        if (!isEditable) return;
        if (items.length <= 1) return;
        items = items.filter((_, i) => i !== index);
    }

    function validateBeforeDirectSubmit() {
        for (let i = 0; i < items.length; i += 1) {
            const item = items[i];
            const status = String(
                item?.attachment_status || "pending_supplement",
            ).trim();
            if (
                status === "exempt" &&
                !String(item?.exempt_reason || "").trim()
            ) {
                toast.error(`第 ${i + 1} 筆明細選擇無憑證時必須填寫理由`);
                return false;
            }
            if (status === "uploaded" && !item?.id && !pendingUpload[i]) {
                toast.error(`第 ${i + 1} 筆明細選擇上傳憑證，請先選擇附件`);
                return false;
            }
        }
        if (requireApproverOnDirectSubmit && !hasApprover) {
            toast.error("尚未設定核准人，無法直接提交。請先聯繫管理員設定。");
            return false;
        }
        return true;
    }

    function onSubmitCapture(event: SubmitEvent) {
        const submitter = event.submitter as
            | HTMLButtonElement
            | HTMLInputElement
            | null;
        const value = submitter?.value;
        if (value !== "submit") return;
        if (!validateBeforeDirectSubmit()) {
            event.preventDefault();
        }
    }

    async function submitForReview() {
        if (!submitAction || isSubmitting) return;
        if (!validateBeforeDirectSubmit()) return;
        isSubmitting = true;
        try {
            const fd = new FormData();
            fd.append("payee_id", payeeId);
            if (isFloatingAccount) {
                fd.append("is_floating", "on");
                fd.append("bank_code", bankCode);
                fd.append("bank_branch", bankBranch);
                fd.append("bank_account", bankAccount);
                fd.append("account_name", accountName);
            }
            fd.append("items", JSON.stringify(items));

            const response = await fetch(submitAction, {
                method: "POST",
                body: fd,
                headers: { "x-sveltekit-action": "true" },
            });
            const result = deserialize(await response.text()) as any;
            if (result?.type === "failure") {
                toast.error(result?.data?.message || "提交失敗");
                return;
            }
            if (result?.type === "redirect" && result.location) {
                await goto(result.location);
                return;
            }
            toast.success("已送出審核");
            await goto(`/claims/${claim.id}`, { invalidateAll: true });
        } finally {
            isSubmitting = false;
        }
    }

    async function submitAttachmentUpload(index: number) {
        const item = items[index];
        const file = pendingUpload[index];
        if (!item?.id || !file) return;

        const fd = new FormData();
        fd.append("item_id", item.id);
        fd.append("file", file);

        const response = await fetch(`/claims/${claim.id}?/upload`, {
            method: "POST",
            body: fd,
            headers: { "x-sveltekit-action": "true" },
        });
        const result = deserialize(await response.text()) as any;
        if (result?.type === "failure") {
            toast.error(result?.data?.message || "附件上傳失敗");
            return;
        }
        toast.success("附件上傳成功");
        await goto(`/claims/${claim.id}`, { invalidateAll: true });
    }

    async function removeAttachment(itemId: string) {
        const fd = new FormData();
        fd.append("item_id", itemId);

        const response = await fetch(`/claims/${claim.id}?/delete_attachment`, {
            method: "POST",
            body: fd,
            headers: { "x-sveltekit-action": "true" },
        });
        const result = deserialize(await response.text()) as any;
        if (result?.type === "failure") {
            toast.error(result?.data?.message || "附件刪除失敗");
            return;
        }
        toast.success("附件已刪除");
        await goto(`/claims/${claim.id}`, { invalidateAll: true });
    }
</script>

<div class="space-y-5 pb-20">
    <div class="flex items-center justify-between gap-4">
        <Button
            variant="ghost"
            href={backHref}
            class="h-8 px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
            <ArrowLeft class="mr-1.5 h-3.5 w-3.5" />
            {backLabel}
        </Button>

        <div class="flex items-center gap-2">
            <slot name="header-actions" />
            {#if isEditable && (showSaveButton || showSubmitButton)}
                {#if isEditable && !isCreate && deleteAction}
                    <Button
                        type="submit"
                        form="claim-delete-form"
                        variant="ghost"
                        size="sm"
                        class="text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={isSubmitting}
                        onclick={(e) => {
                            if (
                                !confirm("確定要刪除此草稿嗎？此動作無法復原。")
                            ) {
                                e.preventDefault();
                            }
                        }}
                    >
                        <Trash2 class="mr-1.5 h-3.5 w-3.5" />
                        刪除草稿
                    </Button>
                {/if}
                {#if showSaveButton}
                    <Button
                        type="submit"
                        form="claim-editor-form"
                        variant="outline"
                        size="sm"
                        formnovalidate
                        disabled={isSubmitting}
                    >
                        <Save class="mr-1.5 h-3.5 w-3.5" />
                        {isCreate ? "儲存草稿" : "儲存變更"}
                    </Button>
                {/if}
                {#if showSubmitButton}
                    {#if directSubmitInSameForm}
                        <Button
                            type="submit"
                            form="claim-editor-form"
                            name="submit_intent"
                            value="submit"
                            size="sm"
                            disabled={isSubmitting}
                        >
                            <Send class="mr-1.5 h-3.5 w-3.5" />
                            {submitButtonText()}
                        </Button>
                    {:else}
                        <Button
                            type="button"
                            size="sm"
                            disabled={isSubmitting}
                            onclick={submitForReview}
                        >
                            <Send class="mr-1.5 h-3.5 w-3.5" />
                            {submitButtonText()}
                        </Button>
                    {/if}
                {/if}
            {/if}
        </div>
    </div>

    <form
        id="claim-delete-form"
        method="POST"
        action={deleteAction}
        use:enhance={() => {
            isSubmitting = true;
            return async ({ result, update }) => {
                isSubmitting = false;
                if (result.type === "redirect") {
                    goto(result.location);
                    return;
                }
                if (result.type === "failure") {
                    toast.error((result.data?.message as string) || "刪除失敗");
                }
                await update();
            };
        }}
    ></form>

    <form
        id="claim-editor-form"
        method="POST"
        action={formAction}
        enctype={formEnctype || undefined}
        onsubmitcapture={onSubmitCapture}
        use:enhance={() => {
            isSubmitting = true;
            return async ({ result }) => {
                isSubmitting = false;
                if (result.type === "failure") {
                    toast.error((result.data?.message as string) || "操作失敗");
                }
                await applyAction(result);
            };
        }}
    >
        <input type="hidden" name="claim_type" value={claimType} />
        <input type="hidden" name="items" value={JSON.stringify(items)} />
        <input type="hidden" name="payee_id" value={payeeId} />
        <input
            type="hidden"
            name="is_floating_account"
            value={isFloatingAccount ? "true" : "false"}
        />
        <input type="hidden" name="total_amount" value={totalAmount} />

        <div class="space-y-5">
            <!-- Header + Basic Info (single container) -->
            <Card.Root
                class="overflow-hidden rounded-xl border border-border/40 bg-background"
            >
                <div class="px-6 py-4">
                    <div class="flex items-center justify-between gap-4">
                        <div class="flex items-center gap-4">
                            <div
                                class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"
                            >
                                <ReceiptText class="h-5 w-5" />
                            </div>
                            <div class="space-y-0.5">
                                <div class="flex items-center gap-2.5">
                                    <h1
                                        class="text-lg font-semibold leading-tight"
                                    >
                                        請款單
                                        <span
                                            class="ml-1 text-muted-foreground/40"
                                            >#{claim.id
                                                ? claim.id.slice(0, 8)
                                                : "NEW"}</span
                                        >
                                    </h1>
                                    <span
                                        class={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${displayStatusClass}`}
                                    >
                                        {displayStatus}
                                    </span>
                                </div>
                                <p class="text-sm text-muted-foreground">
                                    {claim.created_at
                                        ? `${new Date(claim.created_at).toLocaleDateString("zh-TW")} 建立`
                                        : "建立新請款單"}
                                    <span class="mx-1.5 text-border">·</span>
                                    申請人: {claim.applicant_name || "本人"}
                                </p>
                            </div>
                        </div>

                        <div class="flex items-center gap-4">
                            <div class="text-right">
                                <p
                                    class="text-xs font-medium text-muted-foreground"
                                >
                                    請款總額
                                </p>
                                <p
                                    class="text-2xl font-bold tabular-nums tracking-tight"
                                >
                                    NT${new Intl.NumberFormat("en-US", {
                                        maximumFractionDigits: 0,
                                    }).format(totalAmount)}
                                </p>
                            </div>
                            <button
                                type="button"
                                class="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border/40 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                                onclick={() => (auditDrawerOpen = true)}
                                title="審核歷程"
                            >
                                <ClipboardList class="h-4 w-4" />
                                {#if history.length > 0}
                                    <span
                                        class="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
                                        >{history.length}</span
                                    >
                                {/if}
                            </button>
                        </div>
                    </div>
                </div>

                <div class="border-t border-border/30">
                    <div class="px-6 py-3">
                        <h2
                            class="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                            基本資訊
                        </h2>
                    </div>
                    <div class="divide-y divide-border/30">
                        <div
                            class="flex items-center justify-between gap-4 px-5 py-4"
                        >
                            <Label
                                class="text-sm font-medium text-muted-foreground"
                                >申請類別</Label
                            >
                            <div>
                                <div
                                    class={`inline-flex rounded-lg border border-border/50 bg-muted/30 p-0.5 ${
                                        !canEditClaimType ? "opacity-60" : ""
                                    }`}
                                >
                                    {#each CLAIM_TYPE_OPTIONS as option}
                                        <button
                                            type="button"
                                            disabled={!canEditClaimType}
                                            class={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                                                claimType === option.value
                                                    ? "bg-background text-foreground shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground"
                                            }`}
                                            onclick={() =>
                                                (claimType = option.value)}
                                        >
                                            {option.label}
                                        </button>
                                    {/each}
                                </div>
                            </div>
                        </div>

                        <div
                            class="flex items-center justify-between gap-4 px-5 py-4"
                        >
                            <Label
                                class="text-sm font-medium text-muted-foreground"
                                >收款對象</Label
                            >
                            <div>
                                {#if claimType === "employee"}
                                    <Input
                                        value={claim.applicant_name || "本人"}
                                        disabled={true}
                                        class="w-[220px] text-right text-sm font-medium"
                                    />
                                {:else}
                                    <Select.Root
                                        type="single"
                                        bind:value={payeeId}
                                        disabled={!isEditable}
                                        onValueChange={() => {
                                            if (!isEditable) return;
                                            isFloatingAccount = false;
                                            bankCode = "";
                                            bankBranch = "";
                                            bankAccount = "";
                                            accountName = "";
                                        }}
                                    >
                                        <Select.Trigger
                                            class="w-[220px] text-left text-sm"
                                        >
                                            {selectedPayeeName || "選擇收款人"}
                                        </Select.Trigger>
                                        <Select.Content>
                                            {#if claimType === "vendor"}
                                                {#each vendorPayees as payee}
                                                    <Select.Item
                                                        value={payee.id}
                                                        label={payee.name}
                                                    />
                                                {/each}
                                            {:else}
                                                {#each personalPayees as payee}
                                                    <Select.Item
                                                        value={payee.id}
                                                        label={payee.name}
                                                    />
                                                {/each}
                                            {/if}
                                        </Select.Content>
                                    </Select.Root>
                                {/if}
                            </div>
                        </div>
                    </div>
                </div>
            </Card.Root>

            <!-- Main Content (single column) -->
            <div class="space-y-5">
                <!-- 匯款帳號資訊 -->
                {#if claimType !== "employee" && (isEditable || isFloatingAccount || bankCode || bankAccount || accountName)}
                    <section class="space-y-2">
                        <h2
                            class="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                            匯款帳號資訊
                        </h2>
                        <Card.Root class="rounded-xl border border-border/40">
                            <Card.Content class="space-y-4 p-5">
                                <div class="flex items-center gap-2">
                                    <input
                                        id="is_floating"
                                        type="checkbox"
                                        bind:checked={isFloatingAccount}
                                        disabled={!isEditable}
                                        class="h-4 w-4 rounded border"
                                    />
                                    <Label
                                        for="is_floating"
                                        class="text-sm font-medium"
                                        >指定本次匯款帳號（浮動帳號）</Label
                                    >
                                </div>
                                {#if isFloatingAccount}
                                    <div class="grid gap-4 md:grid-cols-2">
                                        <div class="space-y-1.5">
                                            <Label
                                                for="bank_code"
                                                class="text-xs text-muted-foreground"
                                                >銀行代碼</Label
                                            >
                                            <BankCodeCombobox
                                                id="bank_code"
                                                name="bank_code"
                                                bind:value={bankCode}
                                                disabled={!isEditable}
                                                required
                                            />
                                        </div>
                                        <div class="space-y-1.5">
                                            <Label
                                                for="bank_branch"
                                                class="text-xs text-muted-foreground"
                                                >分行代碼</Label
                                            >
                                            <Input
                                                id="bank_branch"
                                                name="bank_branch"
                                                bind:value={bankBranch}
                                                disabled={!isEditable}
                                                maxlength={4}
                                            />
                                        </div>
                                        <div class="space-y-1.5">
                                            <Label
                                                for="account_name"
                                                class="text-xs text-muted-foreground"
                                                >戶名</Label
                                            >
                                            <Input
                                                id="account_name"
                                                name="account_name"
                                                bind:value={accountName}
                                                disabled={!isEditable}
                                                required
                                            />
                                        </div>
                                        <div class="space-y-1.5">
                                            <Label
                                                for="bank_account"
                                                class="text-xs text-muted-foreground"
                                                >銀行帳號</Label
                                            >
                                            <Input
                                                id="bank_account"
                                                name="bank_account"
                                                bind:value={bankAccount}
                                                disabled={!isEditable}
                                                required
                                            />
                                        </div>
                                    </div>
                                {/if}
                            </Card.Content>
                        </Card.Root>
                    </section>
                {/if}

                <!-- 費用明細 — Table Layout -->
                <section class="space-y-2">
                    <h2
                        class="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                        費用明細
                    </h2>
                    <Card.Root
                        class="overflow-hidden rounded-xl border border-border/40"
                    >
                        <Card.Content class="p-0">
                            <!-- Table Header -->
                            <div
                                class="grid grid-cols-[110px_120px_1fr_90px_110px_110px_120px_36px] items-center gap-2 border-b border-border/30 bg-muted/20 px-4 py-2.5"
                            >
                                <span
                                    class="text-center text-xs font-semibold text-muted-foreground"
                                    >日期</span
                                >
                                <span
                                    class="text-center text-xs font-semibold text-muted-foreground"
                                    >費用類別</span
                                >
                                <span
                                    class="text-center text-xs font-semibold text-muted-foreground"
                                    >費用說明</span
                                >
                                <span
                                    class="text-center text-xs font-semibold text-muted-foreground"
                                    >金額</span
                                >
                                <span
                                    class="text-center text-xs font-semibold text-muted-foreground"
                                    >發票號碼</span
                                >
                                <span
                                    class="text-center text-xs font-semibold text-muted-foreground"
                                    >憑證處理</span
                                >
                                <span
                                    class="text-center text-xs font-semibold text-muted-foreground"
                                    >附件</span
                                >
                                <span></span>
                            </div>

                            <!-- Table Rows -->
                            {#each items as item, i}
                                <div
                                    class="grid grid-cols-[110px_120px_1fr_90px_110px_110px_120px_36px] items-center gap-2 border-b border-border/20 px-4 py-2 transition-colors hover:bg-muted/10"
                                >
                                    <!-- 日期 -->
                                    <Input
                                        type="date"
                                        bind:value={item.date}
                                        disabled={!isEditable}
                                        class="h-8 text-xs"
                                    />
                                    <!-- 類別 -->
                                    <select
                                        class="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                                        bind:value={item.category}
                                        disabled={!isEditable}
                                    >
                                        {#each CLAIM_ITEM_CATEGORIES as cat}
                                            <option value={cat.value}
                                                >{cat.label}</option
                                            >
                                        {/each}
                                    </select>
                                    <!-- 說明 -->
                                    <Input
                                        placeholder="說明"
                                        bind:value={item.description}
                                        disabled={!isEditable}
                                        class="h-8 text-xs"
                                    />
                                    <!-- 金額 -->
                                    <div class="relative">
                                        <span
                                            class="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
                                            >NT$</span
                                        >
                                        <Input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            bind:value={item.amount}
                                            disabled={!isEditable}
                                            class="h-8 pl-8 text-xs"
                                        />
                                    </div>
                                    <!-- 發票號碼 -->
                                    <Input
                                        placeholder="發票號碼"
                                        bind:value={item.invoice_number}
                                        disabled={!isEditable}
                                        class="h-8 text-xs"
                                    />
                                    <!-- 憑證處理 -->
                                    <div
                                        class="flex items-center justify-center"
                                    >
                                        {#if isEditable}
                                            <select
                                                class="h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                                                bind:value={
                                                    item.attachment_status
                                                }
                                            >
                                                <option value="uploaded"
                                                    >上傳憑證</option
                                                >
                                                <option
                                                    value="pending_supplement"
                                                    >待補件</option
                                                >
                                                <option value="exempt"
                                                    >無憑證</option
                                                >
                                            </select>
                                        {:else}
                                            <span
                                                class="text-[11px] text-muted-foreground"
                                            >
                                                {voucherStatusLabel(
                                                    item.attachment_status,
                                                )}
                                            </span>
                                        {/if}
                                    </div>

                                    <!-- 附件 -->
                                    <div
                                        class="flex items-center justify-center"
                                    >
                                        {#if item.attachment_status === "exempt"}
                                            <span
                                                class="text-[11px] text-muted-foreground"
                                                >不需附件</span
                                            >
                                        {:else if item.id}
                                            {#if item.attachment_status === "uploaded" && item.extra?.file_path}
                                                <a
                                                    href={`/api/claims/attachment/${item.id}`}
                                                    target="_blank"
                                                    class="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                                                >
                                                    <Eye class="h-3 w-3" /> 查看
                                                </a>
                                            {:else}
                                                <span
                                                    class="text-[11px] text-muted-foreground"
                                                    >待上傳</span
                                                >
                                            {/if}

                                            {#if isEditable}
                                                <label
                                                    class="ml-2 inline-flex cursor-pointer items-center gap-1 text-[11px] text-primary hover:underline"
                                                >
                                                    <Upload class="h-3 w-3" /> 上傳
                                                    <input
                                                        type="file"
                                                        class="hidden"
                                                        onchange={(event) => {
                                                            const input =
                                                                event.currentTarget as HTMLInputElement;
                                                            const file =
                                                                input
                                                                    .files?.[0];
                                                            if (file) {
                                                                pendingUpload =
                                                                    {
                                                                        ...pendingUpload,
                                                                        [i]: file,
                                                                    };
                                                                submitAttachmentUpload(
                                                                    i,
                                                                );
                                                            }
                                                        }}
                                                    />
                                                </label>
                                            {/if}
                                        {:else if isEditable}
                                            {#if item.attachment_status === "uploaded"}
                                                <label
                                                    class="inline-flex cursor-pointer items-center gap-1 text-[11px] text-primary hover:underline"
                                                >
                                                    <Upload class="h-3 w-3" /> 選擇檔案
                                                    <input
                                                        type="file"
                                                        name={`item_attachment_${i}`}
                                                        class="hidden"
                                                        onchange={(event) => {
                                                            const input =
                                                                event.currentTarget as HTMLInputElement;
                                                            pendingUpload = {
                                                                ...pendingUpload,
                                                                [i]:
                                                                    input
                                                                        .files?.[0] ||
                                                                    null,
                                                            };
                                                        }}
                                                    />
                                                </label>
                                            {:else}
                                                <span
                                                    class="text-[11px] text-muted-foreground"
                                                    >待補件</span
                                                >
                                            {/if}
                                        {:else}
                                            <span
                                                class="text-[11px] text-muted-foreground"
                                                >—</span
                                            >
                                        {/if}
                                    </div>
                                    <!-- 刪除 -->
                                    <div
                                        class="flex items-center justify-center"
                                    >
                                        {#if isEditable}
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                class="h-7 w-7"
                                                onclick={() => removeItem(i)}
                                                disabled={items.length <= 1}
                                            >
                                                <Trash2
                                                    class="h-3.5 w-3.5 text-destructive"
                                                />
                                            </Button>
                                        {/if}
                                    </div>
                                </div>
                            {/each}

                            <!-- Add Item Button -->
                            {#if isEditable}
                                <button
                                    type="button"
                                    class="flex w-full items-center justify-center gap-2 border-t border-border/20 bg-primary/[0.03] py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/[0.06]"
                                    onclick={addItem}
                                >
                                    <Plus class="h-4 w-4" />
                                    新增一筆費用
                                </button>
                            {/if}
                        </Card.Content>
                    </Card.Root>
                </section>
            </div>
        </div>
    </form>

    <!-- Audit History Sheet Drawer -->
    <Sheet.Root bind:open={auditDrawerOpen}>
        <Sheet.Content side="right" class="w-[340px] sm:w-[400px]">
            <Sheet.Header>
                <Sheet.Title>{timelineTitle}</Sheet.Title>
                <Sheet.Description
                    >此請款單的審核紀錄與流程進度</Sheet.Description
                >
            </Sheet.Header>
            <div class="flex-1 overflow-y-auto px-1 py-4">
                {#if history.length > 0}
                    <AuditTimeline {history} />
                {:else}
                    <div
                        class="flex flex-col items-center justify-center py-12 text-center"
                    >
                        <ClipboardList
                            class="mb-3 h-8 w-8 text-muted-foreground/40"
                        />
                        <p class="text-sm text-muted-foreground">
                            建立後顯示流程紀錄
                        </p>
                    </div>
                {/if}
                <slot name="side-panel" />
            </div>
        </Sheet.Content>
    </Sheet.Root>
</div>
