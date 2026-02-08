<!--
  +page.svelte - 應用程式首頁 (主要入口)
  
  職責：
  1. 展示歡迎介面。
  2. 提供 Google OAuth 登入功能測試。
  3. 顯示目前登入狀態。
-->
<script lang="ts">
    import { createBrowserSupabaseClient } from "$lib/supabase";

    /**
     * Svelte 5 Props
     * data 包含來自伺服器端 (+layout.server.ts) 傳遞下來的 session
     */
    const { data } = $props();

    // 初始化瀏覽器端的 Supabase Client
    const supabase = createBrowserSupabaseClient();

    /**
     * 執行 Google OAuth 登入
     * 導向 Google 驗證頁面，成功後會返回 auth/callback
     */
    const signInWithGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                // 指定登入成功後的回傳導向位址
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    };

    /**
     * 執行登出動作
     * 清除本地 Session 與 Cookie
     */
    const signOut = async () => {
        await supabase.auth.signOut();
        location.reload(); // 登出後強制重新整理頁面以更新 UI
    };
</script>

<!-- 
  視覺介面：置中佈局
  - 使用 Tailwind 輔助樣式建立簡潔開發介面
-->
<div class="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
    <!-- 標題區域 -->
    <h1 class="text-4xl font-bold tracking-tight text-foreground">請款系統</h1>
    <p class="text-muted-foreground text-lg text-center max-w-md">
        歡迎使用報銷系統。目前處於開發階段，請使用下方的 Google OAuth
        進行功能測試。
    </p>

    <!-- 條件渲染：視登入狀態顯示不同內容 -->
    {#if data.session}
        <!-- 已登入狀態：顯示帳號資訊與登出按鈕 -->
        <div
            class="bg-card border p-6 rounded-xl shadow-sm text-center w-full max-w-sm"
        >
            <div class="mb-4">
                <p class="text-sm text-muted-foreground">目前登入帳號</p>
                <p class="font-mono font-medium text-primary break-all">
                    {data.session.user.email}
                </p>
            </div>

            <button
                onclick={signOut}
                class="w-full bg-destructive text-destructive-foreground px-4 py-2.5 rounded-lg font-medium hover:bg-destructive/90 transition-all active:scale-[0.98]"
            >
                登出系統
            </button>
        </div>
    {:else}
        <!-- 未登入狀態：顯示 Google 登入按鈕 -->
        <button
            onclick={signInWithGoogle}
            class="flex items-center justify-center gap-3 bg-white text-slate-700 border border-slate-200 px-8 py-3.5 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all font-semibold shadow-sm active:scale-[0.98]"
        >
            <img
                src="https://www.google.com/favicon.ico"
                alt="Google"
                class="w-5 h-5"
            />
            透過企業 Google 帳號登入
        </button>

        <p class="text-xs text-muted-foreground">
            僅限 @company.com 網域帳號使用
        </p>
    {/if}
</div>
