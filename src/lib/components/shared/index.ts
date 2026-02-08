/**
 * 共用元件模組入口
 * 
 * 此模組匯出可在多個頁面重複使用的通用 UI 元件。
 * 這些元件不屬於特定業務邏輯，而是提供基礎的 UI 功能。
 * 
 * 包含元件：
 * - Loading: 載入中狀態顯示
 * - EmptyState: 空狀態 / 無資料顯示
 * 
 * 使用範例：
 * ```typescript
 * import { Loading, EmptyState } from '$lib/components/shared';
 * ```
 */

// 載入中狀態元件：顯示旋轉圖標與提示文字
export { default as Loading } from './Loading.svelte';

// 空狀態元件：列表無資料時的友善提示
export { default as EmptyState } from './EmptyState.svelte';
