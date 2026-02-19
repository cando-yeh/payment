<script lang="ts">
    /**
     * @file New Payee Request Page
     * @description Allows users to submit a request to create a new payee (Vendor or Personal).
     * The request is sent to the Finance team for approval.
     */
    import { enhance } from "$app/forms";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Switch } from "$lib/components/ui/switch";
    import { Label } from "$lib/components/ui/label";
    import * as Card from "$lib/components/ui/card";
    import * as Tabs from "$lib/components/ui/tabs";
    import BankCodeCombobox from "$lib/components/layout/BankCodeCombobox.svelte";
    import { toast } from "svelte-sonner";
    import { ArrowLeft, LoaderCircle, Send } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { compressFormImageInputs } from "$lib/client/image-compression";
    import { UI_MESSAGES } from "$lib/constants/ui-messages";

    // Component State
    let isLoading = $state(false);
    let payeeType = $state("vendor"); // "vendor" | "personal" - Controls dynamic form fields
    let editableAccount = $state(false);

    /**
     * Handles the form submission using SvelteKit's standard `enhance` action.
     * Manages loading state and displays toast notifications based on the result.
     */
    async function handleSubmit({
        formElement,
    }: {
        formElement: HTMLFormElement;
    }) {
        isLoading = true;
        await compressFormImageInputs(formElement, [
            "attachment_id_front",
            "attachment_id_back",
            "attachment_bank_cover",
        ]);

        return async ({ result }: { result: any }) => {
            isLoading = false;

            if (result.type === "success") {
                toast.success(UI_MESSAGES.payee.requestSubmitted);
                goto("/payees");
            } else if (result.type === "redirect") {
                goto(result.location);
            } else {
                toast.error(
                    result.data?.message || UI_MESSAGES.common.submitFailed,
                );
            }
        };
    }
</script>

