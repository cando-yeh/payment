import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Rule = {
    path: string;
    mustContain: string[];
};

describe("list page shared-component adoption", () => {
    it("main list pages use ListToolbar", () => {
        const rules: Rule[] = [
            { path: "src/routes/claims/+page.svelte", mustContain: ["import ListToolbar", "<ListToolbar"] },
            { path: "src/routes/approval/+page.svelte", mustContain: ["import ListToolbar", "<ListToolbar"] },
            { path: "src/routes/payments/+page.svelte", mustContain: ["import ListToolbar", "<ListToolbar"] },
            { path: "src/routes/payees/+page.svelte", mustContain: ["import ListToolbar", "<ListToolbar"] },
            { path: "src/routes/admin/users/+page.svelte", mustContain: ["import ListToolbar", "<ListToolbar"] },
        ];

        for (const rule of rules) {
            const content = readFileSync(resolve(rule.path), "utf8");
            for (const expected of rule.mustContain) {
                expect(content).toContain(expected);
            }
        }
    });

    it("search-enabled list pages use shared SearchField", () => {
        const pages = [
            "src/routes/claims/+page.svelte",
            "src/routes/payments/+page.svelte",
            "src/routes/payees/+page.svelte",
            "src/routes/admin/users/+page.svelte",
        ];

        for (const pagePath of pages) {
            const content = readFileSync(resolve(pagePath), "utf8");
            expect(content).toContain("import SearchField");
            expect(content).toContain("<SearchField");
        }
    });

    it("status columns rely on shared StatusBadge", () => {
        const files = [
            "src/lib/components/claims/ClaimTable.svelte",
            "src/routes/payments/+page.svelte",
            "src/routes/payees/+page.svelte",
            "src/routes/admin/users/+page.svelte",
        ];

        for (const filePath of files) {
            const content = readFileSync(resolve(filePath), "utf8");
            expect(content).toContain("import StatusBadge");
            expect(content).toContain("<StatusBadge");
        }
    });
});
