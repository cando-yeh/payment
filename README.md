# 請款系統 (Reimbursement System)

企業內部請款與報銷管理系統

## 🚀 技術棧

- **前端框架**：SvelteKit 2.x + TypeScript
- **UI 元件**：shadcn-svelte + Tailwind CSS
- **後端服務**：Supabase (PostgreSQL + Auth + Storage)
- **部署平台**：Vercel

## 📦 安裝與執行

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 打包正式版
npm run build

# 預覽正式版
npm run preview
```

## 🔧 環境變數設定

```bash
# 複製環境變數範本
cp .env.example .env

# 填入以下資訊：
# PUBLIC_SUPABASE_URL
# PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
# PUBLIC_GOOGLE_CLIENT_ID
```

## 🧪 測試架構

本專案使用以下測試工具進行品質控管：
- **Vitest**: 單元測試與業務邏輯驗證。
- **Playwright**: 端對端 (E2E) 使用者流程測試。

執行測試：
```bash
npm run test:unit    # 執行單元測試
npm run test:e2e     # 執行端對端測試 (瀏覽器模擬)
```
詳細測試規範請參考：[02_技術架構與輔助規範](./參考文件/02_技術架構與輔助規範.md)

## 🔐 Google OAuth 設定指南

本專案支援 Google 帳號登入，請依照以下步驟設定：

1. **Google Cloud Console 設定**:
   - 建立專案並設定 **OAuth 同意畫面**。
   - 建立 **OAuth 2.0 用戶端 ID** (網頁應用程式)。
   - **已授權的 JavaScript 來源**: `http://localhost:5173`
   - **已授權的重新導向 URI**: `https://lelewlcyubsxyudrysmvh.supabase.co/auth/v1/callback`

2. **Supabase 後台設定**:
   - 前往 `Authentication` -> `Providers` -> `Google`。
   - 啟用 Google 並填入 **Client ID** 與 **Client Secret**。
   - 將 **Client ID** 填入 `.env` 中的 `PUBLIC_GOOGLE_CLIENT_ID`。

3. **初始化 Storage**:
   ```bash
   # 建立收據存放空間 (receipts bucket)
   export $(cat .env | xargs) && npx tsx src/lib/scripts/init-supabase.ts
   ```

## � Vercel 部署流程 (CI/CD)

本專案建議部署至 Vercel，設定步驟如下：

1. **連結 GitHub**:
   - 在 [Vercel Dashboard](https://vercel.com/dashboard) 點擊 `Add New...` -> `Project`。
   - 匯出 (Import) 此 GitHub 儲存庫。

2. **設定環境變數**:
   - 在部署設定頁面的 `Environment Variables` 區塊，依序加入以下變數：
     - `PUBLIC_SUPABASE_URL`
     - `PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY` (安全考量，僅伺服器端可用)
     - `PUBLIC_GOOGLE_CLIENT_ID`
     - `PUBLIC_APP_ENV` (填入 `production`)

3. **自動部署**:
   - 之後只要執行 `git push` 到 `main` 分支，Vercel 就會自動觸發重新部署。

## �📁 專案結構

```
src/
├── routes/          # 頁面路由
├── lib/
│   ├── components/  # UI 元件
│   ├── utils/       # 工具函數
│   └── hooks/       # 自訂 Hooks
└── app.css          # 全域樣式
```

詳細說明請參考：[02_技術架構與輔助規範.md](./參考文件/02_技術架構與輔助規範.md)

| 文件 | 說明 |
|------|------|
| [01_產品藍圖與開發計畫](./參考文件/01_產品藍圖與開發計畫.md) | 產品規格、功能需求、開發時程與進度 |
| [02_技術架構與輔助規範](./參考文件/02_技術架構與輔助規範.md) | 技術棧、資料流、專案結構、測試策略與 ADR |
| [03_資料庫與資料規約](./參考文件/03_資料庫與資料規約.md) | 資料表設計、RLS 政策、API 規格、銀行代碼 |
