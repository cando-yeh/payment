<!--
  Sidebar.svelte - 側邊導航元件
  
  用途：提供應用程式的主要導航結構，包含：
  - 品牌標識與快速新增按鈕
  - 主要導航項目 (依 RBAC 權限動態顯示)
  - 底部輔助連結
  - 使用者資訊卡片
  
  使用範例：
  ```svelte
  <script>
    import { Sidebar } from '$lib/components/layout';
    
    const user = {
      name: '王小明',
      email: 'xiaoming@company.com',
      isFinance: true,
      isAdmin: false,
      isApprover: true
    };
  </script>
  
  <Sidebar {user} />
  ```
  
  RBAC 權限控制：
  - 「審核中心」僅對 主管/財務/管理員 顯示
  - 「使用者管理」僅對 管理員 顯示
  - 其他項目對所有使用者顯示
-->
<script lang="ts">
    import { page } from "$app/stores";
    import { cn } from "$lib/utils";
    import * as Avatar from "$lib/components/ui/avatar";
    import * as Separator from "$lib/components/ui/separator";
    import { Button } from "$lib/components/ui/button";

    // Lucide 圖標：提供導航項目的視覺識別
    import {
        Home, // 首頁/我的請款
        FileText, // Logo 圖標
        CheckCircle, // 審核中心
        Building2, // 廠商管理
        User, // 個人帳戶
        Settings, // 使用者設定
        HelpCircle, // 說明文件
        Plus, // 新增按鈕
        LogOut, // 登出按鈕
    } from "lucide-svelte";

    // ========================================
    // 型別定義
    // ========================================

    /**
     * 導航項目介面
     */
    interface NavItem {
        /** 顯示文字 */
        label: string;
        /** 連結路徑 */
        href: string;
        /** 圖標元件 */
        icon: typeof Home;
        /** 待辦數量徽章 (可選) */
        badge?: number;
        /** 需要的角色權限 (可選，未設定則所有人可見) */
        requiredRoles?: ("finance" | "admin" | "approver")[];
    }

    // ========================================
    // 導航配置
    // ========================================

    /**
     * 主要導航項目
     * 依序排列，部分項目需要特定權限才會顯示
     */
    const navItems: NavItem[] = [
        // 我的請款：所有使用者可見
        { label: "我的請款", href: "/", icon: Home },

        // 審核中心：僅主管、財務、管理員可見
        {
            label: "審核中心",
            href: "/approval",
            icon: CheckCircle,
            requiredRoles: ["finance", "admin", "approver"],
        },

        // 廠商管理：所有使用者可見 (新增需審核)
        { label: "廠商管理", href: "/vendors", icon: Building2 },

        // 使用者管理：僅管理員可見
        {
            label: "使用者管理",
            href: "/admin/users",
            icon: Settings,
            requiredRoles: ["admin"],
        },
    ];

    /**
     * 底部輔助導航項目
     */
    const bottomItems: NavItem[] = [
        { label: "說明文件", href: "/docs", icon: HelpCircle },
    ];

    // ========================================
    // 元件屬性
    // ========================================

    import UserAccountSheet from "./UserAccountSheet.svelte";

    /**
     * Props 介面定義
     */
    interface Props {
        /**
         * 目前登入的使用者資訊
         * 這些屬性決定了 Sidebar 的導航項目顯示與否 (RBAC)
         */
        user: {
            name: string;
            email: string;
            avatarUrl?: string;
            isFinance?: boolean;
            isAdmin?: boolean;
            isApprover?: boolean;
            bank?: string;
        };
        /** 額外的 CSS 類別 */
        class?: string;
    }

    // 接收 props (Svelte 5 Snippets)
    let { user, class: className }: Props = $props();

    /**
     * 帳戶設定視窗開啟狀態 (Svelte 5 Rune)
     *
     * 在 Phase 2 中，我們將獨立的 /account 頁面重構為 Sheet 視窗。
     * 透過點擊左下角的使用者卡片來切換此狀態。
     */
    let accountSheetOpen = $state(false);

    // ========================================
    // 輔助函數
    // ========================================

    /**
     * 檢查使用者是否有權限查看該導航項目
     * @param item - 導航項目
     * @returns 是否有權限
     */
    function hasAccess(item: NavItem): boolean {
        // 未設定權限要求，所有人可見
        if (!item.requiredRoles) return true;

        // 檢查使用者是否具備任一要求的角色
        return item.requiredRoles.some((role) => {
            if (role === "finance") return user.isFinance;
            if (role === "admin") return user.isAdmin;
            if (role === "approver") return user.isApprover;
            return false;
        });
    }

    /**
     * 取得使用者角色的中文標籤
     * 用於使用者資訊卡片顯示
     * @returns 角色標籤字串
     */
    function getRoleLabel(): string {
        const roles: string[] = [];
        if (user.isAdmin) roles.push("管理員");
        if (user.isFinance) roles.push("財務");
        if (user.isApprover) roles.push("主管");

        // 若無任何特殊角色，顯示為一般申請人
        if (roles.length === 0) return "申請人";
        return roles.join(" / ");
    }

    /**
     * 判斷導航項目是否為目前頁面
     * 用於高亮顯示當前位置
     * @param href - 導航連結
     * @returns 是否為當前頁面
     */
    function isActive(href: string): boolean {
        const currentPath = $page.url.pathname;

        // 首頁需要精確匹配
        if (href === "/") return currentPath === "/";

        // 其他頁面使用前綴匹配 (支援子路由)
        return currentPath.startsWith(href);
    }
