/**
 * SvelteKit 全域伺服器端載入器
 * 職責：在伺服器端抓取最新的 Session 資訊，傳遞給全專案的 Layout。
 */
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { getSession } }) => {
    return {
        session: await getSession(),
    };
};
