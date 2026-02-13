<script lang="ts">
    /**
     * PayeeSheet.svelte
     *
     * 職責：
     * 1. 顯示並編輯收款人資訊。
     * 2. 支援廠商與個人戶不同欄位顯示。
     * 3. 處理銀行帳號的隱碼與解密顯示。
     * 4. 透過 SvelteKit Form Actions 發起異動申請。
     */
    import { enhance, deserialize } from "$app/forms";
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
        Save,
        Eye,
        EyeOff,
        LoaderCircle,
        FileText,
        Upload,
    } from "lucide-svelte";
    import { compressFormImageInputs } from "$lib/client/image-compression";
    import { timedFetch } from "$lib/client/timed-fetch";
    import BankCodeCombobox from "$lib/components/layout/BankCodeCombobox.svelte";
    import { invalidateAll } from "$app/navigation";

    let { payee, open = $bindable(false), isFinance = false } = $props();

    // 狀態
    let isLoading = $state(false);

    // 表單欄位
    let name = $state("");
    let type = $state("vendor");
    let taxId = $state("");
    let serviceDescription = $state("");
    let email = $state("");
    let address = $state("");
    let bankCode = $state("");
    let bankAccount = $state("");
    let reason = $state("");

    // 敏感資料顯示
    let showAccountValue = $state(false);
    let decryptedAccount = $state<string | null>(null);
    let revealing = $state(false);

    // 附件連結 (唯讀)
    let attachmentUrls = $derived(payee?.attachment_urls || {});

    // 同步資料
    $effect(() => {
        if (payee) {
            name = payee.name || "";
            type = payee.type || "vendor";
            taxId = payee.tax_id || "";
            serviceDescription = payee.service_description || "";
            email = payee.extra_info?.email || "";
            address = payee.extra_info?.address || "";
            bankCode = payee.bank || "";
            // 重設敏感資料狀態
            bankAccount = ""; // 不直接顯示原始加密字串
            showAccountValue = false;
            decryptedAccount = null;
            reason = ""; // 重設原因
        }
    });

    /**
     * 銀行帳號解密流程
     */
    async function toggleReveal() {
        if (!showAccountValue && !decryptedAccount) {
            revealing = true;
            try {
                const formData = new FormData();
                formData.append("payeeId", payee.id);

                const response = await timedFetch(
                    "/payees?/revealPayeeAccount",
                    {
                        method: "POST",
                        body: formData,
                    },
                );
                const text = await response.text();
                const result = deserialize(text) as any;

                if (
                    result.type === "success" &&
                    result.data &&
                    "decryptedAccount" in result.data
                ) {
                    decryptedAccount = String(result.data.decryptedAccount);
                } else {
                    toast.error("無法讀取帳號資訊");
                    return;
                }
            } catch {
                toast.error("無法讀取帳號資訊");
                return;
            } finally {
                revealing = false;
            }
        }
        showAccountValue = !showAccountValue;
    }

    /**
     * 表單提交
     */
    async function handleSubmit({
        formElement,
        formData,
    }: {
        formElement: HTMLFormElement;
        formData: FormData;
    }) {
        isLoading = true;

        // 確保 ID 被送出
        if (payee?.id) {
            formData.append("id", payee.id);
        }

        // 圖片壓縮
        await compressFormImageInputs(formElement, [
            "attachment_id_front",
            "attachment_id_back",
            "attachment_bank_cover",
        ]);

        return async ({ result }: { result: any }) => {
            isLoading = false;
            if (result.type === "success") {
                toast.success("更新申請已提交，請等待財務審核。");
                await invalidateAll();
                open = false;
            } else {
                toast.error(result.data?.message || "提交失敗，請稍後再試。");
            }
        };
    }
</script>

