<!--
  Breadcrumb.svelte - 麵包屑導航元件
  
  用途：顯示目前頁面在網站結構中的位置，讓使用者能快速返回上層頁面。
  
  使用範例：
  ```svelte
  <script>
    import { Breadcrumb } from '$lib/components/layout';
    
    const breadcrumbs = [
      { label: '我的請款', href: '/claims' },
      { label: '新增請款' }  // 最後一項通常不需要連結
    ];
  </script>
  
  <Breadcrumb items={breadcrumbs} />
  ```
  
  設計說明：
  - 自動顯示首頁圖標作為起始點
  - 中間項目可點擊跳轉
  - 最後一項 (目前頁面) 會以粗體顯示且不可點擊
  - 超長文字會自動截斷
-->
<script lang="ts">
    import { cn } from "$lib/utils";
    import { ChevronRight, Home } from "lucide-svelte";

    // ========================================
    // 型別定義
    // ========================================

    /**
     * 麵包屑項目介面
     */
    interface BreadcrumbItem {
        /** 顯示文字 */
        label: string;
        /** 連結路徑 (選填，最後一項通常不需要) */
        href?: string;
    }

    /**
     * 元件屬性介面
     */
    interface Props {
        /** 麵包屑項目陣列 */
        items: BreadcrumbItem[];
        /** 額外的 CSS 類別 */
        class?: string;
    }

    // ========================================
    // 狀態與屬性
    // ========================================

    // 接收 props
    let { items, class: className }: Props = $props();
</script>

<!-- 
  導航容器
  - 使用 nav 標籤符合語意化 HTML
  - aria-label 提供無障礙支援
-->
<nav
    aria-label="麵包屑導航"
    class={cn("flex items-center text-sm text-muted-foreground", className)}
>
    <!-- 首頁圖標：永遠顯示，作為導航起點 -->
    <a
        href="/"
        class="flex items-center gap-1 hover:text-foreground transition-colors"
    >
        <Home class="h-4 w-4" />
        <!-- 螢幕閱讀器專用文字 -->
        <span class="sr-only">首頁</span>
    </a>

    <!-- 遍歷所有麵包屑項目 -->
    {#each items as item, index}
        <!-- 分隔符：右箭頭圖標 -->
        <ChevronRight class="mx-2 h-4 w-4 flex-shrink-0" />

        <!-- 
		  條件渲染：
		  - 非最後一項且有連結：顯示可點擊連結
		  - 最後一項：顯示粗體純文字 (目前頁面)
		-->
        {#if item.href && index < items.length - 1}
            <a
                href={item.href}
                class="hover:text-foreground transition-colors truncate max-w-[200px]"
            >
                {item.label}
            </a>
        {:else}
            <!-- 目前頁面：粗體顯示，不可點擊 -->
            <span class="text-foreground font-medium truncate max-w-[200px]">
                {item.label}
            </span>
        {/if}
    {/each}
</nav>
