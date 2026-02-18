# 全域互動一致性規範（v1）

適用範圍：`claims`、`approval`、`payments`、`payees`、`admin/users` 全頁面。

目標：使用者在任何頁面都能用同一套心智模型完成「看狀態、找資料、做動作、理解回饋」。

---

## 1) 全域語彙與位置策略

### 1.1 區塊固定順序（不可交換）
1. 頁面標題區（title + description + header actions）
2. 工具列區（左：tab/filter；右：search）
3. 內容區（table 或卡片）
4. 空狀態/錯誤狀態（內容區內）

### 1.2 文字語彙統一
- `提交審核`：送審主動作（申請者）
- `儲存草稿`：暫存，不保證完整
- `核准`：審核通過
- `駁回`：退回並附原因
- `撤回草稿`：將已送審單據拉回草稿
- `待補件`：可繼續流程但需要補文件
- `已沖帳`：付款已撤銷

---

## 2) Tab 規範

### 2.1 規格
- 一律使用 `Tabs.Root / Tabs.List / Tabs.Trigger`
- 視覺樣式統一為膠囊 segmented
- `Tabs.List` 一律 `flex-nowrap`
- 工具列寬度不足時：工具列上下排，不允許 tab 換行

### 2.2 位置
- 永遠在工具列左側。
- 僅做「資料視圖切換」，不可放 destructive action。

### 2.3 文案
- 用狀態/情境名詞，不使用動詞句。
- 範例：`草稿/退回`、`審核中`、`待補件`、`歷史紀錄`。

---

## 3) 搜尋欄規範

### 3.1 規格
- 只使用共用元件：`SearchField.svelte`
- 預設寬度全站一致（由元件預設控制，頁面不覆寫）
- placeholder 必須描述「可搜尋欄位」

### 3.2 位置
- 永遠在工具列右側。
- 與 tab 同列（寬度不足時落到下一列，但仍在工具列內）。

### 3.3 placeholder 語法
- `搜尋{主鍵}或{主要識別欄}...`
- 例：`搜尋單號或收款人...`、`搜尋姓名或 ID...`

---

## 4) Badge 規範

### 4.1 單一來源
- 顏色、label、size、shape 全部由 `badge-tokens.ts` 管理。
- 頁面層只傳 key/status，不直接寫死 label/color。

### 4.2 使用規則
- 狀態 badge：`StatusBadge status="..."`
- 角色/其他 badge：`AppBadge preset="..."`
- 禁止在頁面直接寫 `label="已啟用"` 這類硬編碼（除非新 key 尚未納入 token）。

### 4.3 語彙（關鍵狀態）
- `pending_manager` → `待主管審核`
- `pending_finance` → `待財務審核`
- `pending_payment` → `待付款`
- `paid_pending_doc` → `待補件`
- `paid` → `已撥款`
- `cancelled` → `已沖帳`

---

## 5) 按鈕層級規範

### 5.1 層級定義
- Primary：此頁最重要且唯一的主動作（最多 1 個）
- Secondary：輔助流程操作（可多個）
- Tertiary/Ghost：低風險工具動作（查看、切換）
- Destructive：不可逆或高風險（刪除、沖帳、停用）

### 5.2 位置策略
- 主操作：頁面右上（header actions）或卡片右上固定區
- 列表列內操作：一律放最右欄（RowActionButtons）
- destructive 操作必須二次確認（Confirm dialog）

### 5.3 禁則
- 同一區塊不得出現兩個 Primary
- destructive 不得與 primary 同色或同視覺權重

---

## 6) 空狀態規範

### 6.1 顯示條件
- 清單結果為空（初始空 / 篩選空 / 搜尋空）都必須有空狀態

### 6.2 結構
1. icon
2. 一句描述（目前狀態）
3. 一個引導動作（若可行）

### 6.3 文案模板
- 初始空：`目前尚無{資料名}`
- 篩選空：`目前篩選條件下沒有結果`
- 搜尋空：`找不到符合「{keyword}」的結果`

---

## 7) 成功/失敗提示語（Toast）規範

### 7.1 成功訊息
- 格式：`{主詞}已{動作完成詞}`
- 例：`請款單已提交`、`收款人已停用`

### 7.2 失敗訊息
- 格式：`{動作}失敗：{可理解原因}`
- 優先顯示可行下一步（若有）
- 例：`提交失敗：請先選擇每筆明細的憑證狀態`

### 7.3 禁則
- 禁止只顯示 `操作失敗`（無資訊）
- 禁止顯示內部錯誤碼給終端使用者

---

## 8) 狀態與欄位呈現一致性

- 金額欄：`$` 靠左、數字靠右、千分位
- 日期欄：預設顯示日期（`YYYY/MM/DD`）；只有明確需要時分才顯示時間
- 有日期欄位的表格：日期一律放第一欄，且內容置中，不顯示日曆 icon
- 表頭：全站置中（單一規則）
- 含 badge 的欄位（如狀態/角色/類型）：內容一律置中
- `ID#` 欄（請款單/付款單）：內容一律置中，字體統一 `font-mono + text-xs + font-bold + tracking-wide`
- 流程角色欄位（如 `收款人`、`收款對象/申請人`、`核准人`、`經辦人`）：內容一律僅顯示姓名、置中，禁止 icon/avatar
- 禁止使用 `本人` 這類不特定顯示，若姓名不存在請顯示 `—`

---

## 9) 實作守則（Design System Contract）

以下為強制共用元件，頁面不可自行重造同功能：
- 版面骨架：`ListPageScaffold`
- 工具列：`ListToolbar`
- 搜尋：`SearchField`
- 狀態 badge：`StatusBadge` / `AppBadge`
- 表格外框：`DataTableShell`
- 空狀態：`ListTableEmptyState`
- 列操作群：`RowActionButtons`
- 二次確認：`ConfirmActionDialog`

---

## 10) 驗收清單（PR Checklist）

每個新頁或調整 PR 必須全部符合：
- [ ] Header / Toolbar / Content 順序一致
- [ ] Tab 使用 Tabs primitive，且不換行
- [ ] SearchField 無頁面自訂寬度覆寫
- [ ] Badge 文案/色彩來自 token，頁面無硬編碼
- [ ] 只有 1 個 Primary action
- [ ] Destructive 皆有確認流程
- [ ] 空狀態含 icon + 描述 + 可行動作
- [ ] 成功/失敗提示語符合模板
- [ ] 金額/日期/表頭對齊符合全域規則
- [ ] Badge 欄位置中、`ID#` 欄字體與置中規則一致
- [ ] 流程角色欄位僅顯示姓名且置中（不含 icon/avatar）

---

## 11) 版本管理

- 文件版本：`v1`
- 建議：每次 UI policy 調整都先更新本文件，再改元件與頁面。