<div class="space-y-4 pb-16">
    <div class="flex items-center justify-between gap-4">
        <Button
            variant="ghost"
            class="h-9 px-3 text-base font-semibold text-muted-foreground hover:text-foreground"
            onclick={() => history.back()}
        >
            <ArrowLeft class="mr-1.5 h-4 w-4" />
            返回列表
        </Button>

        <Button
            type="submit"
            form="payee-create-form"
            size="sm"
            disabled={isLoading}
        >
            {#if isLoading}
                <LoaderCircle class="mr-1.5 h-3.5 w-3.5 animate-spin" />
                提交中...
            {:else}
                <Send class="mr-1.5 h-3.5 w-3.5" />
                直接提交
            {/if}
        </Button>
    </div>

    <Card.Root class="overflow-hidden rounded-2xl border border-border/40">
        <div class="border-b border-border/40 px-6 py-5">
            <h1
                class="text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.01em] text-foreground"
            >
                新增收款人
            </h1>
            <p class="mt-1 text-[15px] leading-6 font-medium text-foreground/65">
                提交新的收款對象資料。送出後需經財務審核才可正式啟用。
            </p>
        </div>
        <Card.Content class="px-6 py-5">
            <form
                id="payee-create-form"
                method="POST"
                action="?/createPayeeRequest"
                use:enhance={handleSubmit}
                enctype="multipart/form-data"
                class="space-y-6"
            >
                <!-- Type Selection -->
                <div class="space-y-3">
                    <Label>收款人類型</Label>
                    <Tabs.Root
                        value={payeeType}
                        onValueChange={(v) => {
                            payeeType =
                                v === "personal" ? "personal" : "vendor";
                            if (payeeType !== "vendor") {
                                editableAccount = false;
                            }
                        }}
                    >
                        <Tabs.List
                            class="bg-secondary/40 p-1 rounded-xl h-auto inline-flex gap-1 flex-nowrap"
                        >
                            <Tabs.Trigger
                                value="vendor"
                                class="rounded-lg px-5 py-2 font-bold text-xs whitespace-nowrap gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                廠商 (公司/行號)
                            </Tabs.Trigger>
                            <Tabs.Trigger
                                value="personal"
                                class="rounded-lg px-5 py-2 font-bold text-xs whitespace-nowrap gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                個人 (勞務/領據)
                            </Tabs.Trigger>
                        </Tabs.List>
                    </Tabs.Root>
                    <p class="text-sm text-muted-foreground">
                        {payeeType === "vendor"
                            ? "建立廠商收款資料，供廠商請款時選用。"
                            : "建立個人收款資料，供個人勞務請款時選用。"}
                    </p>
                    <!-- Hidden input for form submission -->
                    <input type="hidden" name="type" value={payeeType} />
                    <input
                        type="hidden"
                        name="editable_account"
                        value={editableAccount ? "true" : "false"}
                    />
                </div>

                <div class="grid gap-4 md:grid-cols-2">
                    <!-- Row 1: Name and Tax ID / ID Number -->
                    <div class="space-y-2">
                        <Label for="name"
                            >公司/個人名稱 <span class="text-red-500">*</span
                            ></Label
                        >
                        <Input
                            id="name"
                            name="name"
                            placeholder={payeeType === "vendor"
                                ? "公司全名"
                                : "真實姓名"}
                            required
                        />
                    </div>

                    <div class="space-y-2">
                        {#if payeeType === "vendor"}
                            <Label for="identity_no"
                                >統一編號 (8碼) <span class="text-red-500"
                                    >*</span
                                ></Label
                            >
                            <Input
                                id="identity_no"
                                name="identity_no"
                                placeholder="12345678"
                                maxlength={8}
                                required
                            />
                        {:else}
                            <Label for="identity_no"
                                >身分證字號 <span class="text-red-500">*</span
                                ></Label
                            >
                            <Input
                                id="identity_no"
                                name="identity_no"
                                placeholder="A123456789"
                                maxlength={10}
                                required
                            />
                        {/if}
                    </div>

                    <!-- Row 2: Email and Address (Personal Only) -->
                    {#if payeeType === "personal"}
                        <div class="space-y-2">
                            <Label for="email"
                                >電子郵件 <span class="text-red-500">*</span
                                ></Label
                            >
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="example@email.com"
                                required
                            />
                        </div>
                        <div class="space-y-2">
                            <Label for="address"
                                >戶籍/通訊地址 <span class="text-red-500"
                                    >*</span
                                ></Label
                            >
                            <Input
                                id="address"
                                name="address"
                                placeholder="請填寫完整地址"
                                required
                            />
                        </div>
                    {/if}

                    <!-- Row 3: Shared Service Description -->
                    <div class="space-y-2 md:col-span-2">
                        <Label for="service_description"
                            >服務項目說明 <span class="text-red-500">*</span
                            ></Label
                        >
                        <Input
                            id="service_description"
                            name="service_description"
                            placeholder="例：網站維護費、辦公室租賃、勞務報酬..."
                            required
                        />
                    </div>

                    <!-- Bank Information Section -->
                    <div class="md:col-span-2 border-t pt-6 mt-2">
                        <h3 class="mb-4 text-base font-semibold">銀行匯款資訊</h3>

                        <div class="grid gap-4 md:grid-cols-2">
                            <div class="space-y-2">
                                <Label for="bank_code"
                                    >銀行代碼 <span class="text-red-500">*</span
                                    ></Label
                                >
                                <BankCodeCombobox
                                    id="bank_code"
                                    name="bank_code"
                                    placeholder="請選擇銀行"
                                    required
                                />
                                {#if payeeType === "vendor"}
                                    <div class="mb-4 flex flex-col gap-1.5">
                                        <div class="flex items-center gap-2">
                                            <Label for="editable_account"
                                                >非固定帳號</Label
                                            >
                                            <Switch
                                                id="editable_account"
                                                aria-label="非固定帳號"
                                                bind:checked={editableAccount}
                                            />
                                        </div>
                                        <p
                                            class="text-xs text-muted-foreground"
                                        >
                                            若開啟，則請款時可修改銀行帳號。
                                        </p>
                                    </div>
                                {/if}
                            </div>
                            <div class="space-y-2">
                                <Label for="bank_account"
                                    >銀行帳號 <span class="text-red-500">*</span
                                    ></Label
                                >
                                <Input
                                    id="bank_account"
                                    name="bank_account"
                                    type="password"
                                    placeholder="請輸入帳號"
                                    required
                                />
                                <p class="text-xs text-muted-foreground">
                                    帳號將加密儲存，僅財務人員可查看。
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Attachments Section (Personal Only) -->
                    {#if payeeType === "personal"}
                        <div class="md:col-span-2 border-t pt-6 mt-2">
                            <h3 class="mb-4 text-base font-semibold">必要附件</h3>
                            <div class="grid gap-4 md:grid-cols-2">
                                <div class="space-y-2">
                                    <Label for="attachment_id_front"
                                        >身分證正面 <span class="text-red-500"
                                            >*</span
                                        ></Label
                                    >
                                    <Input
                                        id="attachment_id_front"
                                        name="attachment_id_front"
                                        type="file"
                                        accept="image/*,.pdf"
                                        required
                                    />
                                    <p class="text-xs text-muted-foreground">
                                        支援 JPG, PNG, PDF (最大 10MB)
                                    </p>
                                </div>
                                <div class="space-y-2">
                                    <Label for="attachment_id_back"
                                        >身分證反面 <span class="text-red-500"
                                            >*</span
                                        ></Label
                                    >
                                    <Input
                                        id="attachment_id_back"
                                        name="attachment_id_back"
                                        type="file"
                                        accept="image/*,.pdf"
                                        required
                                    />
                                    <p class="text-xs text-muted-foreground">
                                        支援 JPG, PNG, PDF (最大 10MB)
                                    </p>
                                </div>
                                <div class="space-y-2">
                                    <Label for="attachment_bank_cover"
                                        >存摺封面 <span class="text-red-500"
                                            >*</span
                                        ></Label
                                    >
                                    <Input
                                        id="attachment_bank_cover"
                                        name="attachment_bank_cover"
                                        type="file"
                                        accept="image/*,.pdf"
                                        required
                                    />
                                    <p class="text-xs text-muted-foreground">
                                        需包含銀行帳號與戶名
                                    </p>
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
            </form>
        </Card.Content>
    </Card.Root>
</div>
