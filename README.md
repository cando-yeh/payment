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

# 填入 Supabase 連線資訊
```

## 📁 專案結構

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
