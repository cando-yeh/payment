<script lang="ts">
    /**
     * UserProfileSheet.svelte
     *
     * 職責：
     * 1. 顯示並編輯使用者資訊（可用於個人設定或管理員編輯）。
     * 2. 處理銀行帳號的 AES-256 對稱解密與顯示。
     * 3. 透過 SvelteKit Form Actions 同步更新資料庫。
     */
    import { enhance } from "$app/forms";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Separator } from "$lib/components/ui/separator";
    // import { Switch } from "$lib/components/ui/switch"; // Removed as per instruction
    import * as Avatar from "$lib/components/ui/avatar";
    import * as Sheet from "$lib/components/ui/sheet";
    import * as Select from "$lib/components/ui/select";
    import { toast } from "svelte-sonner";
    import {
        User,
        Building2,
        CreditCard,
        Save,
        ShieldCheck,
        Eye,
        EyeOff,
        Users,
    } from "lucide-svelte";
    import { deserialize, applyAction } from "$app/forms";
    import { untrack } from "svelte";
    import { timedFetch } from "$lib/client/timed-fetch";
    import { cn } from "$lib/utils.js";

    // Props 定義
    let {
        user, // 目標使用者資料
        open = $bindable(false),
        isManagementMode = false, // 是否為管理員模式
        approverOptions = [], // 可選的核准人清單
    } = $props();

    // UI 狀態控制
    let loading = $state(false);

    /**
     * 銀行帳號安全性控制邏輯
     */
    let showAccountValue = $state(false);
    let decryptedAccount = $state<string | null>(null);
    let revealing = $state(false);

    /**
     * 表單本地狀態 (Svelte 5 Runes)
     */
    let fullName = $state("");
    let bankName = $state("");
    let inputBankAccount = $state("");
    let isAdmin = $state(false);
    let isFinance = $state(false);
    let approverId = $state("");

    // 監聽 user prop 變化並同步狀態
    $effect(() => {
        if (user) {
            fullName = user.full_name || user.name || "";
            bankName = user.bank || "";
            inputBankAccount = ""; // 切換使用者時重設輸入框
            isAdmin = user.is_admin || user.isAdmin || false;
            isFinance = user.is_finance || user.isFinance || false;
            approverId = user.approver_id || "";

            // 重設銀行帳號顯示狀態
            showAccountValue = false;
            decryptedAccount = null;
        }
    });

    /**
     * 強制同步效應
     */
    $effect(() => {
        fullName = user.full_name || user.name || "";
        bankName = user.bank || "";
        isAdmin = user.is_admin || user.isAdmin || false;
        isFinance = user.is_finance || user.isFinance || false;
        approverId = user.approver_id || "";
    });

    /**
     * 表單提交結果處理器
     */
    function handleResult() {
        return async ({ result }: { result: any }) => {
            loading = false;
            if (result.type === "success") {
                toast.success(
                    isManagementMode
                        ? "使用者資料已更新"
                        : "個人資料已成功更新",
                );
                await applyAction(result);
                decryptedAccount = null;
                showAccountValue = false;
                if (isManagementMode) open = false; // 管理模式下成功後關閉
            } else if (result.type === "failure") {
                toast.error(result.data?.message || "更新失敗，請稍後再試");
            }
        };
    }

    /**
     * 銀行帳號解密流程
     */
    async function toggleReveal() {
        if (!showAccountValue && !decryptedAccount) {
            revealing = true;
            try {
                // 如果是管理員模式，需要傳送目標 ID
                const formData = new FormData();
                if (isManagementMode) {
                    formData.append("targetId", user.id);
                }

                const actionPath = isManagementMode
                    ? "/admin/users?/revealUserBankAccount"
                    : "/account?/revealAccount";

                const response = await timedFetch(actionPath, {
                    method: "POST",
                    body: formData,
                });
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
     * 角色標籤產生器
     */
    function getRoleLabel() {
        const roles: string[] = [];
        if (isAdmin) roles.push("管理員");
        if (isFinance) roles.push("財務");
        if (user.isApprover) roles.push("主管");
        return roles.length > 0 ? roles.join(" / ") : "申請人";
    }

    // 當前的 Action 路徑
    let formAction = $derived(
        isManagementMode
            ? "/admin/users?/updateUserProfile"
            : "/account?/updateProfile",
    );
</script>

<Sheet.Root bind:open>
    <Sheet.Content class="sm:max-w-md overflow-y-auto">
        <Sheet.Header>
            <Sheet.Title
                >{isManagementMode ? "編輯使用者" : "個人帳戶設定"}</Sheet.Title
            >
            <Sheet.Description>
                {isManagementMode
                    ? "管理使用者的基本資訊、全域權限與核准流程。"
                    : "管理您的個人資訊與匯款帳號。變更將立即套用於系統。"}
            </Sheet.Description>
        </Sheet.Header>

        <div class="mt-8 space-y-8 pb-8">
            <!-- 使用者標頭區塊 -->
            <div class="flex flex-col items-center gap-4">
                <Avatar.Root
                    class="h-24 w-24 border-2 border-background shadow-md"
                >
                    {#if user.avatar_url || user.avatarUrl}
                        <Avatar.Image
                            src={user.avatar_url || user.avatarUrl}
                            alt={user.full_name || user.name}
                        />
                    {/if}
                    <Avatar.Fallback
                        class="bg-primary/5 text-2xl text-primary font-bold"
                    >
                        {(user.full_name || user.name || "?")
                            .charAt(0)
                            .toUpperCase()}
                    </Avatar.Fallback>
                </Avatar.Root>
                <div class="text-center">
                    <h3 class="text-lg font-semibold">
                        {user.full_name || user.name}
                    </h3>
                    <p class="text-sm text-muted-foreground">{user.email}</p>
                    <div
                        class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                    >
                        <ShieldCheck class="h-3.5 w-3.5" />
                        {getRoleLabel()}
                    </div>
                </div>
            </div>

            <Separator />

            <!-- 編輯表單 -->
            <form
                method="POST"
                action={formAction}
                use:enhance={() => {
                    loading = true;
                    return handleResult();
                }}
                class="space-y-6"
            >
                <!-- 隱藏欄位供管理員模式辨識目標 -->
                {#if isManagementMode}
                    <input type="hidden" name="userId" value={user.id} />
                {/if}

                <!-- 管理權限設定 (僅管理員模式顯示) -->
                {#if isManagementMode}
                    <div class="space-y-4">
                        <div
                            class="flex items-center gap-2 text-sm font-semibold"
                        >
                            <ShieldCheck class="h-4 w-4 text-primary" />
                            權限與角色
                        </div>
                        <div class="flex gap-2">
                            <Button
                                type="button"
                                variant={isAdmin ? "default" : "outline"}
                                class={cn(
                                    "flex-1 gap-2 transition-all",
                                    !isAdmin &&
                                        "text-muted-foreground opacity-60 grayscale",
                                )}
                                onclick={() => (isAdmin = !isAdmin)}
                            >
                                <ShieldCheck class="h-4 w-4" />
                                <span>系統管理員</span>
                            </Button>
                            <Button
                                type="button"
                                variant={isFinance ? "default" : "outline"}
                                class={cn(
                                    "flex-1 gap-2 transition-all",
                                    !isFinance &&
                                        "text-muted-foreground opacity-60 grayscale",
                                )}
                                onclick={() => (isFinance = !isFinance)}
                            >
                                <CreditCard class="h-4 w-4" />
                                <span>財務人員</span>
                            </Button>
                        </div>
                        <input
                            type="hidden"
                            name="isAdminValue"
                            value={isAdmin}
                        />
                        <input
                            type="hidden"
                            name="isFinanceValue"
                            value={isFinance}
                        />

                        <!-- 核准人設定 -->
                        <div class="grid gap-2">
                            <Label
                                for="approverId"
                                class="flex items-center gap-2"
                            >
                                <Users class="h-3.5 w-3.5" /> 核准人
                            </Label>
                            <Select.Root
                                type="single"
                                name="approverId"
                                bind:value={approverId}
                            >
                                <Select.Trigger id="approverId" class="w-full">
                                    {approverOptions.find(
                                        (o) => o.id === approverId,
                                    )?.full_name || "選擇核准人"}
                                </Select.Trigger>
                                <Select.Content>
                                    <Select.Item value="">(無)</Select.Item>
                                    {#each approverOptions.filter((o) => o.id !== user.id) as option}
                                        <Select.Item
                                            value={option.id}
                                            label={option.full_name}
                                        >
                                            {option.full_name}
                                        </Select.Item>
                                    {/each}
                                </Select.Content>
                            </Select.Root>
                            <input
                                type="hidden"
                                name="approverId"
                                value={approverId}
                            />
                            <p class="text-[0.7rem] text-muted-foreground">
                                該使用者提交請款時，將送往此核准人。
                            </p>
                        </div>
                    </div>

                    <Separator />
                {/if}

                <!-- 基本資料 -->
                <div class="space-y-4">
                    <div class="flex items-center gap-2 text-sm font-semibold">
                        <User class="h-4 w-4 text-primary" />
                        基本資料
                    </div>
                    <div class="grid gap-2">
                        <Label for="fullName">顯示姓名</Label>
                        <Input
                            id="fullName"
                            name="fullName"
                            bind:value={fullName}
                            placeholder="請輸入姓名"
                            required
                        />
                    </div>
                </div>

                <!-- 銀行帳號 -->
                <div class="space-y-4">
                    <div class="flex items-center gap-2 text-sm font-semibold">
                        <CreditCard class="h-4 w-4 text-primary" />
                        匯款帳號資訊
                    </div>
                    <div class="grid gap-2">
                        <Label for="bank">銀行</Label>
                        <div class="relative">
                            <Building2
                                class="absolute left-3 top-3 h-4 w-4 text-muted-foreground"
                            />
                            <Input
                                id="bank"
                                name="bank"
                                bind:value={bankName}
                                class="pl-9"
                                placeholder="例如：004-臺灣銀行"
                            />
                        </div>
                    </div>
                    <div class="grid gap-2">
                        <Label for="bankAccount">銀行帳號</Label>
                        <div class="relative">
                            <Input
                                id="bankAccount"
                                name="bankAccount"
                                type={showAccountValue ? "text" : "password"}
                                bind:value={inputBankAccount}
                                placeholder={showAccountValue
                                    ? decryptedAccount || "點擊眼睛解密..."
                                    : "••••••••••••"}
                                disabled={revealing}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                class="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                onclick={toggleReveal}
                            >
                                {#if revealing}
                                    <span
                                        class="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"
                                    ></span>
                                {:else if showAccountValue}
                                    <Eye
                                        class="h-4 w-4 text-muted-foreground"
                                    />
                                {:else}
                                    <EyeOff
                                        class="h-4 w-4 text-muted-foreground"
                                    />
                                {/if}
                            </Button>
                        </div>
                        <p
                            class="text-[0.7rem] text-muted-foreground leading-relaxed"
                        >
                            所有資訊均經 AES-256 對稱加密儲存。{#if isManagementMode}管理員可覆寫新帳號。{:else}若需修改請直接輸入新帳號。{/if}
                        </p>
                    </div>
                </div>

                <div
                    class="pt-4 sticky bottom-0 bg-background/80 backdrop-blur-sm pb-4"
                >
                    <Button
                        type="submit"
                        disabled={loading}
                        class="w-full gap-2 shadow-lg"
                    >
                        {#if loading}
                            <span
                                class="animate-spin h-4 w-4 border-2 border-background border-t-transparent rounded-full"
                            ></span>
                        {:else}
                            <Save class="h-4 w-4" />
                        {/if}
                        {isManagementMode ? "確認儲存變更" : "儲存並更新設定"}
                    </Button>
                </div>
            </form>
        </div>
    </Sheet.Content>
</Sheet.Root>
