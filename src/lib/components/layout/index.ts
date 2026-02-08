/**
 * 佈局元件模組入口
 * 
 * 此模組匯出所有佈局相關的元件，用於建構應用程式的整體結構。
 * 
 * 包含元件：
 * - Sidebar: 側邊導航選單
 * - Breadcrumb: 麵包屑導航路徑
 * - PageLayout: 頁面佈局包裝元件
 * 
 * 使用範例：
 * ```typescript
 * import { Sidebar, Breadcrumb, PageLayout } from '$lib/components/layout';
 * ```
 */

// 側邊導航元件：包含品牌標識、主要導航、使用者資訊
export { default as Sidebar } from './Sidebar.svelte';

// 麵包屑導航元件：顯示頁面層級路徑
export { default as Breadcrumb } from './Breadcrumb.svelte';

// 頁面佈局包裝元件：統一頁面結構 (標題、麵包屑、內容區)
export { default as PageLayout } from './PageLayout.svelte';
