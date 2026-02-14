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
    import { page } from "$app/state";
    import { cn } from "$lib/utils.js";
    import { invalidateAll } from "$app/navigation";
    import BankCodeCombobox from "$lib/components/layout/BankCodeCombobox.svelte";

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
    let isEditing = $state(false);
    let isAdmin = $state(false);
    let isFinance = $state(false);
    let approverId = $state("");
    let initializedUserId = $state<string | null>(null);

    function resetFormFromUser() {
        fullName = user?.full_name || user?.name || "";
        bankName = user?.bank || "";
        inputBankAccount = "";
        isAdmin = user?.is_admin || user?.isAdmin || false;
        isFinance = user?.is_finance || user?.isFinance || false;
        approverId = user?.approver_id || "";
        showAccountValue = false;
        decryptedAccount = null;
    }

    async function refreshUserSnapshot() {
        if (!open || !user?.id) return;

        try {
            const formData = new FormData();
            if (isManagementMode) {
                formData.append("targetId", user.id);
            }

            const actionPath = isManagementMode
                ? "/admin/users?/getUserProfileSnapshot"
                : "/account?/getMyProfileSnapshot";

            const response = await timedFetch(actionPath, {
                method: "POST",
                body: formData,
                headers: { "x-sveltekit-action": "true" },
            });
            const text = await response.text();
            const result = deserialize(text) as any;

            if (
                response.ok &&
                result?.type === "success" &&
                result?.data?.profile
            ) {
                user = { ...user, ...result.data.profile };
                if (!isEditing) {
                    resetFormFromUser();
                }
            }
        } catch {
            // 保持目前畫面資料，不中斷使用者操作
        }
    }

    // 從應用程式狀態獲取當前登入者 ID
    const currentUserId = $derived(
        page.data.currentUserId || page.data.session?.user?.id,
    );
    const currentUserEmail = $derived(page.data.session?.user?.email);

    // 判斷是否為本人：比對 ID 或 Email（增加魯棒性）
    const isSelf = $derived(
        user?.id === currentUserId ||
            (user?.email &&
                currentUserEmail &&
                user.email === currentUserEmail),
    );
    const maskedAccountTail = $derived.by(() => {
        const rawTail = String(
            user?.bank_account_tail || user?.bankAccountTail || "",
        ).trim();
        if (!rawTail) return "";
        return `*****${rawTail.slice(-5)}`;
    });

    // 僅在切換「不同使用者」時重置編輯狀態，避免同一使用者快照更新把編輯模式關掉。
    $effect(() => {
        if (!user?.id) return;

        if (initializedUserId !== user.id) {
            initializedUserId = user.id;
            resetFormFromUser();
            isEditing = false;
            return;
        }

        if (!isEditing) {
            resetFormFromUser();
        }
    });

    // 關閉視窗時，丟棄未儲存變更並回到檢視模式。
    $effect(() => {
        if (!open && user) {
            resetFormFromUser();
            isEditing = false;
        }
    });

    // 每次打開 Drawer 時，主動讀取最新 profile，避免不同入口看到舊快照。
    $effect(() => {
        if (open) {
            void untrack(() => refreshUserSnapshot());
        }
    });

    /**
     * 強制同步效應
     */

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
                // 管理員模式使用本地 users 清單，需主動重抓避免顯示舊資料。
                if (isManagementMode) {
                    await invalidateAll();
                }
                decryptedAccount = null;
                showAccountValue = false;
                if (isManagementMode) open = false; // 管理模式下成功後關閉
            } else if (result.type === "failure") {
                toast.error(result.data?.message || "更新失敗，請稍後再試");
            }
        };
    }

    /**
     * 編輯模式控制
     */
    async function startEditing() {
        isEditing = true;
        // 進入編輯模式時，自動揭露銀行帳號
        if (!decryptedAccount) {
            await toggleReveal();
        } else {
            showAccountValue = true;
        }
    }

    function cancelEditing() {
        isEditing = false;
        resetFormFromUser();
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
        return roles.length > 0 ? roles.join(" / ") : "員工";
    }

    // 當前的 Action 路徑
    let formAction = $derived(
        isManagementMode
            ? "/admin/users?/updateUserProfile"
            : "/account?/updateProfile",
    );
