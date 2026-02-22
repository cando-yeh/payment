# 04_前端組件關聯與資料流

> 彙整文件：元件互動架構、認證資料流、全域狀態管理  
> 最後更新：2026-02-12

---

## 1. 進入系統 - 已登入

### 1.1 流程圖 (已登入狀態 + 生命週期)
```mermaid
flowchart TB
    subgraph s1["1. SSR (Server Side)"]
        n3["hooks.server.ts"]
        n32["supabaseHandle"]
        n6["event.locals.user"]
        n7["+layout.server.ts"]
        n26{判斷: 登入頁?}
    end
    subgraph s2["呈現層 (已登入)"]
        n50["app.html (頁面模板)"]
        n15["Sidebar.svelte"]
        n16["+page.svelte (功能頁)"]
    end
    subgraph s3["Browser Client"]
        n22(["HTTP Request (已登入)"])
        n8[("Browser Cookie")]
        n10["Browser Supabase Client"]
        n11["+layout.svelte"]
        n28["AuthState 監聽器"]
        n27["1A. Token Expire"]
        n31["1B. Logout Action"]
    end

    %% SSR 階段
    n22 -- "1. 請求進入" --> n3
    n3 -- "2. 執行 supabaseHandle" --> n32
    n32 -- "讀取 Cookie" --> n8
    n8 -- "載入 Session" --> n32
    n32 -- "通過並寫入 locals" --> n3
    n3 -- "3. authHandle 路由檢查" --> n26
    n26 -- "是 (/auth)" --> n26_y["4. 拋出 303 Redirect"]
    n26_y -- "返回 Browser" --> n22
    n26 -- "否 (一般頁面)" --> n6
    n6 -- "5. 執行 layout載入 (Profile)" --> n7
    n7 -- "6. 填入模板與配發 Data" --> n50
    n50 -- "7. 渲染至佈局" --> n11
    
    %% 前端呈現
    n11 -- "8. 繪製 Sidebar 組件" --> n15
    n15 -- "Slot 置入分頁內容" --> n16
    n11 -- "9. onMount 啟動客戶端" --> n10
    n10 -- "10. 開啟全域 Listen" --> n28

    %% 生命週期子路徑
    n10 -. "11. 偵測效期將至" .-> n27
    n27 -. "11a. 自動刷新" .-> n8
    n27 -. "11b. 通知狀態變動" .-> n28
    
    n15 -. "12. 點擊登出按鈕" .-> n31
    n31 -. "12a. 清除 Client Session" .-> n10
    n31 -. "12b. 通知狀態變動" .-> n28

    n28 -- "13. 觸發重載 (invalidateAll)" --> n7

    %% 樣式渲染
    style n22 fill:#FFD600
    style n28 fill:#C8E6C9
    style n50 fill:#FFF9C4
    style n11 fill:#BBDEFB
    style n15 fill:#BBDEFB
    style n16 fill:#BBDEFB
    style n27 fill:#FFCDD2
    style n31 fill:#FFCDD2
```

### 1.2 核心資料流說明

1.  **伺服器端請求攔截 (SSR Hooks Phase)**：
    *   **Step 1-2**: 當請求進入伺服器，`hooks.server.ts` 中的 `supabaseHandle` 優先執行。它從 **Request Header** 讀取 `Browser Cookie` 並與 Supabase 伺服器驗證 Session 有效性。
    *   **Step 3-4**: `authHandle` 接手進行路由檢查。若使用者具備 Session 卻嘗試存取 `/auth` (登入頁)，系統會拋出 `303 Redirect` 中斷流程並命令瀏覽器返回首頁。
2.  **資料加載與模板渲染 (Layout & app.html Phase)**：
    *   **Step 5-7**: 通過 Hooks 檢查後，進入 `+layout.server.ts` 獲取使用者 Profile。隨後 SSR 引擎會將生成的 HTML 填入 `app.html` 的 `%sveltekit.body%` 佔位符中，並將 `data` 傳遞給 `+layout.svelte`。
3.  **前端掛載與監聽 (Hydration & OnMount Phase)**：
    *   **Step 8-10**: 頁面在瀏覽器完成掛載後，`+layout.svelte` 的 `onMount` 啟動 `Browser Supabase Client`。隨後開啟 `AuthState` 監聽器，開始捕捉任何憑證變動。
4.  **生命週期子流程 (Lifecycle Sub-flows)**：
    *   **1A (Token 過期)**：背景監聽器發現效期不足時會自動執行隱排刷新，寫回 Cookie 並維持 Session 活躍 (Step 11-11b)。
    *   **1B (主動登出)**：Sidebar 觸發 `signOut()` 後，監聽器偵測到 Auth 狀態變為 `SIGNED_OUT`，隨即呼叫 `invalidateAll()` 觸發 Step 13 的全域重載。

---

## 2. 進入系統 - 未登入

