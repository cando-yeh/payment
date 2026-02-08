import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
    const {
        url,
        locals: { supabase }
    } = event;
    const code = url.searchParams.get('code');
    const next = url.searchParams.get('next') ?? '/';

    if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            throw redirect(303, `/${next.slice(1)}`);
        }
    }

    // 出錯時導回首頁
    throw redirect(303, '/auth/auth-code-error');
};
