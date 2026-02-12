export const BANK_LIST = [
    { code: "004", name: "臺灣銀行" },
    { code: "005", name: "土地銀行" },
    { code: "006", name: "合作金庫" },
    { code: "007", name: "第一銀行" },
    { code: "008", name: "華南銀行" },
    { code: "009", name: "彰化銀行" },
    { code: "011", name: "上海商銀" },
    { code: "012", name: "台北富邦" },
    { code: "013", name: "國泰世華" },
    { code: "016", name: "高雄銀行" },
    { code: "017", name: "兆豐商銀" },
    { code: "050", name: "臺灣企銀" },
    { code: "052", name: "渣打商銀" },
    { code: "053", name: "台中銀行" },
    { code: "054", name: "京城銀行" },
    { code: "081", name: "匯豐銀行" },
    { code: "102", name: "華泰銀行" },
    { code: "103", name: "新光銀行" },
    { code: "108", name: "陽信銀行" },
    { code: "118", name: "板信銀行" },
    { code: "147", name: "三信銀行" },
    { code: "700", name: "中華郵政" },
    { code: "803", name: "聯邦銀行" },
    { code: "805", name: "遠東銀行" },
    { code: "806", name: "元大銀行" },
    { code: "807", name: "永豐銀行" },
    { code: "808", name: "玉山銀行" },
    { code: "809", name: "凱基銀行" },
    { code: "810", name: "星展銀行" },
    { code: "812", name: "台新銀行" },
    { code: "814", name: "大眾銀行" },
    { code: "815", name: "日盛銀行" },
    { code: "816", name: "安泰銀行" },
    { code: "822", name: "中國信託" },
    { code: "823", name: "將來銀行" },
    { code: "824", name: "連線銀行" },
    { code: "826", name: "樂天銀行" },
    { code: "951", name: "農金資訊" },
] as const;

export function parseBankCode(input: string | null | undefined): string {
    const raw = String(input ?? "").trim();
    if (!raw) return "";
    const matched = raw.match(/^(\d{3})/);
    if (matched) return matched[1];
    return /^\d{3}$/.test(raw) ? raw : "";
}

export function formatBankCodeName(code: string): string {
    const bank = BANK_LIST.find((item) => item.code === code);
    return bank ? `${bank.code}-${bank.name}` : code;
}

export function getBankDisplayLabel(code: string): string {
    const bank = BANK_LIST.find((item) => item.code === code);
    return bank ? `${bank.code} ${bank.name}` : code;
}
