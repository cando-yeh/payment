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

通知（Email Worker）另需：

- `APP_BASE_URL`（例如 `http://localhost:5173`）
- `QSTASH_TOKEN`（Upstash QStash token）
- `NOTIFY_DRAIN_URL`（可選；預設為 `${APP_BASE_URL}/api/notify/drain`）
- `NOTIFY_DRAIN_TOKEN`（建議設定；保護 `/api/notify/drain`）
- `NOTIFY_QSTASH_DELAY_SECONDS`（預設 `5`）
- `NOTIFY_QSTASH_RETRIES`（預設 `2`）
- `NOTIFY_SMTP_HOST`
- `NOTIFY_SMTP_PORT`（預設 `465`）
- `NOTIFY_SMTP_SECURE`（`true/false`，預設 `true`）
- `NOTIFY_SMTP_USERNAME`
- `NOTIFY_SMTP_PASSWORD`
- `NOTIFY_SMTP_FROM`
- `NOTIFY_BATCH_SIZE`（預設 `20`）
- `NOTIFY_RATE_DELAY_MS`（預設 `200`）
- `NOTIFY_SMTP_TIMEOUT_MS`（預設 `15000`）
- `NOTIFY_MAX_ATTEMPTS_CAP`（預設 `5`）

通知觸發流程：

- 狀態轉移成功後，Server Action 會 publish 一筆 QStash delayed message（預設 5 秒）
- QStash 回呼 `/api/notify/drain`，由該端點執行通知佇列寄送與重試邏輯
- 本機也可手動執行 `npm run notify:worker` 做排查/補送

## 測試

```bash
npm run check
npm run test:run
npm run test:e2e:stable
npm run test:all:stable
npm run test:cleanup
npm run notify:worker
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
docs/                     # 規格、流程與維運文件
```

## 參考文件

- `docs/product/product-roadmap.md`
- `docs/architecture/technical-architecture.md`
- `docs/architecture/component-dataflow.md`
- `docs/database/data-spec.md`
- `docs/testing/testing-guide.md`
- `docs/ux/ux-consistency-guidelines.md`
- `docs/ux/ux-consistency-audit.md`
- `docs/operations/notification-observability.sql`