</script>

<Sheet.Root bind:open>
    <Sheet.Content class="sm:max-w-sm overflow-y-auto">
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

        <div class="mt-4 space-y-4 pb-4">
            <!-- 使用者標頭區塊 -->
            <div class="flex flex-col items-center gap-4">
                <Avatar.Root
                    class="h-16 w-16 border-2 border-background shadow-md"
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
                <div class="text-center w-full px-4">
                    {#if isEditing && isSelf}
                        <div class="space-y-1">
                            <Input
                                name="fullName"
                                bind:value={fullName}
                                class="text-center text-lg font-semibold h-9 bg-muted/50 border-primary/20 focus:bg-background transition-colors"
                                placeholder="請輸入姓名"
                                required
                            />
                            <p class="text-[0.7rem] text-muted-foreground">
                                編輯您的顯示名稱
                            </p>
                        </div>
                    {:else}
                        <h3 class="text-lg font-semibold">
                            {user.full_name || user.name}
                        </h3>
                    {/if}
                    <p class="text-sm text-muted-foreground">{user.email}</p>
                    <div
                        class="mt-1 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[0.65rem] font-medium text-primary"
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
                class="space-y-4"
            >
                <!-- 隱藏欄位供管理員模式辨識目標 -->
                {#if isManagementMode}
                    <input type="hidden" name="userId" value={user.id} />
                {/if}
                <input type="hidden" name="isAdminValue" value={isAdmin} />

                <!-- 管理權限設定 (僅管理員模式顯示) -->
                {#if isManagementMode}
                    <div class="space-y-2">
                        <div class="flex items-end gap-2">
                            <div
                                class="flex-[2] flex items-center gap-2 text-sm font-semibold h-5"
                            >
                                <ShieldCheck class="h-4 w-4 text-primary" />
                                權限與角色
                            </div>
                            <div class="flex-[2] min-w-0">
                                <Label
                                    for="approverId"
                                    class="flex-[2] flex items-center gap-2 text-sm font-semibold h-5"
                                >
                                    <Users class="h-4 w-4 text-primary" />
                                    核准人
                                </Label>
                            </div>
                        </div>

                        <div class="flex gap-2 items-end">
                            <div class="flex-[2] flex gap-2">
                                <Button
                                    type="button"
                                    variant={isAdmin ? "default" : "outline"}
                                    disabled={!isEditing}
                                    class={cn(
                                        "flex-1 gap-2 transition-all h-9",
                                        !isAdmin &&
                                            "text-muted-foreground opacity-60 grayscale",
                                    )}
                                    onclick={() => (isAdmin = !isAdmin)}
                                >
                                    <ShieldCheck class="h-4 w-4" />
                                    <span class="hidden sm:inline">管理員</span>
                                    <span class="sm:hidden">管理員</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant={isFinance ? "default" : "outline"}
                                    disabled={!isEditing}
                                    class={cn(
                                        "flex-1 gap-2 transition-all h-9",
                                        !isFinance &&
                                            "text-muted-foreground opacity-60 grayscale",
                                    )}
                                    onclick={() => (isFinance = !isFinance)}
                                >
                                    <CreditCard class="h-4 w-4" />
                                    <span class="hidden sm:inline">財務</span>
                                    <span class="sm:hidden">財務</span>
                                </Button>
                            </div>
                            <div class="flex-[2] min-w-0">
                                <Select.Root
                                    type="single"
                                    name="approverId"
                                    disabled={!isEditing}
                                    bind:value={approverId}
                                >
                                    <Select.Trigger
                                        id="approverId"
                                        class={cn(
                                            "w-full h-10",
                                            !isEditing &&
                                                "pointer-events-none hover:bg-transparent dark:hover:bg-transparent transition-none",
                                        )}
                                    >
                                        <div
                                            class="flex items-center gap-2 truncate"
                                        >
                                            <span class="truncate">
                                                {approverOptions.find(
                                                    (o) => o.id === approverId,
                                                )?.full_name || "設定核准人"}
                                            </span>
                                        </div>
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
                                        {:else}
                                            <div
                                                class="p-2 text-xs text-muted-foreground"
                                            >
                                                無預設項目
                                            </div>
                                        {/each}
                                    </Select.Content>
                                </Select.Root>
                            </div>
                        </div>
                        <p
                            class="text-[0.7rem] text-muted-foreground text-right"
                        >
                            該使用者提交請款時，將送往此核准人。
                        </p>
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
                    </div>

                    <Separator />
                {/if}

                <!-- 銀行帳號 -->
                <div class="space-y-3">
                    <div class="flex items-center gap-2 text-sm font-semibold">
                        <CreditCard class="h-4 w-4 text-primary" />
                        匯款帳號資訊
                    </div>
                    <div class="flex gap-4">
                        <div class="flex-[2] space-y-2 min-w-0">
                            <Label for="bank">銀行代碼</Label>
                            <BankCodeCombobox
                                id="bank"
                                name={isManagementMode ? "bankName" : "bank"}
                                disabled={!isEditing}
                                bind:value={bankName}
                                submitMode="code-name"
                            />
                        </div>
                        <div class="flex-[3] space-y-2 min-w-0">
                            <Label for="bankAccount">銀行帳號</Label>
                            <div class="relative">
                                {#if isEditing}
                                    <Input
                                        id="bankAccount"
                                        name="bankAccount"
                                        type={showAccountValue
                                            ? "text"
                                            : "password"}
                                        bind:value={inputBankAccount}
                                        placeholder={showAccountValue
                                            ? decryptedAccount ||
                                              "請輸入新帳號..."
                                            : "••••••••••••"}
                                        disabled={revealing}
                                    />
                                {:else}
                                    <Input
                                        id="bankAccount"
                                        type="text"
                                        value={maskedAccountTail ||
                                            "••••••••••••"}
                                        readonly
                                        disabled
                                        class="pointer-events-none"
                                    />
                                {/if}
                                {#if isEditing}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        class="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                        onclick={toggleReveal}
                                        disabled={revealing}
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
                                {:else}
                                    <span
                                        class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none"
                                        aria-hidden="true"
                                    >
                                        <EyeOff class="h-4 w-4" />
                                    </span>
                                {/if}
                            </div>
                        </div>
                    </div>
                    <p
                        class="text-[0.7rem] text-muted-foreground leading-relaxed"
                    >
                        銀行資訊均經 AES-256
                        對稱加密儲存，除新增外僅管理員可修改銀行資訊。
                    </p>
                </div>

                <div
                    class="pt-2 sticky bottom-0 bg-background/80 backdrop-blur-sm pb-2 flex flex-col gap-2"
                >
                    {#if isEditing}
                        <div class="flex flex-row gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                class="flex-1"
                                onclick={cancelEditing}
                            >
                                取消編輯
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading}
                                class="flex-1 gap-2 shadow-lg"
                            >
                                {#if loading}
                                    <span
                                        class="animate-spin h-4 w-4 border-2 border-background border-t-transparent rounded-full"
                                    ></span>
                                {:else}
                                    <Save class="h-4 w-4" />
                                {/if}
                                {isManagementMode
                                    ? "確認儲存變更"
                                    : "儲存並更新設定"}
                            </Button>
                        </div>
                    {:else}
                        <Button
                            type="button"
                            class="w-full gap-2 shadow-lg"
                            onclick={startEditing}
                        >
                            <User class="h-4 w-4" />
                            編輯個人資訊
                        </Button>
                    {/if}
                </div>
            </form>
        </div>
    </Sheet.Content>
</Sheet.Root>
