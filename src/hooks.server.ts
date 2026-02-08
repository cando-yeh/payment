/**
 * SvelteKit 伺服器端攔截器 (Hooks)
 * 職責：在每一筆請求進入頁面之前，先處理 Supabase 認證狀態。
 */
import { supabaseHandle } from '$lib/supabase';
import { sequence } from '@sveltejs/kit/hooks';

/**
 * 使用 sequence 可以串聯多個 handle
 * 目前先放入 supabaseHandle 處理認證與連線
 */
export const handle = sequence(supabaseHandle);
