# 請款系統 (Reimbursement System)

企業內部請款、審核、撥款與收款人管理系統（SvelteKit + Supabase）。

## 技術棧

- 前端/全端：SvelteKit 2 + TypeScript
- UI：shadcn-svelte + Tailwind CSS
- 後端：Supabase (PostgreSQL / Auth / Storage)
- 測試：Vitest + Playwright

## 主要模組

- 我的請款：建立請款、草稿、提交、補件
- 審核中心：主管審核、財務審核、待撥款、補件審核
- 收款人管理：新增/異動/停用申請與財務審核
- 使用者管理：啟停用、刪除、銀行與核准人維護
- 付款歷史：撥款紀錄與撤銷撥款

## 本機啟動

```bash
npm install
npm run dev
```

## 環境變數

先複製：

```bash
cp .env.example .env
```

至少需要：

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_GOOGLE_CLIENT_ID`

## 測試

```bash
npm run check
npm run test:run
npm run test:e2e:stable
npm run test:all:stable
npm run test:cleanup
```

## Supabase Migration（目前策略）

目前 repo 已收斂為單一 migration 檔：

- `/Users/candoyeh/Downloads/報銷系統/報銷_new/supabase/migrations/20260220012000_consolidate_current_schema.sql`

用途：

- 將 schema / RPC / 權限一次對齊到目前專案版本
- 適用於開發階段快速重建與對齊

## 專案結構（精簡）

```text
src/
  routes/                 # 頁面路由與 server actions
  lib/components/         # UI 與業務元件
  lib/server/             # server 邏輯與驗證
  lib/client/             # 前端工具
supabase/migrations/      # DB migration
tests/                    # Vitest + Playwright
參考文件/                 # 規格與維運文件
```

## 參考文件

- `/Users/candoyeh/Downloads/報銷系統/報銷_new/參考文件/01_產品藍圖與開發計畫.md`
- `/Users/candoyeh/Downloads/報銷系統/報銷_new/參考文件/02_技術架構與輔助規範.md`
- `/Users/candoyeh/Downloads/報銷系統/報銷_new/參考文件/03_資料庫與資料規約.md`
- `/Users/candoyeh/Downloads/報銷系統/報銷_new/參考文件/TESTING.md`
