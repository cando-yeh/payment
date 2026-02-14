<script lang="ts">
    /**
     * PayeeRequestSheet.svelte
     *
     * 職責：
     * 1. 顯示「待審核」的收款人異動申請（新增/修改/停用）。
     * 2. 唯讀顯示申請內容。
     * 3. 根據角色（財務/申請人）提供 核准/駁回/撤銷 操作。
     * 4. 顯示遮罩後的銀行帳號（若有proposed_bank_account_tail）。
     */
    import { enhance } from "$app/forms";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import * as Sheet from "$lib/components/ui/sheet";
    import * as Avatar from "$lib/components/ui/avatar";
    import { toast } from "svelte-sonner";
    import {
        Building2,
        User,
        CreditCard,
        Check,
        X,
        Undo2,
        LoaderCircle,
        FileText,
        Eye,
    } from "lucide-svelte";
    import { invalidateAll } from "$app/navigation";

    let {
        request, // The selected request object (from +page.svelte)
        open = $bindable(false),
        isFinance = false,
        currentUserId, // Add currentUserId prop to verify requester
    } = $props();

    // 狀態
    let isActionSubmitting = $state(false);

    // 衍生資料
    let changeType = $derived(request?.payload?.change_type || "unknown");
    let proposedData = $derived(request?.payload?.proposed_data || {});
    let reason = $derived(request?.payload?.reason || "");
    let bankAccountTail = $derived(
        request?.payload?.proposed_bank_account_tail || "",
    );

    // 顯示名稱
    let displayName = $derived(
        changeType === "create"
            ? proposedData.name
            : request?.name.replace(/^\[.*?\] /, ""), // Remove prefix if present
    );

    // 顯示類型
    let displayType = $derived(
        changeType === "create"
            ? proposedData.type
            : request?.type || "unknown",
    );

    /**
     * Common form submission handler for actions (Withdraw, Approve, Reject)
     */
    function handleAction(successMsg: string) {
        return () => {
            isActionSubmitting = true;
            return async ({ result }: { result: any }) => {
                isActionSubmitting = false;
                if (result.type === "success") {
                    toast.success(successMsg);
                    open = false;
                    await invalidateAll();
                } else if (result.type === "failure") {
                    toast.error(result.data?.message || "操作失敗");
                }
            };
        };
    }
</script>

