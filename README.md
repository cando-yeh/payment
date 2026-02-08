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

詳細說明請參考：[專案結構說明.md](./參考文件/專案結構說明.md)

## 📚 相關文件

| 文件 | 說明 |
|------|------|
| [產品規格書](./參考文件/產品規格書_請款系統.md) | 功能需求、角色權限、狀態機 |
| [技術架構文件](./參考文件/技術架構文件.md) | 技術棧、資料流、安全設計 |
| [資料庫設計文件](./參考文件/資料庫設計文件.md) | 資料表結構、RLS 政策 |
| [資料操作規格表](./參考文件/資料操作規格表.md) | API 操作、狀態轉換規則 |
| [開發計劃](./參考文件/開發計劃.md) | 開發階段、任務清單 |
| [測試策略文件](./參考文件/測試策略文件.md) | 測試架構、測試案例 |
| [專案結構說明](./參考文件/專案結構說明.md) | 檔案用途說明（給新手） |
| [銀行代碼對照表](./參考文件/銀行代碼對照表.md) | 台灣銀行代碼 |
