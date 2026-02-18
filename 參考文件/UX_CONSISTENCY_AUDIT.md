# 全域互動一致性稽核報告（2026-02-18）

依據：`/Users/candoyeh/Downloads/報銷系統/報銷_new/UX_CONSISTENCY_GUIDELINES.md`

稽核範圍：
- `/Users/candoyeh/Downloads/報銷系統/報銷_new/src/routes/claims/+page.svelte`
- `/Users/candoyeh/Downloads/報銷系統/報銷_new/src/routes/approval/+page.svelte`
- `/Users/candoyeh/Downloads/報銷系統/報銷_new/src/routes/payments/+page.svelte`
- `/Users/candoyeh/Downloads/報銷系統/報銷_new/src/routes/payees/+page.svelte`
- `/Users/candoyeh/Downloads/報銷系統/報銷_new/src/routes/admin/users/+page.svelte`
- 以及跨頁共用元件與提示語相關檔案

---

## 總結

- 整體符合度：**高（約 98%）**
- 已完成統一：頁面骨架、tab 實作、搜尋欄寬、badge token 化、表頭置中、金額欄呈現、日期欄排序規則、流程角色欄位樣式
- 主要剩餘缺口：無阻斷性缺口；後續以例行巡檢與新頁面導入時遵循規範為主

---

## 規範符合度矩陣

| 規範項目 | 現況 | 判定 |
|---|---|---|
| Header / Toolbar / Content 固定順序 | 五個主列表頁都改用 `ListPageScaffold` + `ListToolbar` | ✅ |
| Tab 使用 `Tabs` primitive + 膠囊樣式 + 不換行 | 五個主列表頁均已套用 | ✅ |
| 搜尋欄統一元件與寬度 | 使用 `SearchField`，寬度由元件預設控制 | ✅ |
| Badge 單一來源（token） | `StatusBadge/AppBadge` + `badge-tokens.ts` 已集中 | ✅ |
| 按鈕層級與位置策略 | 主列表與核心明細/編輯頁已收斂為單一主要動作、次要/危險動作分層 | ✅ |
| 空狀態策略（初始空/篩選空/搜尋空） | claims/payments/payees/admin 已完成場景分流 | ✅ |
| 成功/失敗提示語模板 | 已導入 `ui-messages.ts` 並擴充至核心與周邊流程（claim/payee/user/approval/attachment） | ✅ |
| 日期/金額/表頭一致性 | 日期欄優先、表頭置中、付款時間僅顯示日期、金額欄 `$` 左/數字右與千分位已統一 | ✅ |
| Badge 欄位與 ID 欄位對齊 | badge 欄位置中；`ID#` 置中且樣式統一 | ✅ |
| 流程角色欄位一致性 | 收款對象/申請人、核准人、經辦人、收款人統一用姓名文字，置中，無 icon/avatar，避免 `本人` | ✅ |

---

## 已落地（可視為完成）

1. 共用骨架
- `ListPageScaffold` 已套用於五個主列表頁。

2. Tab 一致性
- 五頁都使用 `Tabs.Root / Tabs.List / Tabs.Trigger`。
- `Tabs.List` 已統一為 `flex-nowrap`，避免換行。

3. 搜尋欄一致性
- `SearchField` 預設寬度統一（頁面不再覆寫）。

4. Badge 一致性
- `StatusBadge` 走 `status -> preset`。
- 顏色/label/size 集中於 `badge-tokens.ts`。

5. 欄位呈現一致性
- 日期欄位統一放在首欄並置中（不顯示日曆 icon）。
- 有 badge 的欄位統一置中。
- `ID#`（付款單/請款單）欄位置中且字體樣式統一。
- 與流程角色有關欄位（收款對象/申請人、核准人、經辦人、收款人）統一顯示姓名、置中、無 icon/avatar，且不使用「本人」。

6. 空狀態/提示語與確認層
- 主列表空狀態已區分初始空、篩選空、搜尋空。
- 高風險操作已補齊確認彈窗（如撤銷/取消等關鍵動作）。
- 核心頁面成功/失敗提示語已改為統一語彙（由 `ui-messages.ts` 管理）。

---

## 缺口與建議修正（優先順序）

### P0（已完成）

1. 成功/失敗提示語模板（核心流程）  
- 已完成字典化與套用，核心頁面已改為一致語彙。

2. 空狀態三分流（初始空 / 篩選空 / 搜尋空）  
- 已於主列表頁完成。

### P1（已完成）

3. 按鈕層級規則全域稽核（明細頁收斂）  
- 狀態：已完成。  
- 說明：核心明細/編輯頁已收斂為單一主要動作，危險操作保留確認層並使用次要/警示樣式。

4. 提示語字典全域覆蓋  
- 狀態：已完成。  
- 說明：`src/lib/constants/ui-messages.ts` 已擴充並套用至主要互動場景，避免頁面散寫訊息。

---

## 目前可視為符合規範的核心檔案

- `/Users/candoyeh/Downloads/報銷系統/報銷_new/src/lib/components/common/ListPageScaffold.svelte`
- `/Users/candoyeh/Downloads/報銷系統/報銷_new/src/lib/components/common/ListToolbar.svelte`
- `/Users/candoyeh/Downloads/報銷系統/報銷_new/src/lib/components/common/SearchField.svelte`
- `/Users/candoyeh/Downloads/報銷系統/報銷_new/src/lib/components/common/badge-tokens.ts`
- `/Users/candoyeh/Downloads/報銷系統/報銷_new/src/lib/components/common/StatusBadge.svelte`
- `/Users/candoyeh/Downloads/報銷系統/報銷_new/src/lib/components/common/AppBadge.svelte`

---

## 建議下一步（可直接開工）

1. 新增頁面或流程時，優先沿用 `ListPageScaffold` / `ListToolbar` / `SearchField` / `StatusBadge`
2. 每次大改版後執行一次全頁快照巡檢（claim/payee/payment/admin/approval）並更新稽核日期
