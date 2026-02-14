<script lang="ts">
    import { enhance } from "$app/forms";
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import BankCodeCombobox from "$lib/components/layout/BankCodeCombobox.svelte";
    import * as Card from "$lib/components/ui/card";
    import * as Select from "$lib/components/ui/select";
    import {
        User,
        Building2,
        UserCheck,
        Plus,
        Trash2,
        ArrowLeft,
        Save,
    } from "lucide-svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    // State
    let claimType = $state<string | null>(null);
    let items = $state<any[]>([
        {
            date: "",
            category: "",
            description: "",
            amount: "",
            invoice_number: "",
        },
    ]);
    let payeeId = $state("");
    let isSubmitting = $state(false);

    // Floating Account State
    let isFloatingAccount = $state(false);
    let bankCode = $state("");
    let bankBranch = $state("");
    let bankAccount = $state("");
    let accountName = $state("");

    // Filter payees based on type
    let vendorPayees = $derived(
        data.payees?.filter((p) => p.type === "vendor") || [],
    );
    let personalPayees = $derived(
        data.payees?.filter((p) => p.type === "personal") || [],
    );

    // Total Amount Calculation
    let totalAmount = $derived(
        items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    );

    function selectType(type: string) {
        claimType = type;
        // Reset items slightly based on type if needed
        items = [
            {
                date: new Date().toISOString().split("T")[0],
                category: "general",
                description: "",
                amount: "",
                invoice_number: "",
            },
        ];
    }

    function addItem() {
        items = [
            ...items,
            {
                date: new Date().toISOString().split("T")[0],
                category: "general",
                description: "",
                amount: "",
                invoice_number: "",
            },
        ];
    }

    function removeItem(index: number) {
        if (items.length > 1) {
            items = items.filter((_, i) => i !== index);
        }
    }

    const categories = [
        { value: "travel", label: "差旅費" },
        { value: "food", label: "伙食費" },
        { value: "general", label: "一般雜支" }, // More categories to come
    ];
</script>

