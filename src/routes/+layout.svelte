<!--
  +layout.svelte - 全域共用版面 (Root Layout)
  
  職責：
  1. 載入全域樣式 (Tailwind CSS)。
  2. 管理全域狀態與生命週期。
  3. 處理 Supabase 認證狀態同步（瀏覽器與伺服器端）。
  4. 定義共用的 UI 框架結構（如 Sidebar 與 Main Content 區域）。
-->
<script lang="ts">
	// 引入全域 CSS (Tailwind, shadcn 變數)
	import "../app.css";
	import { invalidate } from "$app/navigation";
	import { createBrowserSupabaseClient } from "$lib";
	import { onMount } from "svelte";
	import { page } from "$app/state";
	import Sidebar from "$lib/components/layout/Sidebar.svelte";

	// 接收來自 +layout.server.ts 的資料 (data) 及其子頁面 (children)
	let {
		data,
		children,
	}: { data: import("./$types").LayoutData; children: any } = $props();

	// 初始化瀏覽器端 Supabase Client
	const supabase = createBrowserSupabaseClient();

	/**
	 * 生命週期：掛載時執行
	 */
	onMount(() => {
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((event, _session) => {
			if (_session?.expires_at !== data.session?.expires_at) {
				invalidate("supabase:auth");
			}
		});

		return () => subscription.unsubscribe();
	});

	// 判斷是否為認證相關頁面 (例如登入頁)
	const isAuthPage = $derived(page.url.pathname.startsWith("/auth"));

	// 從 Session 與 Profile 中提取使用者資訊供 Sidebar 使用
	const sidebarUser = $derived(
		data.session
			? {
					name:
						data.profile?.full_name ||
						data.session.user.user_metadata.full_name ||
						data.session.user.email?.split("@")[0] ||
						"User",
					email: data.session.user.email || "",
					avatarUrl:
						data.profile?.avatar_url ||
						data.session.user.user_metadata.avatar_url,
					isFinance: data.profile?.is_finance ?? false,
					isAdmin: data.profile?.is_admin ?? false,
					isApprover: data.profile?.is_approver ?? false,
				}
			: null,
	);
</script>

{#if data.session && !isAuthPage && sidebarUser}
	<!-- 已登入且不在登入頁：顯示側邊欄佈局 -->
	<div class="flex min-h-screen bg-background text-foreground">
		<Sidebar user={sidebarUser} />
		<main class="flex-1 overflow-auto">
			{@render children()}
		</main>
	</div>
{:else}
	<!-- 未登入或在登入頁：顯示純內容 (例如登入表單) -->
	<div class="min-h-screen bg-background">
		{@render children()}
	</div>
{/if}
