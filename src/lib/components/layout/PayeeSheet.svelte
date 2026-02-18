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
    import { toast } from "svelte-sonner";
    import {
        Save,
        LoaderCircle,
    } from "lucide-svelte";
    import { compressFormImageInputs } from "$lib/client/image-compression";
    import { timedFetch } from "$lib/client/timed-fetch";
    import BankAccountSection from "$lib/components/layout/BankAccountSection.svelte";
    import PayeeAttachmentTiles from "$lib/components/layout/PayeeAttachmentTiles.svelte";
    import type { AttachmentKey } from "$lib/components/layout/PayeeAttachmentTiles.svelte";
    import { invalidateAll } from "$app/navigation";
    import { UI_MESSAGES } from "$lib/constants/ui-messages";

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
    let isEditing = $state(false);
    let taxIdCache = $state<Record<string, string>>({});
    let attachmentFiles = $state<Record<AttachmentKey, File | null>>({
        id_card_front: null,
        id_card_back: null,
        bank_passbook: null,
    });
    let removedAttachments = $state<Record<AttachmentKey, boolean>>({
        id_card_front: false,
        id_card_back: false,
        bank_passbook: false,
    });
    let localPreviewUrls = $state<Record<AttachmentKey, string | null>>({
        id_card_front: null,
        id_card_back: null,
        bank_passbook: null,
    });
    let lastSyncedPayeeToken = $state<string | null>(null);
    let viewOnlyFieldClass = $derived(
        !isEditing
            ? "cursor-default pointer-events-none focus-visible:ring-0 focus-visible:border-input"
            : "",
    );

    // 敏感資料顯示
    let showAccountValue = $state(false);
    let decryptedAccount = $state<string | null>(null);
    let revealing = $state(false);

    // 附件連結 (唯讀)
    let attachmentUrls = $derived(payee?.attachment_urls || {});
    let attachmentMeta = $derived(payee?.attachments || {});
    const ENCRYPTED_PLACEHOLDER_PATTERN = /已加密/;
    const ENCRYPTED_HEX_PATTERN = /^\\x[0-9a-f]+$/i;
    const ENCRYPTED_HEX_NO_PREFIX_PATTERN = /^[0-9a-f]+$/i;

    function normalizeComparable(value: unknown): string {
        if (value == null) return "";
        return String(value).trim();
    }

    function sanitizeEncryptedPlaceholder(value: unknown): string {
        const text = normalizeComparable(value);
        const looksLikeHex =
            ENCRYPTED_HEX_PATTERN.test(text) ||
            (ENCRYPTED_HEX_NO_PREFIX_PATTERN.test(text) && text.length >= 24);
        return ENCRYPTED_PLACEHOLDER_PATTERN.test(text) || looksLikeHex
            ? ""
            : text;
    }

    let hasMeaningfulChanges = $derived.by(() => {
        if (!isEditing || !payee) return false;

        const currentExtra = payee.extra_info || {};
        const currentTaxId = sanitizeEncryptedPlaceholder(
            taxIdCache[payee.id] || payee.identity_no || payee.unified_no || "",
        );

        const basicChanged =
            normalizeComparable(name) !== normalizeComparable(payee.name) ||
            normalizeComparable(type) !== normalizeComparable(payee.type) ||
            normalizeComparable(bankCode) !== normalizeComparable(payee.bank) ||
            normalizeComparable(serviceDescription) !==
                normalizeComparable(payee.service_description);

        const personalChanged =
            type === "personal" &&
            (normalizeComparable(email) !== normalizeComparable(currentExtra.email) ||
                normalizeComparable(address) !== normalizeComparable(currentExtra.address));

        const taxChanged =
            normalizeComparable(sanitizeEncryptedPlaceholder(taxId)) !==
            normalizeComparable(currentTaxId);

        // 空字串視為「未變更」，只有有輸入才代表申請變更帳號
        const bankAccountChanged = normalizeComparable(bankAccount).length > 0;

        const attachmentChanged =
            type === "personal" &&
            (Object.values(removedAttachments).some(Boolean) ||
                Object.values(attachmentFiles).some((f) => Boolean(f)));

        return Boolean(
            basicChanged ||
                personalChanged ||
                taxChanged ||
                bankAccountChanged ||
                attachmentChanged,
        );
    });

    // 同步資料
    function resetFormFromPayee() {
        if (payee) {
            name = payee.name || "";
            type = payee.type || "vendor";
            taxId =
                taxIdCache[payee.id] ||
                sanitizeEncryptedPlaceholder(payee.identity_no) ||
                sanitizeEncryptedPlaceholder(payee.unified_no) ||
                "";
            serviceDescription = payee.service_description || "";
            email = payee.extra_info?.email || "";
            address = payee.extra_info?.address || "";
            bankCode = payee.bank || "";
            // 重設敏感資料狀態
            bankAccount = ""; // 不直接顯示原始加密字串
            showAccountValue = false;
            decryptedAccount = null;
            reason = ""; // 重設原因
            attachmentFiles = {
                id_card_front: null,
                id_card_back: null,
                bank_passbook: null,
            };
            removedAttachments = {
                id_card_front: false,
                id_card_back: false,
                bank_passbook: false,
            };
        }
    }

    $effect(() => {
        const payeeToken = payee ? `${payee.id}:${payee.updated_at || ""}` : null;
        if (payeeToken !== lastSyncedPayeeToken) {
            resetFormFromPayee();
            isEditing = false;
            lastSyncedPayeeToken = payeeToken;
            void ensureTaxIdReady();
        }
    });

    $effect(() => {
        if (!open) {
            isEditing = false;
        }
    });

    function startEditing() {
        isEditing = true;
        void ensureTaxIdReady();
    }

    function cancelEditing() {
        resetFormFromPayee();
        isEditing = false;
    }

    function hasExistingAttachment(key: AttachmentKey) {
        return Boolean(attachmentMeta?.[key] && !removedAttachments[key]);
    }

    function hasAttachment(key: AttachmentKey) {
        return Boolean(hasExistingAttachment(key) || attachmentFiles[key]);
    }

    function canInteractWithAttachmentTile(key: AttachmentKey) {
        return hasAttachment(key) || isEditing;
    }

    function handleAttachmentSelected(
        key: AttachmentKey,
        event: Event,
    ) {
        const input = event.currentTarget as HTMLInputElement;
        const file = input.files?.[0] || null;
        attachmentFiles = {
            ...attachmentFiles,
            [key]: file,
        };
        if (file) {
            removedAttachments = {
                ...removedAttachments,
                [key]: false,
            };
        }
    }

    function removeAttachment(key: AttachmentKey) {
        if (!isEditing) return;
        attachmentFiles = {
            ...attachmentFiles,
            [key]: null,
        };
        removedAttachments = {
            ...removedAttachments,
            [key]: true,
        };
    }

    function isImageUrl(url: string) {
        return /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(url);
    }

    function isPdfUrl(url: string) {
        return /\.pdf(\?.*)?$/i.test(url);
    }

    function isAttachmentImage(key: AttachmentKey) {
        const file = attachmentFiles[key];
        if (file) return file.type.startsWith("image/");
        const url = hasExistingAttachment(key) ? String(attachmentUrls[key] || attachmentMeta[key] || "") : "";
        return Boolean(url && isImageUrl(url));
    }

    function isAttachmentPdf(key: AttachmentKey) {
        const file = attachmentFiles[key];
        if (file) return file.type === "application/pdf";
        const url = hasExistingAttachment(key) ? String(attachmentUrls[key] || attachmentMeta[key] || "") : "";
        return Boolean(url && isPdfUrl(url));
    }

    function getAttachmentPreviewUrl(key: AttachmentKey) {
        return localPreviewUrls[key] || (hasExistingAttachment(key) ? String(attachmentUrls[key] || "") : null);
    }

    $effect(() => {
        const urls: Record<AttachmentKey, string | null> = {
            id_card_front: null,
            id_card_back: null,
            bank_passbook: null,
        };

        (Object.keys(attachmentFiles) as AttachmentKey[]).forEach((key) => {
            const file = attachmentFiles[key];
            if (file && file.type.startsWith("image/")) {
                urls[key] = URL.createObjectURL(file);
            }
        });

        localPreviewUrls = urls;

        return () => {
            (Object.values(urls) as Array<string | null>).forEach((url) => {
                if (url) URL.revokeObjectURL(url);
            });
        };
    });

    /**
     * 銀行帳號解密流程
     */
    async function ensureTaxIdReady() {
        if (!payee?.id || type !== "personal" || !isFinance || sanitizeEncryptedPlaceholder(taxId).length > 0) return;

        try {
            const formData = new FormData();
            formData.append("payeeId", payee.id);
            const response = await timedFetch("/payees?/revealPayeeTaxId", {
                method: "POST",
                body: formData,
            });
            const result = deserialize(await response.text()) as any;
            if (
                result.type === "success" &&
                result.data &&
                "taxId" in result.data
            ) {
                const nextTaxId = String(result.data.taxId || "").trim();
                if (nextTaxId.length > 0) {
                    taxId = nextTaxId;
                    taxIdCache = {
                        ...taxIdCache,
                        [payee.id]: nextTaxId,
                    };
                }
            }
        } catch {
            // 非阻斷流程：保持現有值，讓使用者可手動輸入
        }
    }

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
                    const nextAccount = sanitizeEncryptedPlaceholder(
                        result.data.decryptedAccount,
                    );
                    if (!nextAccount) {
                        toast.error(UI_MESSAGES.user.accountReadFailed);
                        return;
                    }
                    decryptedAccount = nextAccount;
                } else {
                    toast.error(UI_MESSAGES.user.accountReadFailed);
                    return;
                }
            } catch {
                toast.error(UI_MESSAGES.user.accountReadFailed);
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
        cancel,
    }: {
        formElement: HTMLFormElement;
        formData: FormData;
        cancel: () => void;
    }) {
        if (!hasMeaningfulChanges) {
            toast.error(UI_MESSAGES.payee.noChanges);
            cancel();
            return;
        }

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
                if (payee?.id) {
                    const nextTaxId = taxId.trim();
                    taxIdCache = {
                        ...taxIdCache,
                        [payee.id]: nextTaxId,
                    };
                }
                toast.success(UI_MESSAGES.payee.updateRequestSubmitted);
                await invalidateAll();
                open = false;
            } else {
                toast.error(result.data?.message || UI_MESSAGES.common.submitFailed);
            }
        };
    }

