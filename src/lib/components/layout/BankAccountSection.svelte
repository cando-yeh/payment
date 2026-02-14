<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import BankCodeCombobox from "$lib/components/layout/BankCodeCombobox.svelte";
    import { Check, CreditCard, Eye, EyeOff, X } from "lucide-svelte";

    let {
        mode = "management" as "management" | "self",
        isEditing = false,
        isAddingBankAccount = false,
        hasBankInfo = true,
        bankName = $bindable(""),
        inputBankAccount = $bindable(""),
        maskedAccountTail = "",
        decryptedAccount = null as string | null,
        showAccountValue = false,
        revealing = false,
        onToggleReveal = async () => {},
        onStartAddingBankAccount = () => {},
        onCancelAddingBankAccount = () => {},
        onSaveAddingBankAccount = () => {},
        loading = false,
    } = $props();

    const isManagement = mode === "management";
</script>

<div class="space-y-3">
    <div class="flex items-center gap-2 text-sm font-semibold">
        <CreditCard class="h-4 w-4 text-primary" />
        匯款帳號資訊
    </div>

    {#if isManagement || hasBankInfo || isAddingBankAccount}
        <div class="flex gap-4">
            <div class="flex-[2] space-y-2 min-w-0">
                <Label for={isManagement ? "bank" : "self-bank"}>銀行代碼</Label>
                <BankCodeCombobox
                    id={isManagement ? "bank" : "self-bank"}
                    name={isManagement ? "bankName" : "bank"}
                    disabled={isManagement ? !isEditing : !isAddingBankAccount}
                    bind:value={bankName}
                    submitMode="code-name"
                />
            </div>
            <div class="flex-[3] space-y-2 min-w-0">
                <Label for={isManagement ? "bankAccount" : "self-bankAccount"}
                    >銀行帳號</Label
                >
                <div class="relative">
                    {#if isManagement && isEditing}
                        <Input
                            id="bankAccount"
                            name="bankAccount"
                            type={showAccountValue ? "text" : "password"}
                            bind:value={inputBankAccount}
                            placeholder={showAccountValue
                                ? decryptedAccount || "請輸入新帳號..."
                                : "••••••••••••"}
                            disabled={revealing}
                        />
                    {:else if !isManagement && isAddingBankAccount}
                        <Input
                            id="self-bankAccount"
                            name="bankAccount"
                            type={showAccountValue ? "text" : "password"}
                            bind:value={inputBankAccount}
                            placeholder={showAccountValue
                                ? inputBankAccount || "請輸入銀行帳號"
                                : "••••••••••••"}
                            disabled={revealing}
                        />
                    {:else}
                        <Input
                            id={isManagement ? "bankAccount" : "self-bankAccount"}
                            type={showAccountValue ? "text" : "password"}
                            value={showAccountValue
                                ? decryptedAccount || maskedAccountTail
                                : maskedAccountTail || "••••••••••••"}
                            readonly
                            disabled
                            class={isManagement ? "pointer-events-none" : ""}
                        />
                    {/if}

                    {#if isManagement && !isEditing}
                        <span
                            class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none"
                            aria-hidden="true"
                        >
                            <EyeOff class="h-4 w-4" />
                        </span>
                    {:else}
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            class="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onclick={() => void onToggleReveal()}
                            disabled={revealing}
                            aria-label={showAccountValue
                                ? "隱藏銀行帳號"
                                : "顯示銀行帳號"}
                        >
                            {#if revealing}
                                <span
                                    class="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"
                                ></span>
                            {:else if showAccountValue}
                                <EyeOff class="h-4 w-4 text-muted-foreground" />
                            {:else}
                                <Eye class="h-4 w-4 text-muted-foreground" />
                            {/if}
                        </Button>
                    {/if}
                </div>
            </div>
        </div>
    {:else}
        <div class="rounded-md border border-dashed p-4 space-y-2">
            <p class="text-sm text-muted-foreground">尚未設定銀行帳號</p>
            <Button
                type="button"
                variant="outline"
                onclick={onStartAddingBankAccount}
            >
                新增銀行帳號
            </Button>
        </div>
    {/if}

    <p class="text-[0.7rem] text-muted-foreground leading-relaxed">
        銀行資訊均經 AES-256 對稱加密儲存，除新增外僅管理員可修改銀行資訊。
    </p>

    {#if !isManagement && isAddingBankAccount}
        <div class="flex items-center justify-end gap-2 pt-1">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                onclick={onCancelAddingBankAccount}
                disabled={loading}
                aria-label="取消新增銀行帳號"
            >
                <X class="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                onclick={onSaveAddingBankAccount}
                disabled={loading}
                aria-label="儲存銀行帳號"
            >
                <Check class="h-4 w-4 text-primary" />
            </Button>
        </div>
    {/if}
</div>
