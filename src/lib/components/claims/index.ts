/**
 * 請款業務元件模組入口
 * 
 * 此模組匯出與請款業務邏輯緊密相關的專用元件。
 * 這些元件封裝了特定業務規則，如狀態顯示、類型判斷等。
 * 
 * 包含元件：
 * - StatusBadge: 請款單狀態標籤 (9 種狀態對應不同色彩)
 * 
 * 使用範例：
 * ```typescript
 * import { StatusBadge } from '$lib/components/claims';
 * ```
 * 
 * 未來可能新增：
 * - TypeBadge: 請款類型標籤 (員工報銷/廠商請款/個人勞務)
 * - ClaimCard: 請款單卡片元件
 * - ClaimTimeline: 請款單審核時間軸
 */

// 請款狀態標籤元件：將狀態碼轉換為中文標籤與對應色彩
export { default as StatusBadge } from './StatusBadge.svelte';
