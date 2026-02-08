<script lang="ts">
    import { cn } from "$lib/utils";
    import { Button } from "$lib/components/ui/button";
    import { FileX } from "lucide-svelte";
    import type { Icon } from "lucide-svelte";

    // ========================================
    // 型別定義
    // ========================================

    /**
     * 元件屬性介面
     */
    interface Props {
        /** 標題文字 (必填) */
        title: string;
        /** 描述文字 (選填) */
        description?: string;
        /** 自訂圖標元件，預設為 FileX */
        icon?: typeof Icon;
        /** 操作按鈕文字 (選填) */
        actionLabel?: string;
        /** 操作按鈕連結 (選填) */
        actionHref?: string;
        /** 操作按鈕點擊事件 (選填，與 actionHref 擇一使用) */
        onAction?: () => void;
        /** 額外的 CSS 類別 */
        class?: string;
    }

    // ========================================
    // 狀態與屬性
    // ========================================

    let {
        title,
        description,
        icon: IconComponent = FileX, // 預設使用「無檔案」圖標
        actionLabel,
        actionHref,
        onAction,
        class: className,
    }: Props = $props();
</script>

<!--
  EmptyState.svelte - 空狀態顯示元件
  
  用途：當列表或查詢結果為空時，顯示友善的提示訊息，並可選擇性提供操作按鈕。
  
  使用範例：
  ```svelte
  <script>
    import { EmptyState } from '$lib/components/shared';
    import { Plus } from 'lucide-svelte';
  </script>
  
  基本用法：
  <EmptyState title="尚無請款單" description="您還沒有建立任何請款單" />

  帶操作按鈕：
  <EmptyState
      title="尚無請款單"
      description="立即建立您的第一筆請款單"
      actionLabel="新增請款"
      actionHref="/claims/new"
      icon={Plus}
  />
  ```
  設計說明：
  - 大型圖標吸引視覺焦點
  - 標題與描述提供清楚說明
  - 操作按鈕引導使用者下一步
  - 整體置中顯示，適合作為空列表的替代內容
-->

<!-- 
  空狀態容器：
  - 垂直置中排列
  - 虛線邊框提供視覺區隔
  - 圓角與淺背景增加柔和感
-->
<div
    class={cn(
        "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center",
        className,
    )}
>
    <!-- 
	  圖標區域：
	  - 圓形背景容器
	  - 淺色主題色增加視覺層次
	-->
    <div
        class="flex h-16 w-16 items-center justify-center rounded-full bg-muted"
    >
        <IconComponent class="h-8 w-8 text-muted-foreground" />
    </div>

    <!-- 標題 -->
    <h3 class="mt-4 text-lg font-semibold">{title}</h3>

    <!-- 描述文字 (若有提供) -->
    {#if description}
        <p class="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
    {/if}

    <!-- 
	  操作按鈕 (若有提供)
	  - 支援連結模式 (actionHref) 與點擊模式 (onAction)
	-->
    {#if actionLabel && (actionHref || onAction)}
        <Button class="mt-6" href={actionHref} onclick={onAction}>
            {actionLabel}
        </Button>
    {/if}
</div>
