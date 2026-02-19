import { describe, expect, it } from "vitest";
import { APP_BADGE_PRESET } from "../src/lib/components/common/badge-tokens";

describe("StatusBadge", () => {
    it("defines localized claim status labels in presets", () => {
        expect(APP_BADGE_PRESET["status.pending_manager"]?.label).toBe(
            "待主管審核",
        );
        expect(APP_BADGE_PRESET["status.pending_finance"]?.label).toBe(
            "待財務審核",
        );
    });

    it("defines localized payment/account status labels in presets", () => {
        expect(APP_BADGE_PRESET["status.paid_pending_doc"]?.label).toBe(
            "待補件",
        );
        expect(APP_BADGE_PRESET["status.inactive"]?.label).toBe("已停用");
    });
});