### 2.1 流程圖 (未登入及登入動作)
```mermaid
flowchart TB
    subgraph s1["1. SSR (Server Side)"]
        n3["hooks.server.ts"]
        n32["supabaseHandle"]
        n26{路由保護判斷}
        n7_auth["+layout.server.ts (Auth)"]
    end
    subgraph s4["呈現層 (未登入)"]
        n50["app.html (頁面模板)"]
        n14["+page.svelte (Auth)"]
    end
    subgraph s3["Browser Client"]
        n22a(["HTTP Request (未登入)"])
        n22b(["Browser 重定向發起"])
        n10["Browser Supabase Client"]
        n30["2A. Login Action"]
        n8[("Browser Cookie")]
        n11["+layout.svelte"]
        n28["AuthState 監聽器"]
    end
    subgraph s5["外部/回呼"]
        n40["Google OAuth 頁面"]
        n41["auth/callback (EndPoint)"]
    end

    %% SSR 攔截
    n22a -- "1. 請求存取保護路徑" --> n3
    n3 -- "2. 執行 supabaseHandle" --> n32
    n32 -- "讀取 Cookie" --> n8
    n8 -- "無 Session 憑證" --> n32
    n32 -- "回傳 null" --> n3
    n3 -- "3. 路由判斷: 限制存取" --> n26
    n26 -- "拋出 303 Redirect" --> n22a
    n22a -- "4. 接收跳轉目標 (/auth)" --> n22b
    
    %% 第二次請求
    n22b -- "5. 發起新請求 (GET /auth)" --> n3
    n3 -- "6. 判斷為公開頁面" --> n7_auth
    n7_auth -- "渲染佈局資料" --> n50
    n50 -- "7. 填入佈局" --> n11
    n11 -- "8. 繪製 Auth 登入介面" --> n14
    
    %% 登入動作
    n11 -- "9. onMount 啟動監聽器" --> n10
    n10 -- "10. 開始捕捉狀態變更" --> n28
    n14 -- "11. 使用者執行 OAuth 登入" --> n30
    n30 -- "12. 跳轉外部" --> n40
    n40 -- "13. 授權成功回傳" --> n41
    n41 -- "14. 寫入 Session 至 Cookie" --> n8
    n28 -- "15. 偵測狀態變更 (invalidateAll)" --> n3

    %% 樣式渲染
    style n22a fill:#FFD600
    style n22b fill:#FFD600
    style n50 fill:#FFF9C4
    style n14 fill:#BBDEFB
    style n30 fill:#C8E6C9
    style n11 fill:#BBDEFB
    style n28 fill:#C8E6C9
```

### 2.2 核心資料流說明

1.  **未授權存取攔截 (The 303 Loop)**：
    *   **Step 1-3**: 使用者請求保護路徑時，`hooks` 偵測到無 Session。`authHandle` 丟出一個 `303 Redirect` 響應。
    *   **Step 4-5**: 瀏覽器接收到重定向指令，中斷原請求，並立即開啟 **第二次 GET 請求** 導向 `/auth` 登入頁面。這是一個完整的網路來回循環。
2.  **登入介面掛載**：
    *   **Step 6-8**: 伺服器將 `/auth` 解析結果填入 `app.html` 並傳送到瀏覽器。`+layout.svelte` 執行 `onMount` 並開始監聽狀態 (Step 9-10)。
3.  **OAuth 認證循環**：
    *   **Step 11-13**: 使用者點擊登入後，請求導向外部 Auth 提供者 (Google)，並附帶 `next` 回跳參數。驗證成功後，外部伺服器回傳至本系統的 `auth/callback` 路由。
    *   **安全規則**：`auth/callback` 會過濾 `next`，僅允許站內相對路徑（例如 `/claims`），拒絕 `//` 或外部 URL 形式。
4.  **Session 同步與重載**：
    *   **Step 14**: Callback 處理程序將新的 Session 存入 `Browser Cookie`。
    *   **Step 15**: 前端的 `AuthState 監聽器` (n28) 捕捉狀態變更，呼叫 `invalidateAll()`。這會導致伺服器重新執行 SSR 流程（包含重新進入 `app.html` 與相關佈局），完成登入狀態切換。

---

## 3. 使用者管理 (Admin Only)

