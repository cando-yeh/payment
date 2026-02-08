<!--
  StatusBadge.svelte - 請款單狀態標籤元件
  
  用途：將請款單的技術狀態碼轉換為友善的中文標籤，並以不同色彩區分狀態類型。
  
  使用範例：
  ```svelte
  <script>
    import { StatusBadge } from '$lib/components/claims';
  </script>
  
  <StatusBadge status="pending_manager" />
  <StatusBadge status="paid" class="ml-2" />
  ```
  
  支援的狀態：
  - draft: 草稿 (灰色)
  - pending_manager: 主管審核 (藍色)
  - pending_finance: 財務審核 (紫色)
  - pending_payment: 待付款 (琥珀色)
  - paid: 已付款 (綠色)
  - paid_pending_doc: 待補件 (橘色)
  - pending_doc_review: 補件審核 (青色)
  - returned: 已退回 (紅色)
  - cancelled: 已撤銷 (邊框樣式)
-->
<script lang="ts">
    import { cn } from "$lib/utils";
    import { Badge } from "$lib/components/ui/badge";

    // ========================================
    // 型別定義
    // ========================================

    /**
     * 請款單狀態類型
     * 與資料庫中的 claim_status ENUM 完全對應
     */
    type ClaimStatus =
        | "draft" // 草稿 - 尚未提交
        | "pending_manager" // 主管審核中
        | "pending_finance" // 財務審核中
        | "pending_payment" // 待付款
        | "paid" // 已付款 (流程完成)
        | "paid_pending_doc" // 已付款但待補件
        | "pending_doc_review" // 補件審核中
        | "returned" // 已退回 (需修正)
        | "cancelled"; // 已撤銷 (流程終止)

    /**
     * 元件屬性介面
     */
    interface Props {
        /** 請款單狀態 */
        status: ClaimStatus;
        /** 額外的 CSS 類別 */
        class?: string;
    }

    // ========================================
    // 狀態與屬性
    // ========================================

    // 使用 Svelte 5 Runes 語法接收 props
    let { status, class: className }: Props = $props();

    // ========================================
    // 狀態配置對照表
    // ========================================

    /**
     * 每個狀態對應的顯示設定：
     * - label: 中文顯示文字
     * - variant: Badge 元件的預設樣式
     * - className: 額外的 Tailwind CSS 類別 (覆蓋預設色彩)
     */
    const statusConfig: Record<
        ClaimStatus,
        {
            label: string;
            variant: "default" | "secondary" | "destructive" | "outline";
            className?: string;
        }
    > = {
        // 草稿：灰色次要樣式，代表尚未進入流程
        draft: {
            label: "草稿",
            variant: "secondary",
        },
        // 主管審核：藍色，代表第一關審核
        pending_manager: {
            label: "主管審核",
            variant: "default",
            className: "bg-blue-500 hover:bg-blue-600",
        },
        // 財務審核：紫色，代表第二關審核
        pending_finance: {
            label: "財務審核",
            variant: "default",
            className: "bg-violet-500 hover:bg-violet-600",
        },
        // 待付款：琥珀色，代表已核准等待撥款
        pending_payment: {
            label: "待付款",
            variant: "default",
            className: "bg-amber-500 hover:bg-amber-600",
        },
        // 已付款：綠色，代表流程成功完成
        paid: {
            label: "已付款",
            variant: "default",
            className: "bg-green-500 hover:bg-green-600",
        },
        // 待補件：橘色，代表已付款但憑證未齊
        paid_pending_doc: {
            label: "待補件",
            variant: "default",
            className: "bg-orange-500 hover:bg-orange-600",
        },
        // 補件審核：青色，代表補件已提交待確認
        pending_doc_review: {
            label: "補件審核",
            variant: "default",
            className: "bg-teal-500 hover:bg-teal-600",
        },
        // 已退回：紅色警告樣式，代表需要修正
        returned: {
            label: "已退回",
            variant: "destructive",
        },
        // 已撤銷：邊框樣式，代表流程終止
        cancelled: {
            label: "已撤銷",
            variant: "outline",
            className: "text-muted-foreground",
        },
    };

    // ========================================
    // 衍生狀態
    // ========================================

    /**
     * 根據傳入的 status 取得對應配置
     * 如果找不到對應狀態，使用預設的 secondary 樣式
     */
    const config = $derived(
        statusConfig[status] ?? {
            label: status,
            variant: "secondary" as const,
        },
    );
</script>

<!-- 
  渲染 Badge 元件
  - variant: 控制基本樣式 (default/secondary/destructive/outline)
  - class: 合併狀態專屬色彩與外部傳入的類別
-->
<Badge variant={config.variant} class={cn(config.className, className)}>
    {config.label}
</Badge>