</script>

<!-- 側邊欄容器：固定寬度 256px，全高度，右側邊框 -->
<aside
    class={cn(
        "flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar",
        className,
    )}
>
    <!-- ====================================== -->
    <!-- 頂部區域：Logo 與快速新增按鈕 -->
    <!-- ====================================== -->
    <div class="flex flex-col gap-4 p-4">
        <!-- 品牌標識 -->
        <div class="flex items-center gap-2">
            <div
                class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            >
                <FileText class="h-4 w-4" />
            </div>
            <span class="text-lg font-semibold text-sidebar-foreground"
                >請款系統</span
            >
        </div>

        <!-- 快速新增請款按鈕 -->
        <Button href="/claims/new" class="w-full gap-2">
            <Plus class="h-4 w-4" />
            新增請款
        </Button>
    </div>

    <Separator.Root class="bg-sidebar-border" />

    <!-- ====================================== -->
    <!-- 主要導航區域 -->
    <!-- ====================================== -->
    <nav class="flex-1 space-y-1 p-2">
        {#each navItems as item}
            <!-- 依權限決定是否顯示 -->
            {#if hasAccess(item)}
                <a
                    href={item.href}
                    class={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        // 根據是否為當前頁面套用不同樣式
                        isActive(item.href)
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    )}
                >
                    <!-- 導航圖標 -->
                    <item.icon class="h-4 w-4" />
                    {item.label}

                    <!-- 待辦數量徽章 (若有) -->
                    {#if item.badge}
                        <span
                            class="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs text-white"
                        >
                            {item.badge}
                        </span>
                    {/if}
                </a>
            {/if}
        {/each}
    </nav>

    <!-- ====================================== -->
    <!-- 底部輔助導航 -->
    <!-- ====================================== -->
    <div class="space-y-1 p-2">
        {#each bottomItems as item}
            <a
                href={item.href}
                class={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive(item.href)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
            >
                <item.icon class="h-4 w-4" />
                {item.label}
            </a>
        {/each}
    </div>

    <Separator.Root class="bg-sidebar-border" />

    <!-- ====================================== -->
    <!-- 使用者資訊卡片 -->
    <!-- ====================================== -->
    <div class="p-4">
        <div class="flex items-center gap-3">
            <!-- 使用者頭像 -->
            <Avatar.Root class="h-10 w-10">
                {#if user.avatarUrl}
                    <Avatar.Image src={user.avatarUrl} alt={user.name} />
                {/if}
                <!-- 無頭像時顯示名字首字 -->
                <Avatar.Fallback
                    class="bg-sidebar-primary text-sidebar-primary-foreground"
                >
                    {user.name.charAt(0).toUpperCase()}
                </Avatar.Fallback>
            </Avatar.Root>

            <!-- 使用者名稱與角色 -->
            <button
                class="flex-1 overflow-hidden appearance-none border-none bg-transparent p-0 text-left outline-none cursor-pointer group"
                onclick={() => (accountSheetOpen = true)}
                title="開啟個人帳戶設定"
            >
                <div class="flex flex-col">
                    <p
                        class="truncate text-sm font-medium text-sidebar-foreground group-hover:text-primary transition-colors"
                    >
                        {user.name}
                    </p>
                    <p class="truncate text-xs text-sidebar-foreground/60">
                        {getRoleLabel()}
                    </p>
                </div>
            </button>

            <!-- 登出按鈕 -->
            <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground"
                onclick={async () => {
                    const { createBrowserSupabaseClient } = await import(
                        "$lib"
                    );
                    const supabase = createBrowserSupabaseClient();
                    await supabase.auth.signOut();
                    window.location.href = "/auth";
                }}
            >
                <LogOut class="h-4 w-4" />
            </Button>
        </div>
    </div>
</aside>

<UserAccountSheet {user} bind:open={accountSheetOpen} />