<Sheet.Root bind:open>
    <Sheet.Content class="sm:max-w-md overflow-y-auto">
        <Sheet.Header>
            <Sheet.Title>
                {#if changeType === "create"}
                    審核新增收款人
                {:else if changeType === "update"}
                    審核變更收款人
                {:else if changeType === "disable"}
                    審核停用收款人
                {:else}
                    收款人異動申請
                {/if}
            </Sheet.Title>
            <Sheet.Description>檢視申請內容並執行審核動作。</Sheet.Description>
        </Sheet.Header>

        {#if request}
            <div class="mt-6 space-y-6 pb-24">
                <!-- 基本資訊 Header -->
                <div class="flex items-center gap-4">
                    <Avatar.Root
                        class="h-16 w-16 border-2 border-background shadow-sm"
                    >
                        <Avatar.Fallback
                            class="bg-primary/5 text-xl font-bold text-primary"
                        >
                            {(displayName || "?").charAt(0).toUpperCase()}
                        </Avatar.Fallback>
                    </Avatar.Root>
                    <div>
                        <h3 class="font-semibold text-lg">{displayName}</h3>
                        <div
                            class="flex items-center gap-2 text-sm text-muted-foreground mt-1"
                        >
                            {#if displayType === "vendor"}
                                <Building2 class="h-3.5 w-3.5" />
                                <span>廠商</span>
                            {:else}
                                <User class="h-3.5 w-3.5" />
                                <span>個人戶</span>
                            {/if}
                            <span
                                class="text-xs px-2 py-0.5 rounded-full border bg-muted"
                            >
                                {#if changeType === "create"}新增申請
                                {:else if changeType === "update"}變更申請
                                {:else if changeType === "disable"}停用申請
                                {/if}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- 唯讀表單欄位 -->
                <div class="space-y-6">
                    {#if changeType !== "disable"}
                        <!-- 基本資料 -->
                        <div class="space-y-4">
                            <div class="space-y-2">
                                <Label>收款人名稱</Label>
                                <Input value={displayName} readonly />
                            </div>

                            {#if displayType === "vendor"}
                                <div class="space-y-2">
                                    <Label>統一編號</Label>
                                    <Input
                                        value={proposedData.tax_id || ""}
                                        readonly
                                    />
                                </div>
                                <div class="space-y-2">
                                    <Label>服務項目說明</Label>
                                    <Input
                                        value={proposedData.service_description ||
                                            ""}
                                        readonly
                                    />
                                </div>
                            {:else}
                                <div class="space-y-2">
                                    <Label>身分證字號</Label>
                                    <Input
                                        value={proposedData.tax_id || ""}
                                        readonly
                                    />
                                </div>
                                <div class="space-y-2">
                                    <Label>電子郵件</Label>
                                    <Input
                                        value={proposedData.extra_info?.email ||
                                            ""}
                                        readonly
                                    />
                                </div>
                                <div class="space-y-2">
                                    <Label>通訊地址</Label>
                                    <Input
                                        value={proposedData.extra_info
                                            ?.address || ""}
                                        readonly
                                    />
                                </div>
                            {/if}
                        </div>

                        <!-- 銀行帳號 -->
                        <div class="space-y-4 pt-2 border-t">
                            <div
                                class="flex items-center gap-2 text-sm font-semibold text-primary"
                            >
                                <CreditCard class="h-4 w-4" />
                                匯款帳號資訊
                            </div>
                            <div class="grid gap-4 grid-cols-5">
                                <div class="col-span-2 space-y-2">
                                    <Label>銀行代碼</Label>
                                    <Input
                                        value={proposedData.bank_code || ""}
                                        readonly
                                    />
                                </div>
                                <div class="col-span-3 space-y-2">
                                    <Label>銀行帳號</Label>
                                    <Input
                                        value={bankAccountTail
                                            ? `*****${bankAccountTail}`
                                            : "••••••••••••"}
                                        readonly
                                    />
                                    {#if !isFinance}
                                        <p
                                            class="text-[0.65rem] text-muted-foreground mt-1"
                                        >
                                            唯有財務人員可於核准後查看完整帳號。
                                        </p>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/if}

                    <!-- 變更原因 -->
                    <div class="pt-2 space-y-2 border-t">
                        <Label>變更原因</Label>
                        <Textarea value={reason} readonly class="resize-none" />
                    </div>
                </div>

                <!-- 審核按鈕區 (固定底部) -->
                <div
                    class="absolute bottom-0 left-0 right-0 p-6 bg-background/95 backdrop-blur border-t flex flex-col gap-3"
                >
                    {#if request.payload.requested_by === currentUserId}
                        <!-- 申請人操作：撤銷 -->
                        <form
                            method="POST"
                            action="?/withdrawRequest"
                            use:enhance={handleAction("申請已撤銷")}
                            class="w-full"
                        >
                            <input
                                type="hidden"
                                name="requestId"
                                value={request.id}
                            />
                            <Button
                                type="submit"
                                variant="outline"
                                class="w-full"
                                disabled={isActionSubmitting}
                            >
                                {#if isActionSubmitting}
                                    <LoaderCircle
                                        class="mr-2 h-4 w-4 animate-spin"
                                    />
                                {:else}
                                    <Undo2 class="mr-2 h-4 w-4" />
                                {/if}
                                撤銷申請
                            </Button>
                        </form>
                    {/if}

                    {#if isFinance}
                        <!-- 財務操作：核准/駁回 -->
                        <div class="flex gap-3 w-full">
                            <form
                                method="POST"
                                action="?/rejectPayeeRequest"
                                use:enhance={handleAction("申請已駁回")}
                                class="flex-1"
                            >
                                <input
                                    type="hidden"
                                    name="requestId"
                                    value={request.id}
                                />
                                <Button
                                    type="submit"
                                    variant="destructive"
                                    class="w-full"
                                    disabled={isActionSubmitting}
                                >
                                    {#if isActionSubmitting}
                                        <LoaderCircle
                                            class="mr-2 h-4 w-4 animate-spin"
                                        />
                                    {:else}
                                        <X class="mr-2 h-4 w-4" />
                                    {/if}
                                    駁回
                                </Button>
                            </form>
                            <form
                                method="POST"
                                action="?/approvePayeeRequest"
                                use:enhance={handleAction("申請已核准")}
                                class="flex-1"
                            >
                                <input
                                    type="hidden"
                                    name="requestId"
                                    value={request.id}
                                />
                                <Button
                                    type="submit"
                                    variant="default"
                                    class="w-full"
                                    disabled={isActionSubmitting}
                                >
                                    {#if isActionSubmitting}
                                        <LoaderCircle
                                            class="mr-2 h-4 w-4 animate-spin"
                                        />
                                    {:else}
                                        <Check class="mr-2 h-4 w-4" />
                                    {/if}
                                    核准
                                </Button>
                            </form>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </Sheet.Content>
</Sheet.Root>
