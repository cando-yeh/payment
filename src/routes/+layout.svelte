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
	import { onMount } from "svelte";

	// 接收來自 +layout.server.ts 的資料 (data) 及其子頁面 (children)
	let { data, children } = $props();

	/**
	 * 生命週期：掛載時執行
	 *
	 * 用途：
	 * 監聽 Supabase 認證狀態變更 (登入、登出、Session 到期)。
	 * 當狀態變更時，通知 SvelteKit 重新運行 load 函數以更新頁面資料。
	 */
	onMount(() => {
		// 未來會在此處實作 supabase.auth.onAuthStateChange 監聽
		// 目前暫時預留結構
		const {
			data: { subscription },
		} = { data: { subscription: { unsubscribe: () => {} } } };

		// 元件銷毀時取消監聽
		return () => subscription.unsubscribe();
	});
</script>

<!-- 渲染子頁面內容 -->
{@render children()}
