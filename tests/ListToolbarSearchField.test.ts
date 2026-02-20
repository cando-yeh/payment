import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("ListToolbar/SearchField contracts", () => {
    it("ListToolbar keeps responsive + non-wrapping toolbar structure", () => {
        const content = readFileSync(
            resolve("src/lib/components/common/ListToolbar.svelte"),
            "utf8",
        );

        expect(content).toContain("md:flex-row");
        expect(content).toContain("md:items-center");
        expect(content).toContain("md:justify-between");
        expect(content).toContain("overflow-x-auto");
        expect(content).toContain("left?: Snippet");
        expect(content).toContain("right?: Snippet");
    });

    it("SearchField keeps shared default width and search input pattern", () => {
        const content = readFileSync(
            resolve("src/lib/components/common/SearchField.svelte"),
            "utf8",
        );

        expect(content).toContain('widthClass = "w-full md:w-[214px]"');
        expect(content).toContain("type=\"search\"");
        expect(content).toContain('placeholder = "搜尋..."');
        expect(content).toContain("group-focus-within:text-primary");
        expect(content).toContain('class={cn("relative group", widthClass, className)}');
    });
});
