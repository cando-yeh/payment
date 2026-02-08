/**
 * SvelteKit 伺服器端攔截器 (Server Hooks)
 * 
 * 職責：
 * 1. 攔截每一筆傳入的伺服器端請求。
 * 2. 初始化 Supabase 認證狀態。
 * 3. 未來可擴充：路由保護、日誌記錄、效能監控。
 */
import { supabaseHandle } from '$lib/supabase';
import { sequence } from '@sveltejs/kit/hooks';

/**
 * Handle 入口函數
 * 
 * 使用 sequence 方法來串聯多個處理器：
 * - supabaseHandle: 處理 Supabase 客戶端初始化與 Cookie/Session 同步。
 * 
 * 執行流程：
 * Request → sequence(supabaseHandle) → Route Handler (+page.server.ts 等) → sequence(supabaseHandle) → Response
 */
export const handle = sequence(supabaseHandle);
