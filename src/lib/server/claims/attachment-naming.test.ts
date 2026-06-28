import { describe, it, expect } from "vitest";
import {
    buildAttachmentBaseName,
    computeAttachmentNames,
    type AttachmentNamingItem
} from "./attachment-naming";

describe("buildAttachmentBaseName", () => {
    it("組出 日期_發票_類別_金額", () => {
        expect(
            buildAttachmentBaseName({
                id: "a",
                date_start: "2026-05-14",
                invoice_number: "BM46971952",
                category: "勞務費",
                amount: 200000
            })
        ).toBe("2026-05-14_BM46971952_勞務費_200000");
    });

    it("無發票號碼時用「無發票」", () => {
        expect(
            buildAttachmentBaseName({
                id: "a",
                date_start: "2026-06-03",
                invoice_number: "",
                category: "交通費",
                amount: 350
            })
        ).toBe("2026-06-03_無發票_交通費_350");
    });

    it("保留發票號碼中的連字號", () => {
        expect(
            buildAttachmentBaseName({
                id: "a",
                date_start: "2026-01-01",
                invoice_number: "AB-12345678",
                category: "雜支",
                amount: 100
            })
        ).toBe("2026-01-01_AB-12345678_雜支_100");
    });

    it("移除非法字元並截取日期，金額取整數", () => {
        expect(
            buildAttachmentBaseName({
                id: "a",
                date_start: "2026-07-09T00:00:00.000Z",
                invoice_number: 'IN/V:001',
                category: "顧問*費",
                amount: 1234.6
            })
        ).toBe("2026-07-09_INV001_顧問費_1235");
    });

    it("缺日期時用 fallback（建立日）", () => {
        expect(
            buildAttachmentBaseName(
                { id: "a", date_start: null, invoice_number: "X1", category: "餐費", amount: 50 },
                "2026-02-02"
            )
        ).toBe("2026-02-02_X1_餐費_50");
    });
});

describe("computeAttachmentNames", () => {
    it("只處理有附件的明細，附上副檔名", () => {
        const items: AttachmentNamingItem[] = [
            {
                id: "1",
                item_index: 1,
                date_start: "2026-05-14",
                invoice_number: "BM46971952",
                category: "勞務費",
                amount: 200000,
                extra: { file_path: "C1/x/1_y.pdf", original_name: "scan.pdf" }
            },
            {
                id: "2",
                item_index: 2,
                date_start: "2026-05-15",
                invoice_number: "C2",
                category: "交通費",
                amount: 100,
                extra: { exempt_reason: "無憑證" } // 無 file_path → 不命名
            }
        ];
        const names = computeAttachmentNames(items);
        expect(names.get("1")).toBe("2026-05-14_BM46971952_勞務費_200000.pdf");
        expect(names.has("2")).toBe(false);
    });

    it("撞名時加項次保持唯一", () => {
        const items: AttachmentNamingItem[] = [
            {
                id: "1",
                item_index: 1,
                date_start: "2026-05-14",
                invoice_number: "",
                category: "交通費",
                amount: 100,
                extra: { file_path: "C1/x/1.jpg", original_name: "a.JPG" }
            },
            {
                id: "2",
                item_index: 2,
                date_start: "2026-05-14",
                invoice_number: "",
                category: "交通費",
                amount: 100,
                extra: { file_path: "C1/x/2.jpg", original_name: "b.jpg" }
            }
        ];
        const names = computeAttachmentNames(items);
        expect(names.get("1")).toBe("2026-05-14_無發票_交通費_100_項1.jpg");
        expect(names.get("2")).toBe("2026-05-14_無發票_交通費_100_項2.jpg");
    });
});