<Sheet.Root bind:open>
    <Sheet.Content class="sm:max-w-md overflow-y-auto">
        <Sheet.Header>
            <Sheet.Title>編輯收款人</Sheet.Title>
            <Sheet.Description>
                檢視或修改收款人資料。修改後將建立異動申請單。
            </Sheet.Description>
        </Sheet.Header>

        {#if payee}
            <div class="mt-6 space-y-6 pb-8">
                <!-- 基本資訊 Header -->
                <div class="flex items-center gap-4">
                    <Avatar.Root
                        class="h-16 w-16 border-2 border-background shadow-sm"
                    >
                        <Avatar.Fallback
                            class="bg-primary/5 text-xl font-bold text-primary"
                        >
                            {(name || "?").charAt(0).toUpperCase()}
                        </Avatar.Fallback>
                    </Avatar.Root>
                    <div>
                        <h3 class="font-semibold text-lg">{name}</h3>
                        <div
                            class="flex items-center gap-2 text-sm text-muted-foreground mt-1"
                        >
                            {#if type === "vendor"}
                                <Building2 class="h-3.5 w-3.5" />
                                <span>廠商統編：{taxId || "未設定"}</span>
                            {:else}
                                <User class="h-3.5 w-3.5" />
                                <span>個人戶</span>
                            {/if}
                        </div>
                    </div>
                </div>

                <form
                    method="POST"
                    action="?/updatePayeeRequest"
                    use:enhance={handleSubmit}
                    enctype="multipart/form-data"
                    class="space-y-6"
                >
                    <input type="hidden" name="type" value={type} />

                    <!-- 基本資料欄位 -->
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <Label for="name"
                                >受款人名稱 <span class="text-red-500">*</span
                                ></Label
                            >
                            <Input
                                id="name"
                                name="name"
                                bind:value={name}
                                placeholder={type === "vendor"
                                    ? "公司全名"
                                    : "真實姓名"}
                                required
                            />
                        </div>

                        {#if type === "vendor"}
                            <div class="space-y-2">
                                <Label for="tax_id"
                                    >統一編號 (8碼) <span class="text-red-500"
                                        >*</span
                                    ></Label
                                >
                                <Input
                                    id="tax_id"
                                    name="tax_id"
                                    bind:value={taxId}
                                    placeholder="12345678"
                                    maxlength={8}
                                    required
                                />
                            </div>
                            <div class="space-y-2">
                                <Label for="service_description"
                                    >服務項目說明</Label
                                >
                                <Input
                                    id="service_description"
                                    name="service_description"
                                    bind:value={serviceDescription}
                                    placeholder="例：網站維護費..."
                                />
                            </div>
                        {:else}
                            <div class="space-y-2">
                                <Label for="tax_id"
                                    >身分證字號 <span class="text-red-500"
                                        >*</span
                                    ></Label
                                >
                                <Input
                                    id="tax_id"
                                    name="tax_id"
                                    bind:value={taxId}
                                    placeholder="A123456789"
                                    maxlength={10}
                                    required
                                />
                            </div>
                            <div class="space-y-2">
                                <Label for="email">電子郵件</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    bind:value={email}
                                    type="email"
                                    placeholder="example@email.com"
                                />
                            </div>
                            <div class="space-y-2">
                                <Label for="address">戶籍/通訊地址</Label>
                                <Input
                                    id="address"
                                    name="address"
                                    bind:value={address}
                                    placeholder="請填寫完整地址"
                                />
                            </div>

                            <!-- 附件區塊 -->
                            <div
                                class="border rounded-md p-4 space-y-4 bg-muted/20"
                            >
                                <h4
                                    class="font-medium text-sm flex items-center gap-2"
                                >
                                    <FileText class="h-4 w-4" />
                                    證明文件
                                </h4>

                                <!-- 身分證正面 -->
                                <div class="space-y-2">
                                    <Label
                                        for="attachment_id_front"
                                        class="text-xs">身分證正面</Label
                                    >
                                    {#if attachmentUrls.id_card_front}
                                        <div class="text-xs mb-1">
                                            <a
                                                href={attachmentUrls.id_card_front}
                                                target="_blank"
                                                class="text-blue-600 hover:underline flex items-center gap-1"
                                            >
                                                <Eye class="h-3 w-3" /> 查看目前檔案
                                            </a>
                                        </div>
                                    {/if}
                                    <Input
                                        id="attachment_id_front"
                                        name="attachment_id_front"
                                        type="file"
                                        accept="image/*,.pdf"
                                        class="h-8 text-xs"
                                    />
                                </div>

                                <!-- 身分證反面 -->
                                <div class="space-y-2">
                                    <Label
                                        for="attachment_id_back"
                                        class="text-xs">身分證反面</Label
                                    >
                                    {#if attachmentUrls.id_card_back}
                                        <div class="text-xs mb-1">
                                            <a
                                                href={attachmentUrls.id_card_back}
                                                target="_blank"
                                                class="text-blue-600 hover:underline flex items-center gap-1"
                                            >
                                                <Eye class="h-3 w-3" /> 查看目前檔案
                                            </a>
                                        </div>
                                    {/if}
                                    <Input
                                        id="attachment_id_back"
                                        name="attachment_id_back"
                                        type="file"
                                        accept="image/*,.pdf"
                                        class="h-8 text-xs"
                                    />
                                </div>

                                <!-- 存摺封面 -->
                                <div class="space-y-2">
                                    <Label
                                        for="attachment_bank_cover"
                                        class="text-xs">存摺封面</Label
                                    >
                                    {#if attachmentUrls.bank_passbook}
                                        <div class="text-xs mb-1">
                                            <a
                                                href={attachmentUrls.bank_passbook}
                                                target="_blank"
                                                class="text-blue-600 hover:underline flex items-center gap-1"
                                            >
                                                <Eye class="h-3 w-3" /> 查看目前檔案
                                            </a>
                                        </div>
                                    {/if}
                                    <Input
                                        id="attachment_bank_cover"
                                        name="attachment_bank_cover"
                                        type="file"
                                        accept="image/*,.pdf"
                                        class="h-8 text-xs"
                                    />
                                </div>
                            </div>
                        {/if}
                    </div>

                    <!-- 銀行帳號 -->
                    <div class="space-y-4 pt-2">
                        <div
                            class="flex items-center gap-2 text-sm font-semibold text-primary"
                        >
                            <CreditCard class="h-4 w-4" />
                            匯款帳號資訊
                        </div>
                        <div class="grid gap-4 grid-cols-5">
                            <div class="col-span-2 space-y-2">
                                <Label for="bank_code">銀行代碼</Label>
                                <BankCodeCombobox
                                    id="bank_code"
                                    name="bank_code"
                                    bind:value={bankCode}
                                    submitMode="code-name"
                                    required
                                />
                            </div>
                            <div class="col-span-3 space-y-2">
                                <Label for="bank_account">銀行帳號</Label>
                                <div class="relative">
                                    <Input
                                        id="bank_account"
                                        name="bank_account"
                                        type={showAccountValue
                                            ? "text"
                                            : "password"}
                                        bind:value={bankAccount}
                                        placeholder={showAccountValue
                                            ? decryptedAccount || "點擊解密..."
                                            : payee.bank_account_tail
                                              ? `*****${payee.bank_account_tail}`
                                              : "••••••••••••"}
                                        disabled={revealing}
                                        required
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        data-testid="toggle-reveal-btn"
                                        class="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                        onclick={toggleReveal}
                                    >
                                        {#if revealing}
                                            <span
                                                class="animate-spin h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full"
                                            ></span>
                                        {:else if showAccountValue}
                                            <Eye
                                                class="h-3.5 w-3.5 text-muted-foreground"
                                            />
                                        {:else}
                                            <EyeOff
                                                class="h-3.5 w-3.5 text-muted-foreground"
                                            />
                                        {/if}
                                    </Button>
                                </div>
                                {#if !isFinance}
                                    <p
                                        class="text-[0.65rem] text-muted-foreground mt-1"
                                    >
                                        唯有財務人員可查看原始帳號。
                                    </p>
                                {/if}
                            </div>
                        </div>
                    </div>

                    <!-- 變更原因 -->
                    <div class="pt-2 space-y-2">
                        <Label for="reason"
                            >變更原因 <span class="text-red-500">*</span></Label
                        >
                        <Textarea
                            id="reason"
                            name="reason"
                            bind:value={reason}
                            placeholder="請說明此次變更的原因..."
                            class="resize-none"
                            required
                        />
                    </div>

                    <!-- 按鈕區 -->
                    <div
                        class="sticky bottom-0 bg-background/95 backdrop-blur pt-4 pb-4 border-t mt-4 flex gap-3"
                    >
                        <Button
                            type="submit"
                            class="flex-1 shadow-lg"
                            disabled={isLoading}
                        >
                            {#if isLoading}
                                <LoaderCircle
                                    class="mr-2 h-4 w-4 animate-spin"
                                />
                                資料傳送中...
                            {:else}
                                <Save class="mr-2 h-4 w-4" />
                                送出異動申請
                            {/if}
                        </Button>
                    </div>
                </form>
            </div>
        {/if}
    </Sheet.Content>
</Sheet.Root>
