<script lang="ts">
    /**
     * @file Edit Payee Request Page
     * @description Allows users to submit a request to update an existing payee.
     */
    import { enhance } from "$app/forms";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import * as Card from "$lib/components/ui/card";
    import { toast } from "svelte-sonner";
    import { ArrowLeft, LoaderCircle } from "lucide-svelte";
    import { goto } from "$app/navigation";

    let { data } = $props();
    let payee = $derived(data.payee);

    // Component State
    let isLoading = $state(false);
    let payeeType = $derived(data.payee.type || "vendor");

    function handleSubmit() {
        isLoading = true;
        return async ({ result }: { result: any }) => {
            isLoading = false;

            if (result.type === "success") {
                toast.success("更新申請已提交，請等待財務審核。");
                goto("/payees");
            } else if (result.type === "redirect") {
                goto(result.location);
            } else {
                toast.error(result.data?.message || "提交失敗，請稍後再試。");
            }
        };
    }
</script>

<div class="container max-w-2xl py-10">
    <Button
        variant="ghost"
        class="mb-4 pl-0 hover:bg-transparent"
        onclick={() => history.back()}
    >
        <ArrowLeft class="mr-2 h-4 w-4" />
        返回列表
    </Button>

    <div class="mb-8">
        <h1 class="text-3xl font-bold tracking-tight">編輯受款人</h1>
        <p class="text-muted-foreground mt-2">
            修改受款對象資料。送出後將建立異動申請，需經財務審核通過後才會更新正式資料。
        </p>
    </div>

    <Card.Root>
        <Card.Content class="pt-6">
            <form
                method="POST"
                action="?/updatePayeeRequest"
                use:enhance={handleSubmit}
                class="space-y-6"
            >
                <!-- Type (Locked in edit usually, but showing as info) -->
                <div class="space-y-3">
                    <Label>受款書類型</Label>
                    <div class="flex gap-4">
                        <Button
                            type="button"
                            variant={payeeType === "vendor"
                                ? "default"
                                : "outline"}
                            class="flex-1"
                            disabled
                        >
                            廠商 (公司/行號)
                        </Button>
                        <Button
                            type="button"
                            variant={payeeType === "personal"
                                ? "default"
                                : "outline"}
                            class="flex-1"
                            disabled
                        >
                            個人 (勞務/領據)
                        </Button>
                    </div>
                    <input type="hidden" name="type" value={payeeType} />
                </div>

                <div class="grid gap-4 md:grid-cols-2">
                    <!-- Common Fields -->
                    <div class="space-y-2 md:col-span-2">
                        <Label for="name"
                            >受款人名稱 <span class="text-red-500">*</span
                            ></Label
                        >
                        <Input
                            id="name"
                            name="name"
                            value={payee.name}
                            placeholder={payeeType === "vendor"
                                ? "公司全名"
                                : "真實姓名"}
                            required
                        />
                    </div>

                    <!-- Vendor Specific -->
                    {#if payeeType === "vendor"}
                        <div class="space-y-2">
                            <Label for="tax_id"
                                >統一編號 (8碼) <span class="text-red-500"
                                    >*</span
                                ></Label
                            >
                            <Input
                                id="tax_id"
                                name="tax_id"
                                value={payee.tax_id || ""}
                                placeholder="12345678"
                                maxlength={8}
                                required
                            />
                        </div>
                        <div class="space-y-2 md:col-span-2">
                            <Label for="service_description">服務項目說明</Label
                            >
                            <Input
                                id="service_description"
                                name="service_description"
                                value={payee.service_description || ""}
                                placeholder="例：網站維護費、辦公室租賃..."
                            />
                        </div>
                    {/if}

                    <!-- Personal Specific -->
                    {#if payeeType === "personal"}
                        <div class="space-y-2">
                            <Label for="tax_id"
                                >身分證字號 <span class="text-red-500">*</span
                                ></Label
                            >
                            <Input
                                id="id_number"
                                name="tax_id"
                                value={payee.tax_id || ""}
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
                                value={payee.extra_info?.email || ""}
                                type="email"
                                placeholder="example@email.com"
                            />
                        </div>
                        <div class="space-y-2 md:col-span-2">
                            <Label for="address">戶籍/通訊地址</Label>
                            <Input
                                id="address"
                                name="address"
                                value={payee.extra_info?.address || ""}
                                placeholder="請填寫完整地址"
                            />
                        </div>
                    {/if}
                </div>

                <div class="border-t pt-4">
                    <h3 class="font-semibold mb-4">銀行匯款資訊</h3>
                    <div class="grid gap-4 md:grid-cols-2">
                        <div class="space-y-2">
                            <Label for="bank_code"
                                >銀行代碼 (3碼) <span class="text-red-500"
                                    >*</span
                                ></Label
                            >
                            <Input
                                id="bank_code"
                                name="bank_code"
                                value={payee.bank || ""}
                                placeholder="004"
                                maxlength={3}
                                required
                            />
                        </div>
                        <div class="space-y-2">
                            <Label for="bank_account"
                                >銀行帳號 <span class="text-red-500">*</span
                                ></Label
                            >
                            <Input
                                id="bank_account"
                                name="bank_account"
                                value={payee.bank_account || ""}
                                type={payee.bank_account ? "password" : "text"}
                                placeholder="請輸入帳號"
                                required
                            />
                            {#if !data.is_finance}
                                <p class="text-xs text-muted-foreground mt-1">
                                    注意：非財務人員無法看到原始內容，若要變更請直接輸入新帳號。
                                </p>
                            {/if}
                        </div>
                    </div>
                </div>

                <div class="border-t pt-4 space-y-2">
                    <Label for="reason"
                        >變更原因說明 <span class="text-red-500">*</span></Label
                    >
                    <Textarea
                        id="reason"
                        name="reason"
                        placeholder="請簡述此次資料更新的原因（如：廠商變更銀行帳戶）"
                        required
                    />
                </div>

                <div class="flex justify-end pt-4 gap-3">
                    <Button
                        variant="outline"
                        type="button"
                        onclick={() => history.back()}>取消</Button
                    >
                    <Button type="submit" disabled={isLoading}>
                        {#if isLoading}
                            <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
                            提交中...
                        {:else}
                            送出更新申請
                        {/if}
                    </Button>
                </div>
            </form>
        </Card.Content>
    </Card.Root>
</div>
