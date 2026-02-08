/**
 * $lib 模組入口檔
 * 
 * 職責：
 * 提供一處集中的匯出點，讓外部在使用 $lib 資源時，能有更簡潔的語法。
 * 
 * 包含內容：
 * 1. Supabase 用戶端工廠。
 * 2. 通用工具函數 (cn, utils)。
 * 
 * 使用範例：
 * ```typescript
 * import { cn, createBrowserSupabaseClient } from '$lib';
 * ```
 */

// 匯出 Supabase 相關功能
export * from './supabase';

// 匯出通用工具函數
export * from './utils';