<div class="container mx-auto py-8 max-w-4xl">
    <Button
        variant="ghost"
        class="mb-4"
        onclick={() => (claimType ? (claimType = null) : goto("/claims"))}
    >
        <ArrowLeft class="mr-2 h-4 w-4" />
        {claimType ? "重新選擇類型" : "返回列表"}
    </Button>

    {#if !claimType}
        <div class="text-center mb-8">
            <h1 class="text-3xl font-bold tracking-tight text-primary">
                建立新請款單
            </h1>
            <p class="text-muted-foreground mt-2">請選擇您要申請的款項類型</p>
        </div>

        <div class="grid gap-6 md:grid-cols-3">
            <Card.Root
                class="cursor-pointer hover:border-primary transition-all hover:shadow-md"
                onclick={() => selectType("employee")}
            >
                <Card.Header>
                    <div class="mx-auto bg-blue-100 p-4 rounded-full mb-4">
                        <User class="h-8 w-8 text-blue-600" />
                    </div>
                    <Card.Title class="text-center">員工費用報銷</Card.Title>
                    <Card.Description class="text-center"
                        >適用於差旅、交際費、教育訓練等代墊款項</Card.Description
                    >
                </Card.Header>
            </Card.Root>

            <Card.Root
                class="cursor-pointer hover:border-primary transition-all hover:shadow-md"
                onclick={() => selectType("vendor")}
            >
                <Card.Header>
                    <div class="mx-auto bg-green-100 p-4 rounded-full mb-4">
                        <Building2 class="h-8 w-8 text-green-600" />
                    </div>
                    <Card.Title class="text-center">廠商請款</Card.Title>
                    <Card.Description class="text-center"
                        >適用於支付供應商、外包廠商之貨款或服務費</Card.Description
                    >
                </Card.Header>
            </Card.Root>

            <Card.Root
                class="cursor-pointer hover:border-primary transition-all hover:shadow-md"
                onclick={() => selectType("personal_service")}
            >
                <Card.Header>
                    <div class="mx-auto bg-purple-100 p-4 rounded-full mb-4">
                        <UserCheck class="h-8 w-8 text-purple-600" />
                    </div>
                    <Card.Title class="text-center">個人勞務報酬</Card.Title>
                    <Card.Description class="text-center"
                        >適用於計時人員、顧問費、演講費等個人所得</Card.Description
                    >
                </Card.Header>
            </Card.Root>
        </div>
    {:else}
        <form
            method="POST"
            action="?/create"
            use:enhance={() => {
                isSubmitting = true;
                return async ({ result, update }) => {
                    isSubmitting = false;
                    if (result.type === "redirect") {
                        goto(result.location);
                        return;
                    }
                    await update();
                };
            }}
        >
            <input type="hidden" name="claim_type" value={claimType} />
            <input type="hidden" name="items" value={JSON.stringify(items)} />

            <div class="flex items-center justify-between mb-6">
                <div>
                    <h1 class="text-2xl font-bold flex items-center gap-2">
                        {#if claimType === "employee"}
                            <User class="h-6 w-6 text-blue-600" /> 員工費用報銷
                        {:else if claimType === "vendor"}
                            <Building2 class="h-6 w-6 text-green-600" /> 廠商請款
                        {:else}
                            <UserCheck class="h-6 w-6 text-purple-600" /> 個人勞務報酬
                        {/if}
                    </h1>
                </div>
                <div class="flex items-center gap-2">
                    <Button type="submit" disabled={isSubmitting}>
                        {#if isSubmitting}
                            <span class="mr-2">儲存中...</span>
                        {:else}
                            <Save class="mr-2 h-4 w-4" />
                            儲存草稿
                        {/if}
                    </Button>
                </div>
            </div>

            <div class="grid gap-6">
                <!-- Main Info Card -->
                <Card.Root>
                    <Card.Header><Card.Title>基本資訊</Card.Title></Card.Header>
                    <Card.Content class="grid gap-4">
                        {#if claimType !== "employee"}
                            <div class="grid gap-2">
                                <Label
                                    >收款對象 <span class="text-red-500">*</span
                                    ></Label
                                >
                                <select
                                    name="payee_id"
                                    class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    required
                                    bind:value={payeeId}
                                >
                                    <option value="" disabled selected
                                        >請選擇收款人...</option
                                    >
                                    {#if claimType === "vendor"}
                                        {#each vendorPayees as payee}
                                            <option value={payee.id}
                                                >{payee.name} (統編: {payee.tax_id ||
                                                    "-"})</option
                                            >
                                        {/each}
                                    {:else}
                                        {#each personalPayees as payee}
                                            <option value={payee.id}
                                                >{payee.name} (ID: {payee.tax_id ||
                                                    "-"})</option
                                            >
                                        {/each}
                                    {/if}
                                </select>
                                <p class="text-xs text-muted-foreground">
                                    找不到收款人？前往 <a
                                        href="/payees/new"
                                        target="_blank"
                                        class="underline text-primary"
                                        >新增收款人</a
                                    > (完成後請重新整理)
                                </p>
                            </div>
                            <div class="space-y-2">
                                <Label for="payee">收款人</Label>
                                <Select.Root
                                    type="single"
                                    bind:value={payeeId}
                                    onValueChange={() => {
                                        // Reset floating account when payee changes
                                        isFloatingAccount = false;
                                        bankCode = "";
                                        bankBranch = "";
                                        bankAccount = ""; // Clear
                                        accountName = "";
                                    }}
                                >
                                    <Select.Trigger class="w-full">
                                        {vendorPayees.find(
                                            (p) => p.id === payeeId,
                                        )?.name ||
                                            personalPayees.find(
                                                (p) => p.id === payeeId,
                                            )?.name ||
                                            "選擇收款人"}
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
                            </div>

                            <!-- Floating Account Handling -->
                            {#if payeeId}
                                <div
                                    class="border rounded-lg p-4 bg-muted/20 space-y-4"
                                >
                                    <div class="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            id="is_floating_account"
                                            name="is_floating_account"
                                            value="true"
                                            bind:checked={isFloatingAccount}
                                            class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                        <Label
                                            for="is_floating_account"
                                            class="cursor-pointer font-medium"
                                            >指定本次匯款帳號 (浮動帳號)</Label
                                        >
                                    </div>

                                    {#if isFloatingAccount}
                                        <div
                                            class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2"
                                        >
                                            <div class="space-y-2">
                                                <Label for="bank_code"
                                                    >銀行代碼 (必填)</Label
                                                >
                                                <BankCodeCombobox
                                                    id="bank_code"
                                                    name="bank_code"
                                                    bind:value={bankCode}
                                                    placeholder="例如：004"
                                                    required
                                                />
                                            </div>
                                            <div class="space-y-2">
                                                <Label for="bank_branch"
                                                    >分行代碼 (選填)</Label
                                                >
                                                <Input
                                                    id="bank_branch"
                                                    name="bank_branch"
                                                    bind:value={bankBranch}
                                                    placeholder="例如：001"
                                                    maxlength={4}
                                                />
                                            </div>
                                            <div class="space-y-2">
                                                <Label for="account_name"
                                                    >戶名 (必填)</Label
                                                >
                                                <Input
                                                    id="account_name"
                                                    name="account_name"
                                                    bind:value={accountName}
                                                    placeholder="請輸入銀行戶名"
                                                    required
                                                />
                                            </div>
                                            <div class="space-y-2">
                                                <Label for="bank_account"
                                                    >銀行帳號 (必填)</Label
                                                >
                                                <Input
                                                    id="bank_account"
                                                    name="bank_account"
                                                    bind:value={bankAccount}
                                                    placeholder="請輸入銀行帳號"
                                                    required
                                                />
                                                <p
                                                    class="text-xs text-muted-foreground"
                                                >
                                                    此帳號僅套用於本次請款，並將加密儲存。
                                                </p>
                                            </div>
                                        </div>
                                    {/if}
                                </div>
                            {/if}
                        {/if}
                    </Card.Content>
                </Card.Root>

                <!-- Line Items Card -->
                <Card.Root>
                    <Card.Header
                        class="flex flex-row items-center justify-between"
                    >
                        <Card.Title>費用明細</Card.Title>
                        <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onclick={addItem}
                        >
                            <Plus class="mr-2 h-4 w-4" /> 新增明細
                        </Button>
                    </Card.Header>
                    <Card.Content>
                        <div class="space-y-4">
                            {#each items as item, i}
                                <div
                                    class="grid grid-cols-12 gap-4 items-end border-b pb-4 last:border-0"
                                >
                                    <div class="col-span-2">
                                        <Label class="text-xs">日期</Label>
                                        <Input
                                            type="date"
                                            required
                                            bind:value={item.date}
                                        />
                                    </div>
                                    <div class="col-span-2">
                                        <Label class="text-xs">類別</Label>
                                        <select
                                            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            bind:value={item.category}
                                        >
                                            {#each categories as cat}
                                                <option value={cat.value}
                                                    >{cat.label}</option
                                                >
                                            {/each}
                                        </select>
                                    </div>
                                    <div class="col-span-3">
                                        <Label class="text-xs">說明</Label>
                                        <Input
                                            placeholder="項目說明"
                                            bind:value={item.description}
                                        />
                                    </div>
                                    <div class="col-span-2">
                                        <Label class="text-xs">發票號碼</Label>
                                        <Input
                                            placeholder="AB-12345678"
                                            bind:value={item.invoice_number}
                                        />
                                    </div>
                                    <div class="col-span-2">
                                        <Label class="text-xs">金額</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            required
                                            bind:value={item.amount}
                                        />
                                    </div>
                                    <div class="col-span-1 flex justify-end">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            type="button"
                                            onclick={() => removeItem(i)}
                                            disabled={items.length === 1}
                                        >
                                            <Trash2
                                                class="h-4 w-4 text-destructive"
                                            />
                                        </Button>
                                    </div>
                                </div>
                            {/each}
                        </div>
                        <div
                            class="mt-6 flex justify-end items-center text-lg font-bold"
                        >
                            總金額：NT$ {new Intl.NumberFormat("en-US").format(
                                totalAmount,
                            )}
                        </div>
                    </Card.Content>
                </Card.Root>

                <div
                    class="bg-blue-50 p-4 rounded-md text-sm text-blue-800 border border-blue-200"
                >
                    <p class="font-bold mb-1">💡 提示：</p>
                    <p>請先儲存草稿，儲存後即可上傳相關憑證與附件。</p>
                </div>
            </div>
        </form>
    {/if}
</div>
