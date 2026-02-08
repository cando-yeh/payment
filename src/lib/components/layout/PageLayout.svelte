<!--
  PageLayout.svelte - 頁面佈局包裝元件
  
  用途：提供統一的頁面結構，包含：
  - 麵包屑導航 (可選)
  - 頁面標題與描述
  - 操作按鈕區域 (可選)
  - 主要內容區域
  
  使用範例：
  ```svelte
  <script>
    import { PageLayout } from '$lib/components/layout';
    import { Button } from '$lib/components/ui/button';
  </script>
  
  <PageLayout
    title="我的請款"
    description="管理您的所有請款單"
    breadcrumbs={[{ label: '我的請款' }]}
  >
    {#snippet actions()}
      <Button href="/claims/new">新增請款</Button>
    {/snippet}
    
    <!-- 頁面主要內容 -->
    <div>...</div>
  </PageLayout>
  ```
  
  設計說明：
  - 採用 Flexbox 垂直排列
  - 標頭區域固定在頂部，有底部邊框
  - 內容區域自動填滿剩餘空間並支援滾動
-->
<script lang="ts">
	import { cn } from '$lib/utils';
	import Breadcrumb from './Breadcrumb.svelte';
	import type { Snippet } from 'svelte';

	// ========================================
	// 型別定義
	// ========================================
	
	/**
	 * 麵包屑項目介面 (重新定義以避免循環引用)
	 */
	interface BreadcrumbItem {
		/** 顯示文字 */
		label: string;
		/** 連結路徑 */
		href?: string;
	}

	/**
	 * 元件屬性介面
	 */
	interface Props {
		/** 頁面標題 (必填) */
		title: string;
		/** 頁面描述 (選填) */
		description?: string;
		/** 麵包屑項目 (選填) */
		breadcrumbs?: BreadcrumbItem[];
		/** 操作按鈕區域 (Svelte 5 Snippet) */
		actions?: Snippet;
		/** 主要內容 (預設 Snippet) */
		children: Snippet;
		/** 額外的 CSS 類別 */
		class?: string;
	}

	// ========================================
	// 狀態與屬性
	// ========================================
	
	// 接收 props，breadcrumbs 預設為空陣列
	let { 
		title, 
		description, 
		breadcrumbs = [], 
		actions, 
		children, 
		class: className 
	}: Props = $props();
</script>

<!-- 頁面容器：全高度 Flexbox 垂直排列 -->
<div class={cn('flex flex-col h-full', className)}>
	
	<!-- ====================================== -->
	<!-- 頁面標頭區域 -->
	<!-- ====================================== -->
	<header class="flex-shrink-0 border-b bg-background px-6 py-4">
		<!-- 麵包屑導航 (若有提供) -->
		{#if breadcrumbs.length > 0}
			<Breadcrumb items={breadcrumbs} class="mb-2" />
		{/if}

		<!-- 標題與操作按鈕的水平排列 -->
		<div class="flex items-center justify-between gap-4">
			<!-- 標題區域 -->
			<div>
				<h1 class="text-2xl font-bold tracking-tight">{title}</h1>
				{#if description}
					<p class="text-muted-foreground">{description}</p>
				{/if}
			</div>

			<!-- 操作按鈕區域 (透過 Snippet 傳入) -->
			{#if actions}
				<div class="flex items-center gap-2">
					{@render actions()}
				</div>
			{/if}
		</div>
	</header>

	<!-- ====================================== -->
	<!-- 頁面主要內容區域 -->
	<!-- ====================================== -->
	<main class="flex-1 overflow-auto p-6">
		<!-- 渲染傳入的子內容 -->
		{@render children()}
	</main>
</div>