</script>

<Sheet.Root bind:open>
    <Sheet.Content class="sm:max-w-md overflow-y-auto">
        <Sheet.Header>
        <Sheet.Title>收款人資訊</Sheet.Title>
        <Sheet.Description>
                檢視或修改收款人資料。修改後將建立異動申請單。
        </Sheet.Description>
        </Sheet.Header>

        {#if payee}
            <div class="mt-6 space-y-6 pb-8">
                <form
                    method="POST"
                    action="/payees?/updatePayeeRequest"
                    use:enhance={handleSubmit}
                    enctype="multipart/form-data"
                    class="space-y-6"
                >
                    <input type="hidden" name="type" value={type} />

                    <!-- 基本資料欄位 -->
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <Label for="name"
                                >{type === "vendor"
                                    ? "公司名稱"
                                    : "姓名"} <span class="text-red-500">*</span
                                ></Label
                            >
                            <Input
                                id="name"
                                name="name"
                                bind:value={name}
                                placeholder={type === "vendor"
                                    ? "公司全名"
                                    : "真實姓名"}
                                readonly={!isEditing}
                                class={viewOnlyFieldClass}
                                required
                            />
                        </div>

                        <div class="grid gap-4 md:grid-cols-2">
                            <div class="space-y-2">
                                <Label for="identity_no"
                                    >{type === "vendor"
                                        ? "統一編號 (8碼)"
                                        : "身分證字號"} <span
                                        class="text-red-500">*</span
                                    ></Label
                                >
                                <Input
                                    id="identity_no"
                                    name="identity_no"
                                    bind:value={taxId}
                                    placeholder={type === "vendor"
                                        ? "12345678"
                                        : "A123456789"}
                                    maxlength={type === "vendor" ? 8 : 10}
                                    readonly={!isEditing}
                                    class={viewOnlyFieldClass}
                                    required={type === "vendor"}
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
                                    readonly={!isEditing}
                                    class={viewOnlyFieldClass}
                                />
                            </div>
                        </div>

                        {#if type === "personal"}
                            <div class="space-y-2">
                                <Label for="email">電子郵件</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    bind:value={email}
                                    type="email"
                                    placeholder="example@email.com"
                                    readonly={!isEditing}
                                    class={viewOnlyFieldClass}
                                />
                            </div>
                            <div class="space-y-2">
                                <Label for="address">戶籍/通訊地址</Label>
                                <Input
                                    id="address"
                                    name="address"
                                    bind:value={address}
                                    placeholder="請填寫完整地址"
                                    readonly={!isEditing}
                                    class={viewOnlyFieldClass}
                                />
                            </div>
                        {/if}
                    </div>

                    <BankAccountSection
                        mode="payee"
                        {isEditing}
                        {isFinance}
                        hasBankInfo={true}
                        showTitle={false}
                        bind:bankName={bankCode}
                        bind:inputBankAccount={bankAccount}
                        maskedAccountTail={payee?.bank_account_tail
                            ? `*****${payee.bank_account_tail}`
                            : "••••••••••••"}
                        {revealing}
                        {showAccountValue}
                        {decryptedAccount}
                        viewOnlyFieldClass={viewOnlyFieldClass}
                        onToggleReveal={toggleReveal}
                    />

                    {#if type === "personal"}
                        <PayeeAttachmentTiles
                            {isEditing}
                            {attachmentFiles}
                            {removedAttachments}
                            {canInteractWithAttachmentTile}
                            {hasAttachment}
                            {hasExistingAttachment}
                            {isAttachmentImage}
                            {isAttachmentPdf}
                            {getAttachmentPreviewUrl}
                            onRemove={removeAttachment}
                            onFileSelected={handleAttachmentSelected}
                        />
                    {/if}

                    <!-- 變更原因 -->
                    {#if isEditing}
                        <div class="pt-2 space-y-2">
                            <Label for="reason"
                                >變更原因 <span class="text-red-500">*</span
                                ></Label
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
                    {/if}

                    <!-- 按鈕區 -->
                    <div
                        class="sticky bottom-0 bg-background/95 backdrop-blur pt-4 pb-4 border-t mt-4 flex gap-3"
                    >
                        {#if isEditing}
                            <Button
                                type="button"
                                variant="outline"
                                class="flex-1"
                                onclick={cancelEditing}
                                disabled={isLoading}
                            >
                                取消編輯
                            </Button>
                            <Button
                                type="submit"
                                class="flex-1 shadow-lg"
                                disabled={isLoading || !hasMeaningfulChanges}
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
                        {:else}
                            <Button
                                type="button"
                                class="w-full shadow-lg"
                                onclick={startEditing}
                            >
                                編輯收款人資訊
                            </Button>
                        {/if}
                    </div>
                    {#if isEditing && !hasMeaningfulChanges}
                        <p class="text-xs text-muted-foreground text-center">
                            至少需修改一項資料後才能提交異動申請（變更原因不計入）。
                        </p>
                    {/if}
                </form>
            </div>
        {/if}
    </Sheet.Content>
</Sheet.Root>
