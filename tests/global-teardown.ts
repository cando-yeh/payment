import type { FullConfig } from "@playwright/test";
import { cleanupTestData } from "../scripts/cleanup-test-data.mjs";

async function globalTeardown(_config: FullConfig) {
    try {
        const result = await cleanupTestData();
        console.log(
            `[global-teardown] test data cleanup: deleted=${result.deletedTestUsers}, remaining=${result.remainingTestUsers}`,
        );
    } catch (error) {
        console.error("[global-teardown] test data cleanup failed", error);
    }
}

export default globalTeardown;
