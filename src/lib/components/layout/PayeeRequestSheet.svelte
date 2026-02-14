<script lang="ts">
    import { enhance } from "$app/forms";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import * as Sheet from "$lib/components/ui/sheet";
    import { toast } from "svelte-sonner";
    import {
        Check,
        X,
        LoaderCircle,
    } from "lucide-svelte";
    import { invalidateAll } from "$app/navigation";

    let {
        request,
        open = $bindable(false),
        isFinance = false,
    } = $props();

    let isActionSubmitting = $state(false);

    let changeType = $derived(request?.payload?.change_type || "unknown");
    let proposedData = $derived(request?.payload?.proposed_data || {});
    let reason = $derived(request?.payload?.reason || "");
    let proposedBankAccountTail = $derived(
        request?.payload?.proposed_bank_account_tail || "",
    );
    let proposedBankAccountPlain = $derived(
        request?.payload?.proposed_bank_account_plain || "",
    );
    let linkedPayee = $derived(request?.payload?.linked_payee || null);

    let beforeName = $derived(linkedPayee?.name || "");
    let beforeType = $derived(linkedPayee?.type || request?.type || "");
    let beforeServiceDescription = $derived(
        linkedPayee?.service_description || "",
    );
    let beforeTaxId = $derived(
        request?.payload?.linked_tax_id || linkedPayee?.tax_id || "",
    );
    let beforeEmail = $derived(linkedPayee?.extra_info?.email || "");
    let beforeAddress = $derived(linkedPayee?.extra_info?.address || "");
    let beforeAttachmentUrls = $derived(linkedPayee?.attachment_urls || {});
    let beforeBankCode = $derived(linkedPayee?.bank || "");
    let beforeBankAccountTail = $derived(linkedPayee?.bank_account_tail || "");
    let beforeBankAccountPlain = $derived(
        request?.payload?.linked_bank_account_plain || "",
    );

    const ATTACHMENT_FIELDS = [
        { key: "id_card_front", label: "身分證正面" },
        { key: "id_card_back", label: "身分證反面" },
        { key: "bank_passbook", label: "存摺封面" },
    ] as const;

    function hasOwn(obj: Record<string, any>, key: string) {
        return Object.prototype.hasOwnProperty.call(obj || {}, key);
    }

    function toText(v: any) {
        if (v === null || v === undefined) return "";
        return String(v);
    }

    function normalize(v: any) {
        return toText(v).trim();
    }

    function changed(before: any, after: any) {
        return normalize(before) !== normalize(after);
    }

    function sanitizeEncryptedPlaceholder(v: any) {
        const text = normalize(v);
        const looksLikeHexBlob = /^[0-9a-f]+$/i.test(text) && text.length >= 24;
        return text.includes("已加密") || looksLikeHexBlob ? "" : text;
    }

    function getAfterValue(
        key: string,
        fallback: any,
        nestedParent?: string,
    ) {
        if (hasOwn(proposedData, key)) return toText(proposedData?.[key]);
        if (
            nestedParent &&
            hasOwn(proposedData, nestedParent) &&
            proposedData?.[nestedParent]?.[key] !== undefined
        ) {
            return toText(proposedData[nestedParent][key]);
        }
        return toText(fallback);
    }

    let displayName = $derived(
        toText(proposedData?.name) || beforeName || request?.name || "",
    );
    let displayType = $derived(
        toText(proposedData?.type) || beforeType || "unknown",
    );
    let taxLabel = $derived(displayType === "vendor" ? "統一編號" : "身分證字號");
    let afterServiceDescription = $derived(
        getAfterValue("service_description", beforeServiceDescription),
    );
    let afterEmail = $derived(
        getAfterValue("email", beforeEmail, "extra_info"),
    );
    let afterAddress = $derived(
        getAfterValue("address", beforeAddress, "extra_info"),
    );
    let afterBankCode = $derived(
        getAfterValue("bank_code", beforeBankCode),
    );
    let afterBankAccountTail = $derived(
        proposedBankAccountTail || beforeBankAccountTail || "",
    );
    let beforeBankAccountDisplay = $derived.by(() =>
        bankAccountDisplay(beforeBankAccountPlain, beforeBankAccountTail),
    );
    let afterBankAccountDisplay = $derived.by(() =>
        bankAccountDisplay(proposedBankAccountPlain, afterBankAccountTail),
    );
    let taxIdDisplayAfter = $derived.by(() => {
        if (hasOwn(proposedData, "tax_id")) return sanitizeEncryptedPlaceholder(proposedData.tax_id);
        return "";
    });
    let taxIdDisplayBefore = $derived(sanitizeEncryptedPlaceholder(beforeTaxId));
    let proposedAttachments = $derived(request?.payload?.proposed_attachments || {});
    let proposedAttachmentUrls = $derived(
        request?.payload?.proposed_attachment_urls || {},
    );
    let isUpdateFlow = $derived(changeType === "update");
    let isNameChanged = $derived(
        hasOwn(proposedData, "name") && changed(beforeName, displayName),
    );
    let isTaxIdChanged = $derived(
        hasOwn(proposedData, "tax_id") &&
            changed(taxIdDisplayBefore, taxIdDisplayAfter),
    );
    let isServiceChanged = $derived(
        hasOwn(proposedData, "service_description") &&
            changed(beforeServiceDescription, afterServiceDescription),
    );
    let isEmailChanged = $derived(
        hasOwn(proposedData, "email") && changed(beforeEmail, afterEmail),
    );
    let isAddressChanged = $derived(
        hasOwn(proposedData, "address") && changed(beforeAddress, afterAddress),
    );
    let isBankCodeChanged = $derived(
        hasOwn(proposedData, "bank_code") && changed(beforeBankCode, afterBankCode),
    );
    let isBankAccountChanged = $derived(
        normalize(proposedBankAccountPlain).length > 0 ||
            (normalize(proposedBankAccountTail).length > 0 &&
                changed(beforeBankAccountTail, afterBankAccountTail)),
    );
    let hasAnyDataChanges = $derived(
        isNameChanged ||
            isTaxIdChanged ||
            isServiceChanged ||
            isEmailChanged ||
            isAddressChanged ||
            isBankCodeChanged ||
            isBankAccountChanged,
    );
    let hasAnyAttachmentChanges = $derived(
        Boolean(proposedAttachments?.id_card_front) ||
            Boolean(proposedAttachments?.id_card_back) ||
            Boolean(proposedAttachments?.bank_passbook),
    );

    function withFallback(v: string) {
        return normalize(v) === "" ? "—" : v;
    }

    function maskedTail(v: string) {
        const text = sanitizeEncryptedPlaceholder(v);
        if (!text) return "—";
        return `*****${text}`;
    }

    function bankAccountDisplay(plainValue: any, tailValue: any) {
        const plain = sanitizeEncryptedPlaceholder(plainValue);
        if (plain) return plain;
        return maskedTail(toText(tailValue));
    }

    function toAttachmentDisplay(value: any) {
        const text = normalize(value);
        return text ? text : "—";
    }

    function getAttachmentHref(
        source: Record<string, any> | null | undefined,
        key: string,
    ) {
        return source?.[key] || "";
    }

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
            <div class="mt-6 space-y-6">
                <div class="space-y-6">
                    {#if changeType !== "disable"}
                        {#if isUpdateFlow}
                            <div class="space-y-4">
                                <h3 class="text-base font-semibold">目前資訊</h3>
                                <div class="space-y-2">
                                    <Label>收款人名稱</Label>
                                    <Input value={withFallback(beforeName)} readonly />
                                </div>

                                <div class="grid gap-4 md:grid-cols-2">
                                    <div class="space-y-2">
                                        <Label>{taxLabel}</Label>
                                        <Input value={withFallback(taxIdDisplayBefore)} readonly />
                                    </div>
                                    <div class="space-y-2">
                                        <Label>服務項目說明</Label>
                                        <Input value={withFallback(beforeServiceDescription)} readonly />
                                    </div>
                                </div>

                                {#if displayType === "personal"}
                                    <div class="space-y-2">
                                        <Label>電子郵件</Label>
                                        <Input value={withFallback(beforeEmail)} readonly />
                                    </div>
                                    <div class="space-y-2">
                                        <Label>戶籍/通訊地址</Label>
                                        <Input value={withFallback(beforeAddress)} readonly />
                                    </div>
                                    <div class="space-y-2 pt-2 border-t">
                                        <Label>附件</Label>
                                        <div class="grid gap-3 grid-cols-3">
                                            {#each ATTACHMENT_FIELDS as field}
                                                <div class="space-y-1">
                                                    <p class="text-xs text-muted-foreground">{field.label}</p>
                                                    {#if getAttachmentHref(beforeAttachmentUrls, field.key)}
                                                        <a
                                                            href={getAttachmentHref(beforeAttachmentUrls, field.key)}
                                                            target="_blank"
                                                            class="text-sm text-primary underline-offset-2 hover:underline"
                                                        >
                                                            查看附件
                                                        </a>
                                                    {:else}
                                                        <p class="text-sm text-muted-foreground">—</p>
                                                    {/if}
                                                </div>
                                            {/each}
                                        </div>
                                    </div>
                                {/if}

                                <div class="grid gap-4 grid-cols-5 pt-2 border-t">
                                    <div class="col-span-2 space-y-2">
                                        <Label>銀行代碼</Label>
                                        <Input value={withFallback(beforeBankCode)} readonly />
                                    </div>
                                    <div class="col-span-3 space-y-2">
                                        <Label>銀行帳號</Label>
                                        <Input value={withFallback(beforeBankAccountDisplay)} readonly />
                                    </div>
                                </div>
                            </div>

                            <div class="space-y-4 pt-4 border-t">
                                <h3 class="text-base font-semibold">變更後資訊</h3>
                                {#if isNameChanged}
                                    <div class="space-y-2">
                                        <Label>收款人名稱</Label>
                                        <Input value={withFallback(displayName)} readonly />
                                    </div>
                                {/if}
                                {#if isTaxIdChanged}
                                    <div class="space-y-2">
                                        <Label>{taxLabel}</Label>
                                        <Input value={withFallback(taxIdDisplayAfter)} readonly />
                                    </div>
                                {/if}
                                {#if isEmailChanged}
                                    <div class="space-y-2">
                                        <Label>電子郵件</Label>
                                        <Input value={withFallback(afterEmail)} readonly />
                                    </div>
                                {/if}
                                {#if isAddressChanged}
                                    <div class="space-y-2">
                                        <Label>通訊地址</Label>
                                        <Input value={withFallback(afterAddress)} readonly />
                                    </div>
                                {/if}
                                {#if displayType === "personal" && hasAnyAttachmentChanges}
                                    <div class="space-y-2">
                                        <Label>附件</Label>
                                        <div class="grid gap-3 grid-cols-3">
                                            {#each ATTACHMENT_FIELDS as field}
                                                <div class="space-y-1">
                                                    <p class="text-xs text-muted-foreground">{field.label}</p>
                                                    {#if getAttachmentHref(proposedAttachmentUrls, field.key)}
                                                        <a
                                                            href={getAttachmentHref(proposedAttachmentUrls, field.key)}
                                                            target="_blank"
                                                            class="text-sm text-primary underline-offset-2 hover:underline"
                                                        >
                                                            查看附件
                                                        </a>
                                                    {:else}
                                                        <Input value={toAttachmentDisplay(proposedAttachments?.[field.key])} readonly />
                                                    {/if}
                                                </div>
                                            {/each}
                                        </div>
                                    </div>
                                {/if}
                                {#if isServiceChanged}
                                    <div class="space-y-2">
                                        <Label>服務項目說明</Label>
                                        <Input value={withFallback(afterServiceDescription)} readonly />
                                    </div>
                                {/if}
                                {#if isBankCodeChanged || isBankAccountChanged}
                                    <div class="grid gap-4 grid-cols-5">
                                        {#if isBankCodeChanged}
                                            <div class="col-span-2 space-y-2">
                                                <Label>銀行代碼</Label>
                                                <Input value={withFallback(afterBankCode)} readonly />
                                            </div>
                                        {/if}
                                        {#if isBankAccountChanged}
                                            <div class="col-span-3 space-y-2">
                                                <Label>銀行帳號</Label>
                                                <Input value={withFallback(afterBankAccountDisplay)} readonly />
                                            </div>
                                        {/if}
                                    </div>
                                {/if}
                                {#if !hasAnyDataChanges && !hasAnyAttachmentChanges}
                                    <p class="text-sm text-muted-foreground">
                                        此申請未包含任何資料異動。
                                    </p>
                                {/if}
                            </div>
                        {:else}
                            <div class="space-y-4">
                            <div class="space-y-2">
                                <Label>收款人名稱</Label>
                                <Input value={withFallback(displayName)} readonly />
                            </div>

                            <div class="space-y-2">
                                <Label>{taxLabel}</Label>
                                <Input value={withFallback(taxIdDisplayAfter)} readonly />
                            </div>

                            {#if displayType === "personal"}
                                <div class="space-y-2">
                                    <Label>電子郵件</Label>
                                    <Input value={withFallback(afterEmail)} readonly />
                                </div>
                                <div class="space-y-2">
                                    <Label>通訊地址</Label>
                                    <Input value={withFallback(afterAddress)} readonly />
                                </div>
                            {/if}

                            <div class="space-y-2">
                                <Label>服務項目說明</Label>
                                <Input value={withFallback(afterServiceDescription)} readonly />
                            </div>
                        </div>

                        <div class="space-y-4 pt-2 border-t">
                            <div class="grid gap-4 grid-cols-5">
                                <div class="col-span-2 space-y-2">
                                    <Label>銀行代碼</Label>
                                    <Input value={withFallback(afterBankCode)} readonly />
                                </div>
                                <div class="col-span-3 space-y-2">
                                    <Label>銀行帳號</Label>
                                    <Input value={withFallback(afterBankAccountDisplay)} readonly />
                                </div>
                            </div>
                        </div>
                        {/if}
                    {/if}

                    <div class="pt-2 space-y-2 border-t">
                        <Label>變更原因</Label>
                        <Textarea value={reason || "—"} readonly class="resize-none" />
                    </div>
                </div>

                <div class="p-6 bg-background border-t">
                    {#if isFinance}
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
                                        <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
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
                                        <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
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
