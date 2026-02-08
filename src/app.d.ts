/**
 * SvelteKit 全域型別定義 (Ambient Types)
 * 職責：延伸 App 命名空間，定義 Locals (Session 資料) 與 PageData 的型別。
 */
import type { SupabaseClient, Session } from '@supabase/supabase-js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: SupabaseClient;
			getSession: () => Promise<Session | null>;
		}
		interface PageData {
			session: Session | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export { };
