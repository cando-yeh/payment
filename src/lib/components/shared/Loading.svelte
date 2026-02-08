<script lang="ts">
  import { cn } from "$lib/utils";
  import { Loader2 } from "lucide-svelte";

  // ========================================
  // 型別定義
  // ========================================

  /**
   * 元件屬性介面
   */
  interface Props {
    /** 顯示文字，預設為「載入中...」 */
    text?: string;
    /** 額外的 CSS 類別 */
    class?: string;
  }

  // ========================================
  // 狀態與屬性
  // ========================================

  // 接收 props，設定預設值
  let { text = "載入中...", class: className }: Props = $props();
</script>

<!--
  Loading.svelte - 載入中狀態元件
  
  用途：在資料載入或非同步操作進行時，顯示視覺化的載入提示。
  
  使用範例：
  ```svelte
  <script>
    import { Loading } from '$lib/components/shared';
    
    let isLoading = true;
  </script>
  
  {#if isLoading}
    <Loading />
  {:else}
    <div>資料內容</div>
  {/if}
  
  自訂文字與樣式：
  <Loading text="處理中..." class="py-8" />
  ```
  設計說明：
  - 垂直置中顯示旋轉圖標與文字
  - 預設文字為「載入中...」
  - 支援自訂 CSS 類別以調整間距
-->

<!-- 
  載入容器：
  - 使用 Flexbox 垂直置中
  - py-12 提供預設垂直間距
-->
<div class={cn("flex flex-col items-center justify-center py-12", className)}>
  <!-- 
	  旋轉圖標：
	  - animate-spin: Tailwind 的旋轉動畫
	  - text-muted-foreground: 使用柔和色彩避免視覺干擾
	-->
  <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />

  <!-- 載入文字 -->
  <p class="mt-4 text-sm text-muted-foreground">{text}</p>
</div>
