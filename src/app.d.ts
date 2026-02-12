/**
 * SvelteKit 全域型別定義 (Ambient Types)
 * 
 * 職責：
 * 1. 延伸 SvelteKit 的 App 命名空間，定義全域可用的介面。
 * 2. 定義 Locals 介面：這些屬性會在伺服器端的 `event.locals` 中可用（由 hooks.server.ts 注入）。
 * 3. 定義 PageData 介面：定義從伺服器傳遞到前端頁面（+page.svelte）的預設資料結構。
 */
import type { SupabaseClient, Session } from '@supabase/supabase-js';

declare global {
	namespace App {
		// 伺服器端錯誤的型別定義 (選填)
		// interface Error {}

		/**
		 * 伺服器端請求上下文的本地變數
		 * 這些變數由 hooks.server.ts 階段注入，可在所有 Load 函數與 API Routes 中存取
		 */
		interface Locals {
			/** Supabase 伺服器端連結實例 */
			supabase: SupabaseClient;
			/** 獲取當前使用者會話 (Session) 的輔助函數 */
			getSession: () => Promise<Session | null>;
			/** 
			 * 整理後的使用者資訊 (由 hooks.server.ts 注入)
			 * 包含原始 Session User 及擴充的角色權限
			 */
			user: (Session['user'] & {
				is_admin: boolean;
				is_finance: boolean;
				is_active: boolean;
			}) | null;
		}

		/** 使用者設定檔與權限結構 */
		interface UserProfile {
			full_name: string | null;
			avatar_url: string | null;
			is_admin: boolean;
			is_finance: boolean;
			approver_id: string | null;
			is_approver: boolean;
			bank: string | null;
			is_active?: boolean;
		}

		/** 
		 * 頁面與佈局共用的資料結構 (PageData & LayoutData)
		 * SvelteKit 要求這兩個介面名稱必須存在，我們透過繼承來達成「一次定義，兩處共用」。
		 */
		interface PageData {
			session: Session | null;
			profile: UserProfile | null;
		}

		interface LayoutData extends PageData { }

		// 頁面狀態型別定義 (用於 SvelteKit 2.0 的 shallow routing)
		// interface PageState {}

		// 部署平台特定屬性 (如 Vercel Edge Config)
		// interface Platform {}
	}
}

// 導出空物件以確保此檔案被視為模組，從而使 declare global 生效
export { };
