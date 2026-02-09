<script lang="ts">
    /**
     * UserAccountSheet.svelte
     *
     * 職責：
     * 1. 顯示並編輯目前登入使用者的個人資訊。
     * 2. 處理銀行帳號的 AES-256 對稱解密與顯示。
     * 3. 透過 SvelteKit Form Actions 同步更新資料庫。
     */
    import { enhance } from "$app/forms";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Separator } from "$lib/components/ui/separator";
    import * as Avatar from "$lib/components/ui/avatar";
    import * as Sheet from "$lib/components/ui/sheet";
    import { toast } from "svelte-sonner";
    import {
        User,
        Building2,
        CreditCard,
        Save,
        ShieldCheck,
        Eye,
        EyeOff,
    } from "lucide-svelte";
    import { deserialize, applyAction } from "$app/forms";
    import { invalidateAll } from "$app/navigation";
    import { untrack } from "svelte";

    // 接收來自 Sidebar 的使用者資料物件
    let { user, open = $bindable(false) } = $props();

    // UI 狀態控制
    let loading = $state(false);

    /**
     * 銀行帳號安全性控制邏輯
     *
     * 為了保持安全性，明文帳號不會預載到前端。
     * 只有在使用者點擊「眼睛」時，才會透過 POST 請求呼叫後端 RPC 進行動態解密。
     */
    let showAccountValue = $state(false);
    let decryptedAccount = $state<string | null>(null);
    let revealing = $state(false);

    /**
     * 表單本地狀態 (Svelte 5 Runes)
     *
     * 使用本地狀態是為了讓 Input 能夠與 bind:value 綁定，
     * 而不會因為使用者正在輸入時 Prop 更新而導致輸入中斷。
     */
    let fullName = $state(untrack(() => user.name));
    let bankName = $state(untrack(() => user.bank || ""));
    let inputBankAccount = $state("");

    /**
     * 強制同步效應
     *
     * 當伺服器端的資料更新（例如儲存成功後，+layout.server.ts 重抓資料），
     * 我們透過 $effect 將 Prop 的最新值同步回本地狀態，確保 UI 反映資料庫現狀。
     */
    $effect(() => {
        fullName = user.name;
        bankName = user.bank || "";
    });

    /**
     * 表單提交結果處理器
     *
     * 我們使用 SvelteKit 的 applyAction(result) 函式。
     * 它的功能是：自動觸發資料失效 (Invalidate)，讓 SvelteKit 重新跑 +layout.server.ts 抓取新資料，
     * 從而驅動上方的 $effect 進行 UI 更新。
     */
    function handleResult() {
        return async ({ result }: { result: any }) => {
            loading = false;
            if (result.type === "success") {
                toast.success("個人資料已成功更新");
                // 觸發全域 Invalidation 與 UI 同步
                await applyAction(result);
                // 重設敏感資訊狀態，強迫下一次查看時需重新解密
                decryptedAccount = null;
                showAccountValue = false;
            } else if (result.type === "failure") {
                toast.error(result.data?.message || "更新失敗，請稍後再試");
            }
        };
    }

    /**
     * 銀行帳號解密流程
     *
     * 呼叫 /account?/revealAccount 的 Form Action。
     * 後端會由 SECURITY DEFINER 的 SQL 函數執行 pgp_sym_decrypt，
     * 該函數會透過 auth.uid() 嚴格檢查呼叫者是否為帳號擁有者或管理員。
     */
    async function toggleReveal() {
        if (!showAccountValue && !decryptedAccount) {
            revealing = true;
            // 使用 fetch 呼叫隱形表單 Action
            const response = await fetch("/account?/revealAccount", {
                method: "POST",
                body: new FormData(),
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
                revealing = false;
                return;
            }
            revealing = false;
        }
        showAccountValue = !showAccountValue;
    }

    /**
     * 角色標籤產生器
     */
    function getRoleLabel() {
        const roles: string[] = [];
        if (user.isAdmin) roles.push("管理員");
        if (user.isFinance) roles.push("財務");
        if (user.isApprover) roles.push("主管");
        return roles.length > 0 ? roles.join(" / ") : "申請人";
    }
</script>

<Sheet.Root bind:open>
    <Sheet.Content class="sm:max-w-md overflow-y-auto">
        <Sheet.Header>
            <Sheet.Title>個人帳戶設定</Sheet.Title>
            <Sheet.Description>
                管理您的個人資訊與匯款帳號。變更將立即套用於系統。
            </Sheet.Description>
        </Sheet.Header>

        <div class="mt-8 space-y-8">
            <!-- 使用者頭像區塊 -->
            <div class="flex flex-col items-center gap-4">
                <Avatar.Root
                    class="h-24 w-24 border-2 border-background shadow-md"
                >
                    {#if user.avatarUrl}
                        <Avatar.Image src={user.avatarUrl} alt={user.name} />
                    {/if}
                    <Avatar.Fallback class="bg-primary/5 text-2xl text-primary">
                        {user.name.charAt(0).toUpperCase()}
                    </Avatar.Fallback>
                </Avatar.Root>
                <div class="text-center">
                    <h3 class="text-lg font-semibold">{user.name}</h3>
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
                action="/account?/updateProfile"
                use:enhance={() => {
                    loading = true;
                    return handleResult();
                }}
                class="space-y-6"
            >
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
                                    <EyeOff
                                        class="h-4 w-4 text-muted-foreground"
                                    />
                                {:else}
                                    <Eye
                                        class="h-4 w-4 text-muted-foreground"
                                    />
                                {/if}
                            </Button>
                        </div>
                        <p
                            class="text-[0.7rem] text-muted-foreground leading-relaxed"
                        >
                            所有資訊均經 AES-256 對稱加密儲存。
                        </p>
                    </div>
                </div>

                <div class="pt-4">
                    <Button
                        type="submit"
                        disabled={loading}
                        class="w-full gap-2"
                    >
                        {#if loading}
                            <span
                                class="animate-spin h-4 w-4 border-2 border-background border-t-transparent rounded-full"
                            ></span>
                        {:else}
                            <Save class="h-4 w-4" />
                        {/if}
                        儲存並更新設定
                    </Button>
                </div>
            </form>
        </div>
    </Sheet.Content>
</Sheet.Root>
