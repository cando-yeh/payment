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
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import { cn } from "$lib/utils";
    import * as Avatar from "$lib/components/ui/avatar";
    import * as Separator from "$lib/components/ui/separator";
    import { Button } from "$lib/components/ui/button";

    // Lucide 圖標：提供導航項目的視覺識別
    import {
        FileText, // Logo 圖標
        Building2, // 廠商管理
        User, // 個人帳戶
        Settings, // 使用者設定
        LogOut, // 登出按鈕
        Landmark, // 付款歷史
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
        icon: any;
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
        { label: "我的請款", href: "/claims", icon: FileText },

        // 審核中心：僅主管、財務、管理員可見
        {
            label: "審核中心",
            href: "/approval",
            icon: FileText,
            requiredRoles: ["finance", "admin", "approver"],
        },

        // 收款人管理：所有使用者可見 (新增需審核)
        { label: "收款人管理", href: "/payees", icon: Building2 },

        // 使用者管理：僅管理員可見
        {
            label: "使用者管理",
            href: "/admin/users",
            icon: Settings,
            requiredRoles: ["admin"],
        },

        // 付款歷史：僅財務、管理員可見
        {
            label: "付款歷史",
            href: "/payments",
            icon: Landmark,
            requiredRoles: ["finance", "admin"],
        },
    ];

    // ========================================
    // 元件屬性
    // ========================================

    import UserProfileSheet from "./UserProfileSheet.svelte";

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
            approver_id?: string;
            approver_name?: string;
            bank?: string;
            bankAccountTail?: string;
            myClaimsPendingCount?: number;
            approvalPendingCount?: number;
            payeePendingCount?: number;
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
    let pendingNavTimer: ReturnType<typeof setTimeout> | null = null;

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
     * 判斷導航項目是否為目前頁面
     * 用於高亮顯示當前位置
     * @param href - 導航連結
     * @returns 是否為當前頁面
     */
    function isActive(href: string): boolean {
        const currentPath = page.url.pathname;
        const fromParam = page.url.searchParams.get("from");

        // If we have a source context, use it to determine active state
        // This handles cases like viewing a claim detail from the Approval Center
        if (fromParam) {
            // If the current path is a sub-path of the href (standard active logic),
            // we need to be careful not to override it unless fromParam matches something else.

            // Logic:
            // 1. If href matches fromParam, it should be active.
            // 2. If href matches currentPath BUT fromParam points elsewhere, it should NOT be active.

            // Check if this nav item corresponds to the source
            // Decode URI component because it might be encoded
            const decodedFrom = decodeURIComponent(fromParam);

            if (href === "/" && decodedFrom === "/") return true;
            if (href !== "/" && decodedFrom.startsWith(href)) return true;

            // If we are here, this item is NOT the source.
            // But it might still match the current path (e.g. "My Claims" matches "/claims/123").
            // We want to suppress this match if we have a valid source that is DIFFERENT.
            if (
                currentPath.startsWith("/claims") &&
                href === "/claims" &&
                !decodedFrom.startsWith("/claims")
            ) {
                return false;
            }
        }

        // 首頁需要精確匹配
        if (href === "/") return currentPath === "/";

        // 其他頁面使用前綴匹配 (支援子路由)
        return currentPath.startsWith(href);
    }

    function handleNavClick(event: MouseEvent, href: string) {
        // 保留開新分頁/新視窗等原生操作
        if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
        ) {
            return;
        }

        if (!accountSheetOpen) return;

        event.preventDefault();
        accountSheetOpen = false;
        if (pendingNavTimer) clearTimeout(pendingNavTimer);
        pendingNavTimer = setTimeout(() => {
            goto(href);
            pendingNavTimer = null;
        }, 320);
    }

    function getNavBadge(item: NavItem): number {
        if (item.href === "/claims") return user.myClaimsPendingCount || 0;
        if (item.href === "/approval") return user.approvalPendingCount || 0;
        if (item.href === "/payees") return user.payeePendingCount || 0;
        return item.badge || 0;
    }
</script>

<!-- 側邊欄容器：macOS 風格設計，高透明度、細緻邊框 -->
<aside
    class={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar backdrop-blur-3xl transition-all duration-300",
        className,
    )}
>
    <!-- ====================================== -->
    <!-- 頂部區域：Logo 與快速新增按鈕 -->
    <!-- ====================================== -->
    <div class="flex flex-col gap-6 p-6">
        <!-- 品牌標識 -->
        <div class="flex items-center gap-3">
            <div
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"
            >
                <FileText class="h-4 w-4" />
            </div>
            <span
                class="text-base font-bold tracking-tight text-sidebar-foreground"
                >請款系統</span
            >
        </div>
    </div>

    <!-- ====================================== -->
    <!-- 主要導航區域 -->
    <!-- ====================================== -->
    <nav class="flex-1 space-y-0.5 px-3">
        {#each navItems as item}
            <!-- 依權限決定是否顯示 -->
            {#if hasAccess(item)}
                <a
                    href={item.href}
                    data-sveltekit-preload-data="hover"
                    onclick={(event) => handleNavClick(event, item.href)}
                    class={cn(
                        "flex items-center gap-3 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all duration-200",
                        // 根據是否為當前頁面套用不同樣式
                        isActive(item.href)
                            ? "bg-primary/10 text-primary shadow-inner"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                    )}
                >
                    <!-- 導航圖標 -->
                    <item.icon
                        class={cn(
                            "h-4 w-4",
                            isActive(item.href)
                                ? "text-primary"
                                : "text-sidebar-foreground/50",
                        )}
                    />
                    {item.label}

                    <!-- 待辦數量徽章 (若有) -->
                    {#if getNavBadge(item) > 0}
                        <span
                            class="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white"
                        >
                            {getNavBadge(item)}
                        </span>
                    {/if}
                </a>
            {/if}
        {/each}
    </nav>

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
                title="個人帳戶設定"
            >
                <div class="flex flex-col">
                    <p
                        class="truncate text-sm font-medium text-sidebar-foreground group-hover:text-primary transition-colors"
                    >
                        {user.name}
                    </p>
                    <div class="mt-0.5 flex flex-wrap gap-1">
                        {#if user.isAdmin}
                            <span
                                class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 border-blue-200"
                            >
                                管理員
                            </span>
                        {/if}
                        {#if user.isFinance}
                            <span
                                class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 border-amber-200"
                            >
                                財務
                            </span>
                        {/if}
                        {#if !user.isAdmin && !user.isFinance}
                            <span
                                class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold border-input text-foreground"
                            >
                                員工
                            </span>
                        {/if}
                    </div>
                </div>
            </button>

            <!-- 登出按鈕 -->
            <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground"
                onclick={async () => {
                    const { createBrowserSupabaseClient } = await import(
                        "$lib/supabase"
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

<UserProfileSheet {user} bind:open={accountSheetOpen} />
