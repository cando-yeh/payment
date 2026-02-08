/**
 * SvelteKit 全域伺服器端載入器 (Layout Server Load)
 * 
 * 職責：
 * 1. 在伺服器端準備所有頁面共用的資料。
 * 2. 獲取當前使用者的 Session 資訊。
 */
import type { LayoutServerLoad } from './$types';

/**
 * Load 函數：在頁面請求時執行
 * 
 * @param event.locals - 從 hooks.server.ts 注入的本地變數
 * @returns 返回的 session 會被整合進 $page.data.session 中
 */
export const load: LayoutServerLoad = async ({ locals: { getSession } }) => {
    return {
        // 從 Supabase 讀取目前有效的 Session
        session: await getSession(),
    };
};
