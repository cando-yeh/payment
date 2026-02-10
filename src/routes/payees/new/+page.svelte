<script lang="ts">
    /**
     * @file New Payee Request Page
     * @description Allows users to submit a request to create a new payee (Vendor or Personal).
     * The request is sent to the Finance team for approval.
     */
    import { enhance } from "$app/forms";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import * as Select from "$lib/components/ui/select";
    import * as Card from "$lib/components/ui/card";
    import { toast } from "svelte-sonner";
    import { ArrowLeft, Loader2 } from "lucide-svelte";
    import { goto } from "$app/navigation";

    // Component State
    let isLoading = $state(false);
    let payeeType = $state("vendor"); // "vendor" | "personal" - Controls dynamic form fields

    /**
     * Handles the form submission using SvelteKit's standard `enhance` action.
     * Manages loading state and displays toast notifications based on the result.
     */
    function handleSubmit() {
        isLoading = true;
        return async ({ result }: { result: any }) => {
            isLoading = false;

            if (result.type === "success") {
                toast.success("受款人申請已提交，請等待財務審核。");
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
        <h1 class="text-3xl font-bold tracking-tight">新增受款人</h1>
        <p class="text-muted-foreground mt-2">
            提交新的受款對象資料。送出後需經財務審核才可正式啟用。
        </p>
    </div>

    <Card.Root>
        <Card.Content class="pt-6">
            <form
                method="POST"
                action="?/createPayeeRequest"
                use:enhance={handleSubmit}
                class="space-y-6"
            >
                <!-- Type Selection -->
                <div class="space-y-3">
                    <Label>受款書類型</Label>
                    <div class="flex gap-4">
                        <Button
                            type="button"
                            variant={payeeType === "vendor"
                                ? "default"
                                : "outline"}
                            class="flex-1"
                            onclick={() => (payeeType = "vendor")}
                        >
                            廠商 (公司/行號)
                        </Button>
                        <Button
                            type="button"
                            variant={payeeType === "personal"
                                ? "default"
                                : "outline"}
                            class="flex-1"
                            onclick={() => (payeeType = "personal")}
                        >
                            個人 (勞務/領據)
                        </Button>
                    </div>
                    <!-- Hidden input for form submission -->
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
                                type="email"
                                placeholder="example@email.com"
                            />
                        </div>
                        <div class="space-y-2 md:col-span-2">
                            <Label for="address">戶籍/通訊地址</Label>
                            <Input
                                id="address"
                                name="address"
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

                <div class="flex justify-end pt-4">
                    <Button type="submit" disabled={isLoading}>
                        {#if isLoading}
                            <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                            提交中...
                        {:else}
                            提交申請
                        {/if}
                    </Button>
                </div>
            </form>
        </Card.Content>
    </Card.Root>
</div>
