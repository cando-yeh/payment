<script lang="ts">
    import { enhance } from "$app/forms";
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { untrack } from "svelte";
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

    interface Claim {
        id: string;
        claim_type: string;
        payee_id: string;
        total_amount: number;
        status: string;
        bank_code?: string;
        bank_branch?: string;
        bank_account?: string;
        account_name?: string;
        items: any;
    }

    interface Payee {
        id: string;
        name: string;
        type: string;
        tax_id?: string;
    }

    let { data }: { data: PageData & { claim: Claim; payees: Payee[] } } =
        $props();

    // Initialize State from Data using untrack to avoid reactive warnings
    let claimType = $state(untrack(() => data.claim.claim_type));
    let payeeId = $state(untrack(() => data.claim.payee_id));

    // Parse items and ensure at least one empty item if empty
    let items = $state<any[]>(
        untrack(() => {
            let parsed = Array.isArray(data.claim.items)
                ? data.claim.items
                : JSON.parse(data.claim.items || "[]");
            if (parsed.length === 0) {
                return [
                    {
                        date: new Date().toISOString().split("T")[0],
                        category: "general",
                        description: "",
                        amount: "",
                        invoice_number: "",
                    },
                ];
            }
            return parsed;
        }),
    );

    // Floating Account State
    let isFloatingAccount = $state(untrack(() => !!data.claim.bank_code));
    let bankCode = $state(untrack(() => data.claim.bank_code || ""));
    let bankBranch = $state(untrack(() => data.claim.bank_branch || ""));
    let bankAccount = $state(untrack(() => data.claim.bank_account || ""));
    let accountName = $state(untrack(() => data.claim.account_name || ""));

    // Sync state when data changes (e.g. navigation)
    $effect(() => {
        claimType = data.claim.claim_type;
        payeeId = data.claim.payee_id;

        let newItems = Array.isArray(data.claim.items)
            ? data.claim.items
            : JSON.parse(data.claim.items || "[]");

        if (newItems.length === 0) {
            items = [
                {
                    date: new Date().toISOString().split("T")[0],
                    category: "general",
                    description: "",
                    amount: "",
                    invoice_number: "",
                },
            ];
        } else {
            items = newItems;
        }

        isFloatingAccount = !!data.claim.bank_code;
        bankCode = data.claim.bank_code || "";
        bankBranch = data.claim.bank_branch || "";
        bankAccount = data.claim.bank_account || "";
        accountName = data.claim.account_name || "";
    });

    let isSubmitting = $state(false);

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
        { value: "general", label: "一般雜支" },
    ];
</script>

<div class="container mx-auto py-8 max-w-4xl">
    <Button variant="ghost" class="mb-4" href="/claims/{data.claim.id}">
        <ArrowLeft class="mr-2 h-4 w-4" />
        返回詳情
    </Button>

    <form
        method="POST"
        action="?/update"
        use:enhance={() => {
            isSubmitting = true;
            return async ({ update }) => {
                isSubmitting = false;
                await update();
            };
        }}
    >
        <input type="hidden" name="claim_type" value={claimType} />
        <input type="hidden" name="items" value={JSON.stringify(items)} />
        <input type="hidden" name="total_amount" value={totalAmount} />

        <div class="flex items-center justify-between mb-6">
            <div>
                <h1 class="text-2xl font-bold flex items-center gap-2">
                    {#if claimType === "employee"}
                        <User class="h-6 w-6 text-blue-600" /> 員工費用報銷 (編輯)
                    {:else if claimType === "vendor"}
                        <Building2 class="h-6 w-6 text-green-600" /> 廠商請款 (編輯)
                    {:else}
                        <UserCheck class="h-6 w-6 text-purple-600" /> 個人勞務報酬
                        (編輯)
                    {/if}
                </h1>
                <p class="text-sm text-muted-foreground mt-1">
                    單號: {data.claim.id}
                </p>
            </div>
            <div class="flex items-center gap-2">
                <Button type="submit" disabled={isSubmitting}>
                    {#if isSubmitting}
                        <span class="mr-2">儲存中...</span>
                    {:else}
                        <Save class="mr-2 h-4 w-4" />
                        儲存變更
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
                        <div class="space-y-2">
                            <Label for="payee">收款人</Label>
                            <!-- We use hidden input for form submission, Select for UI -->
                            <input
                                type="hidden"
                                name="payee_id"
                                value={payeeId}
                            />

                            <Select.Root
                                type="single"
                                bind:value={payeeId}
                                onValueChange={(v) => {
                                    // Reset floating account when payee changes
                                    isFloatingAccount = false;
                                    bankCode = "";
                                    bankBranch = "";
                                    bankAccount = ""; // Clear
                                    accountName = "";
                                }}
                            >
                                <Select.Trigger class="w-full">
                                    {vendorPayees.find((p) => p.id === payeeId)
                                        ?.name ||
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
                                        id="is_floating"
                                        name="is_floating"
                                        bind:checked={isFloatingAccount}
                                        class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <Label
                                        for="is_floating"
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

            <!-- Line Items Card (Existing logic reuse) -->
            <Card.Root>
                <Card.Header class="flex flex-row items-center justify-between">
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
        </div>
    </form>
</div>
