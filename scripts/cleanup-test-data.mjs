import fs from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const env = dotenv.parse(fs.readFileSync(".env"));

const supabase = createClient(
    env.PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: { persistSession: false, autoRefreshToken: false },
    },
);

const TEST_USER_EMAIL_SUFFIX = "@example.com";
const TEST_NAME_PATTERNS = [
    "%E2E%",
    "%Test%",
    "%測試%",
    "%Variant%",
    "%Payee Edge%",
    "%RPC Request%",
];

async function listTestUserIds() {
    const ids = [];
    let page = 1;
    const perPage = 1000;

    while (true) {
        const { data, error } = await supabase.auth.admin.listUsers({
            page,
            perPage,
        });
        if (error) throw error;

        const users = data?.users || [];
        for (const user of users) {
            const email = String(user.email || "").toLowerCase();
            if (email.endsWith(TEST_USER_EMAIL_SUFFIX)) ids.push(user.id);
        }
        if (users.length < perPage) break;
        page += 1;
    }

    return ids;
}

async function cleanupTestData() {
    const testUserIds = await listTestUserIds();

    if (testUserIds.length > 0) {
        await supabase
            .from("profiles")
            .update({ approver_id: null })
            .in("approver_id", testUserIds);
        await supabase
            .from("profiles")
            .update({ deactivated_by: null })
            .in("deactivated_by", testUserIds);

        const { data: claims } = await supabase
            .from("claims")
            .select("id")
            .in("applicant_id", testUserIds);
        const claimIds = (claims || []).map((item) => item.id);

        if (claimIds.length > 0) {
            await supabase.from("claim_history").delete().in("claim_id", claimIds);
            await supabase.from("claim_items").delete().in("claim_id", claimIds);
        }

        await supabase.from("claim_history").delete().in("actor_id", testUserIds);
        await supabase.from("claims").delete().in("applicant_id", testUserIds);
        await supabase
            .from("payee_change_requests")
            .delete()
            .in("requested_by", testUserIds);
        await supabase
            .from("payee_change_requests")
            .delete()
            .in("reviewed_by", testUserIds);
        await supabase.from("payments").delete().in("paid_by", testUserIds);
    }

    for (const pattern of TEST_NAME_PATTERNS) {
        await supabase.from("payees").delete().ilike("name", pattern);
        await supabase.from("payments").delete().ilike("payee_name", pattern);
    }

    for (const reasonPattern of ["%test%", "%e2e%", "%測試%", "%rls%"]) {
        await supabase
            .from("payee_change_requests")
            .delete()
            .ilike("reason", reasonPattern);
    }

    if (testUserIds.length > 0) {
        await supabase.from("profiles").delete().in("id", testUserIds);
        for (const id of testUserIds) {
            const { error } = await supabase.auth.admin.deleteUser(id);
            if (error && !String(error.message || "").includes("User not found")) {
                console.error(`delete auth user failed: ${id}`, error.message);
            }
        }
    }

    const remainingTestUsers = await listTestUserIds();
    return {
        deletedTestUsers: testUserIds.length,
        remainingTestUsers: remainingTestUsers.length,
    };
}

const isDirectRun = Boolean(
    process.argv[1] && process.argv[1].endsWith("cleanup-test-data.mjs"),
);
if (isDirectRun) {
    cleanupTestData()
        .then((result) => {
            console.log(
                `cleanup done: deletedTestUsers=${result.deletedTestUsers}, remainingTestUsers=${result.remainingTestUsers}`,
            );
        })
        .catch((error) => {
            console.error("cleanup failed", error);
            process.exit(1);
        });
}

export { cleanupTestData };
