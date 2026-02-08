<script lang="ts">
    /**
     * 應用程式首頁 (Landing Page / Auth Test)
     * 職責：目前的登入入口與環境測試介面。
     */
    import { createBrowserSupabaseClient } from "$lib/supabase";
    const { data } = $props();
    const supabase = createBrowserSupabaseClient();

    const signInWithGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        location.reload(); // 登出後刷新頁面
    };
</script>

<div class="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
    <h1 class="text-4xl font-bold tracking-tight">請款系統</h1>
    <p class="text-muted-foreground text-lg">Supabase Google OAuth 測試介面</p>

    {#if data.session}
        <div class="bg-card border p-6 rounded-lg shadow-sm text-center">
            <p class="mb-4">
                🎉 已登入：<span class="font-mono text-primary"
                    >{data.session.user.email}</span
                >
            </p>
            <button
                onclick={signOut}
                class="bg-destructive text-destructive-foreground px-4 py-2 rounded-md hover:bg-destructive/90 transition-colors"
            >
                登出系統
            </button>
        </div>
    {:else}
        <button
            onclick={signInWithGoogle}
            class="flex items-center gap-2 bg-white text-black border border-gray-300 px-6 py-3 rounded-md hover:bg-gray-50 transition-all font-medium shadow-sm"
        >
            <img
                src="https://www.google.com/favicon.ico"
                alt="Google"
                class="w-4 h-4"
            />
            使用 Google 帳號登入
        </button>
    {/if}
</div>
