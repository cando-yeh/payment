import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({
    locals: { supabase, getSession },
    url,
}) => {
    const session = await getSession();
    if (!session) {
        throw redirect(303, "/auth");
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("is_finance")
        .eq("id", session.user.id)
        .single();

    if (!profile?.is_finance) {
        throw redirect(303, "/");
    }

    const tab = url.searchParams.get("tab") === "payments" ? "payments" : "claims";
    const search = url.searchParams.get("search") || "";

    const [claimsResponse, paymentsResponse] = await Promise.all([
        supabase
            .from("claims")
            .select(`
                *,
                payee:payees(name),
                applicant:profiles!claims_applicant_id_fkey(full_name)
            `)
            .neq("status", "draft")
            .order("created_at", { ascending: false }),
        supabase
            .from("payments")
            .select(`
                *,
                paid_by_profile:profiles!payments_paid_by_fkey(full_name),
                claims(status)
            `)
            .order("paid_at", { ascending: false }),
    ]);

    if (claimsResponse.error) {
        console.error("Error fetching claims for documents page:", claimsResponse.error);
    }
    if (paymentsResponse.error) {
        console.error(
            "Error fetching payments for documents page:",
            paymentsResponse.error,
        );
    }

    return {
        tab,
        search,
        claims: claimsResponse.data || [],
        payments: paymentsResponse.data || [],
    };
};