### 3.1 流程圖 (權限與核准人指派)
```mermaid
flowchart TB
    subgraph s1["1. SSR (Authentication)"]
        n3["hooks.server.ts"]
        n7["+page.server.ts (admin/users)"]
        n26{管理員檢查}
    end
    subgraph s2["呈現層 (Admin UI)"]
        n50["app.html"]
        n11["+layout.svelte"]
        n16["+page.svelte (Users List)"]
    end
    subgraph s3["後端操作 (Actions)"]
        n60["updateUserPermissions"]
        n61["assignApprover"]
        db[("profiles table")]
    end

    %% SSR 階段
    n1(["存取 /admin/users"]) -- "1. 請求" --> n3
    n3 -- "2. Session 驗證" --> n7
    n7 -- "3. 檢查 is_admin" --> n26
    n26 -- "無權限" --> redirect["重定向至 /"]
    n26 -- "有權限" --> fetch["4. 抓取所有 Profiles"]
    fetch -- "Query" --> db
    db -- "Recordset" --> fetch
    fetch -- "5. 封裝 Data" --> n50
    n50 -- "6. 渲染介面" --> n11
    n11 -- "7. 顯示清單" --> n16

    %% 操作階段
    n16 -- "8. 修改切換開關 / 下拉選單" --> n16
    n16 -- "9. 提交 Form Action" --> actions{選擇 Action}
    actions -- "權限變更" --> n60
    actions -- "指派核准人" --> n61
    n60 -- "10. Update" --> db
    n61 -- "11. Update" --> db
    db -- "12. 回傳成功" --> n16
```

### 3.2 核心資料流說明

1.  **管理員身份驗證 (Admin Guard)**：
    *   **SSR Check**: 進入 `/admin/users` 前，`+page.server.ts` 會再次從資料庫確認當前 `locals.user.id` 的 `is_admin` 欄位。若非管理員，直接拋出 `303 Redirect` 回首頁。
2.  **資料彙整與清單顯示**：
    *   **Profiles Table Query**: 伺服器會直接從 `profiles` 資料表中拉取「所有使用者清單」與「可供指派的核准人選項」，格式化後配發至前端資料表顯示。
3.  **權限與核准人異動**：
    *   **Atomic Updates**: 管理員在介面操作時（如切換財務權限），會觸發對應的 `Form Action`。後端直接針對 `profiles` 表進行 `update` 操作。
    *   **Approver Logic**: 指派核准人會更新目標使用者的 `approver_id`，這將直接影響該使用者後續提交申請單時的預設核准路徑。

---

## 4. 個人資料管理 (User Account Sheet)

### 4.1 流程圖 (敏感資料加密路徑)
```mermaid
flowchart TB
    subgraph s1["呈現層 (Client)"]
        n1["UserAccountSheet.svelte"]
        n2["revealAccount (Action)"]
        n3["updateProfile (Action)"]
    end
    subgraph s2["伺服器端 (Server Actions)"]
        n7["account/+page.server.ts"]
    end
    subgraph s3["資料庫安全層 (DB RPC)"]
        rpc_r["reveal_profile_bank_account"]
        rpc_u["update_profile_bank_account"]
        db[("profiles table")]
    end

    %% 讀取敏感資料
    n1 -- "1. 點擊隱藏帳號 (檢視)" --> n2
    n2 -- "2. 呼叫 Action" --> n7
    n7 -- "3. 執行 RPC (Security Definer)" --> rpc_r
    rpc_r -- "4. 解密 bank_account" --> db
    rpc_r -- "5. 回傳明文" --> n7
    n7 -- "6. 更新前端顯示" --> n1

    %% 更新資料
    n1 -- "7. 提交修改 (姓名/銀行/帳號)" --> n3
    n3 -- "8. 呼叫 Action" --> n7
    n7 -- "9. Update 基本資料" --> db
    n7 -- "10. 執行加密更新 RPC" --> rpc_u
    rpc_u -- "11. PGP 加密儲存" --> db
    db -- "12. 回傳成功" --> n1
```

### 4.2 核心資料流說明

1.  **敏感資料揭露 (Reveal Logic)**：
    *   **Encrypted Storage**: 銀行帳號 (`bank_account`) 在資料庫中是以 `bytea` 格式加密儲存的。
    *   **Security RPC**: 前端無法直接選取該欄位，必須透過 `revealAccount` Action 呼叫專屬 RPC。該 RPC 內部使用 `pgp_sym_decrypt` 並檢查身份（僅限本人或管理員），確保安全性。
2.  **資料更新雙路徑 (Two-Way Update)**：
    *   **Basic Data**: 姓名、銀行名稱等非敏感欄位，透過標準的 `supabase.update()` 直接寫入。
    *   **Sensitive Data**: 若使用者修改了帳號，Action 會額外呼叫 `update_profile_bank_account` RPC。該函數將原始文字加密後才存入資料庫，實現「前端不經手金鑰，後端不存儲明文」的安全機制。
3.  **即時反應**：
    *   更新成功後，透過 `svelte-sonner` 彈出通知，並藉由 SvelteKit 的資料重載機制維持介面與資料庫同步。

graph TD
    subgraph "頂部：個人化問候與快速動作"
        A[👋 歡迎，王小明！] --- B(⊕ 新增請款單)
    end

    subgraph "第二排：關鍵指標卡片 (Role-based)"
        C[草稿案件: 3]
        D[審核中: 5]
        E[駁回/待修: 2]
        F[待核准: 12]
    end

    subgraph "第三排：主要內容區"
        G[最新動態 - 列表式] 
        H[統計圖表 - 支出趨勢]
    end