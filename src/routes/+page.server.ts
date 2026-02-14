import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { getSession } }) => {
    const session = await getSession();
    if (!session) {
        return { session: null };
    }

    // Authenticated users no longer have a dashboard, redirect to claims list
    throw redirect(303, '/claims');
};
