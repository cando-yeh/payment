<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Switch } from "$lib/components/ui/switch";
    import * as Dialog from "$lib/components/ui/dialog";
    import * as Table from "$lib/components/ui/table";
    import * as Avatar from "$lib/components/ui/avatar";
    import { Label } from "$lib/components/ui/label";
    import AppBadge from "$lib/components/common/AppBadge.svelte";
    import { toast } from "svelte-sonner";
    import {
        Search,
        Users,
        Trash2,
        UserX,
        UserCheck,
        Plus,
    } from "lucide-svelte";
    import { timedFetch } from "$lib/client/timed-fetch";
    import { invalidateAll } from "$app/navigation";
    import UserProfileSheet from "$lib/components/layout/UserProfileSheet.svelte";
    import ListPageScaffold from "$lib/components/common/ListPageScaffold.svelte";
    import ListToolbar from "$lib/components/common/ListToolbar.svelte";
    import SearchField from "$lib/components/common/SearchField.svelte";
    import RowActionButtons from "$lib/components/common/RowActionButtons.svelte";
    import ConfirmActionDialog from "$lib/components/common/ConfirmActionDialog.svelte";
    import ListTableEmptyState from "$lib/components/common/ListTableEmptyState.svelte";
    import ListPagination from "$lib/components/common/ListPagination.svelte";
    import StatusBadge from "$lib/components/common/StatusBadge.svelte";
    import { LIST_TABLE_TOKENS } from "$lib/components/common/list-table-tokens";
    import { cn } from "$lib/utils";
    import { fade } from "svelte/transition";
    import { UI_MESSAGES } from "$lib/constants/ui-messages";
    import { handleFetchActionFeedback } from "$lib/utils/action-feedback";

    let { data } = $props();

    let users = $state<any[]>([]);
    let expenseCategories = $state<any[]>([]);
    let searchTerm = $state("");
    let includeInactiveUsers = $state(false);
    let includeInactiveCategories = $state(false);
    let currentSection = $state<"users" | "categories">("users");
    const PAGE_SIZE = 10;
    let userPage = $state(1);
    let categoryPage = $state(1);
    let hasInitializedViewState = $state(false);
    let isCategoryDialogOpen = $state(false);
    let newCategoryName = $state("");
    let newCategoryDescription = $state("");
    let pendingOps = $state<Record<string, boolean>>({});
    let isConfirmOpen = $state(false);
    let confirmTitle = $state("");
    let confirmDescription = $state("");
    let confirmButtonLabel = $state("確認");
    let confirmButtonVariant = $state<"default" | "destructive">("default");
    let confirmAction = $state<null | (() => Promise<void>)>(null);

    // 選中的使用者資料（用於開啟 Sheet）
    let selectedUser = $state<any>(null);
    let isSheetOpen = $state(false);
    let clearSelectedUserTimer: ReturnType<typeof setTimeout> | null = null;

    $effect(() => {
        users = data.users;
        expenseCategories = data.expenseCategories || [];
        if (!hasInitializedViewState) {
            includeInactiveUsers = data.defaultTab === "inactive";
            currentSection =
                data.defaultSection === "categories" ? "categories" : "users";
            hasInitializedViewState = true;
        }
    });

    function isActiveUser(user: any) {
        return user.is_active !== false;
    }

    function setPending(op: string, isPending: boolean) {
        pendingOps = { ...pendingOps, [op]: isPending };
    }

    // Sheet 關閉時延後卸載，讓退場動畫先播放完成。
    $effect(() => {
        if (isSheetOpen) {
            if (clearSelectedUserTimer) {
                clearTimeout(clearSelectedUserTimer);
                clearSelectedUserTimer = null;
            }
            return;
        }

        if (!selectedUser) return;
        clearSelectedUserTimer = setTimeout(() => {
            selectedUser = null;
            clearSelectedUserTimer = null;
        }, 320);
    });

    const tabFilteredUsers = $derived.by(() =>
        users.filter((u) => {
            const activeMatches = includeInactiveUsers
                ? true
                : isActiveUser(u);
            return activeMatches;
        }),
    );

    const filteredUsers = $derived.by(() => {
        const normalized = searchTerm.trim().toLowerCase();
        if (!normalized) return tabFilteredUsers;
        return tabFilteredUsers.filter((u) => {
            const fullName = String(u.full_name || "").toLowerCase();
            const id = String(u.id || "").toLowerCase();
            return fullName.includes(normalized) || id.includes(normalized);
        });
    });
    const pagedUsers = $derived.by(() =>
        filteredUsers.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE),
    );

    const emptyMessage = $derived.by(() => {
        const keyword = searchTerm.trim();
        if (users.length === 0) return "目前尚無使用者";
        if (keyword && filteredUsers.length === 0)
            return `找不到符合「${keyword}」的結果`;
        if (tabFilteredUsers.length === 0) return "目前篩選條件下沒有結果";
        return "目前尚無使用者";
    });

    const categoryStatusFiltered = $derived.by(() =>
        expenseCategories.filter((item) =>
            includeInactiveCategories ? true : Boolean(item.is_active),
        ),
    );

    const filteredCategories = $derived.by(() => {
        const normalized = searchTerm.trim().toLowerCase();
        if (!normalized) return categoryStatusFiltered;
        return categoryStatusFiltered.filter((item) => {
            const name = String(item.name || "").toLowerCase();
            const description = String(item.description || "").toLowerCase();
            return name.includes(normalized) || description.includes(normalized);
        });
    });
    const pagedCategories = $derived.by(() =>
        filteredCategories.slice(
            (categoryPage - 1) * PAGE_SIZE,
            categoryPage * PAGE_SIZE,
        ),
    );
    const categoryEmptyMessage = $derived.by(() => {
        if (expenseCategories.length === 0) return "目前尚無費用類別";
        if (searchTerm.trim() && filteredCategories.length === 0) {
            return `找不到符合「${searchTerm.trim()}」的結果`;
        }
        if (categoryStatusFiltered.length === 0) {
            return "目前篩選條件下沒有結果";
        }
        return "目前尚無費用類別";
    });

    $effect(() => {
        const _userKey = `${currentSection}|${includeInactiveUsers}|${searchTerm.trim().toLowerCase()}`;
        void _userKey;
        userPage = 1;
    });
    $effect(() => {
        const _categoryKey = `${currentSection}|${includeInactiveCategories}|${searchTerm.trim().toLowerCase()}`;
        void _categoryKey;
        categoryPage = 1;
    });

    function openSystemConfirm(options: {
        title: string;
        description: string;
        buttonLabel: string;
        buttonVariant?: "default" | "destructive";
        action: () => Promise<void>;
    }) {
        confirmTitle = options.title;
        confirmDescription = options.description;
        confirmButtonLabel = options.buttonLabel;
        confirmButtonVariant = options.buttonVariant ?? "default";
        confirmAction = options.action;
        isConfirmOpen = true;
    }

    async function runConfirmedAction() {
        const action = confirmAction;
        isConfirmOpen = false;
        confirmAction = null;
        if (action) await action();
    }

    async function deactivateUser(userId: string) {
        const opKey = `deactivate:${userId}`;
        if (pendingOps[opKey]) return;
        setPending(opKey, true);

        const formData = new FormData();
        formData.append("userId", userId);

        try {
            const response = await timedFetch("?/deactivateUser", {
                method: "POST",
                body: formData,
                headers: { "x-sveltekit-action": "true" },
            });
            const { ok } = await handleFetchActionFeedback({
                response,
                successMessage: UI_MESSAGES.user.deactivated,
                failureMessage: UI_MESSAGES.user.deactivateFailed,
            });
            if (ok) await invalidateAll();
        } catch {
            toast.error(UI_MESSAGES.common.networkFailed("停用使用者"));
        } finally {
            setPending(opKey, false);
        }
    }

    async function reactivateUser(userId: string) {
        const opKey = `reactivate:${userId}`;
        if (pendingOps[opKey]) return;
        setPending(opKey, true);

        const formData = new FormData();
        formData.append("userId", userId);

        try {
            const response = await timedFetch("?/reactivateUser", {
                method: "POST",
                body: formData,
                headers: { "x-sveltekit-action": "true" },
            });
            const { ok } = await handleFetchActionFeedback({
                response,
                successMessage: UI_MESSAGES.user.reactivated,
                failureMessage: UI_MESSAGES.user.reactivateFailed,
            });
            if (ok) await invalidateAll();
        } catch {
            toast.error(UI_MESSAGES.common.networkFailed("重新啟用使用者"));
        } finally {
            setPending(opKey, false);
        }
    }

    async function removeUser(userId: string) {
        const opKey = `delete:${userId}`;
        if (pendingOps[opKey]) return;
        setPending(opKey, true);

        const formData = new FormData();
        formData.append("userId", userId);

        try {
            const response = await timedFetch("?/removeUser", {
                method: "POST",
                body: formData,
                headers: { "x-sveltekit-action": "true" },
            });
            const { ok } = await handleFetchActionFeedback({
                response,
                successMessage: UI_MESSAGES.user.deleted,
                failureMessage: UI_MESSAGES.user.deleteFailed,
            });
            if (ok) await invalidateAll();
        } catch {
            toast.error(UI_MESSAGES.common.networkFailed("刪除使用者"));
        } finally {
            setPending(opKey, false);
        }
    }

    async function createExpenseCategory() {
        if (!newCategoryName.trim()) {
            toast.error("請輸入費用類別名稱");
            return;
        }
        if (!newCategoryDescription.trim()) {
            toast.error("請輸入適用情境說明");
            return;
        }
        const formData = new FormData();
        formData.append("name", newCategoryName.trim());
        formData.append("description", newCategoryDescription.trim());
        try {
            const response = await timedFetch("?/createExpenseCategory", {
                method: "POST",
                body: formData,
                headers: { "x-sveltekit-action": "true" },
            });
            const { ok } = await handleFetchActionFeedback({
                response,
                successMessage: "費用類別已新增",
                failureMessage: "新增費用類別失敗",
            });
            if (ok) {
                newCategoryName = "";
                newCategoryDescription = "";
                isCategoryDialogOpen = false;
                await invalidateAll();
            }
        } catch {
            toast.error(UI_MESSAGES.common.networkFailed("新增費用類別"));
        }
    }

    async function toggleExpenseCategory(item: any, nextValue: boolean) {
        const formData = new FormData();
        formData.append("id", String(item.id));
        formData.append("is_active", nextValue ? "true" : "false");
        try {
            const response = await timedFetch("?/toggleExpenseCategory", {
                method: "POST",
                body: formData,
                headers: { "x-sveltekit-action": "true" },
            });
            const { ok } = await handleFetchActionFeedback({
                response,
                successMessage: nextValue ? "費用類別已啟用" : "費用類別已停用",
                failureMessage: "更新費用類別狀態失敗",
            });
            if (ok) await invalidateAll();
        } catch {
            toast.error(UI_MESSAGES.common.networkFailed("更新費用類別"));
        }
    }

    async function deleteExpenseCategory(item: any) {
        openSystemConfirm({
            title: "確認刪除費用類別",
            description: `確定要刪除「${item.name}」？若已被使用將無法刪除。`,
            buttonLabel: "刪除類別",
            buttonVariant: "destructive",
            action: async () => {
                const formData = new FormData();
                formData.append("id", String(item.id));
                try {
                    const response = await timedFetch("?/deleteExpenseCategory", {
                        method: "POST",
                        body: formData,
                        headers: { "x-sveltekit-action": "true" },
                    });
                    const { ok } = await handleFetchActionFeedback({
                        response,
                        successMessage: "費用類別已刪除",
                        failureMessage: "刪除費用類別失敗",
                    });
                    if (ok) await invalidateAll();
                } catch {
                    toast.error(UI_MESSAGES.common.networkFailed("刪除費用類別"));
                }
            },
        });
    }
</script>

<div in:fade={{ duration: 400 }}>
    <ListPageScaffold
        title="系統設定"
        description="統一管理使用者與費用類別。"
        statText={currentSection === "users"
            ? `${users.length} 位使用者`
            : `${expenseCategories.length} 個費用類別`}
        shellClassName="bg-card pb-2"
    >
        {#snippet statIcon()}
            <Users class="h-4 w-4 text-muted-foreground" />
        {/snippet}
            {#snippet headerActions()}
                {#if currentSection === "categories" && data.canManageCategories}
                    <Button
                        type="button"
                        onclick={() => (isCategoryDialogOpen = true)}
                    >
                        <Plus class="mr-1.5 h-3.5 w-3.5" />
                        新增費用類別
                    </Button>
                {/if}
            {/snippet}
            <ListToolbar>
                {#snippet left()}
                    <div class="flex items-center gap-3">
                        <div class="inline-flex items-center rounded-xl bg-secondary p-1">
                            <button
                                type="button"
                                class={cn(
                                    "rounded-lg px-5 py-2 text-sm font-semibold transition",
                                    currentSection === "users"
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-muted-foreground hover:text-foreground",
                                )}
                                onclick={() => (currentSection = "users")}
                            >
                                使用者管理
                            </button>
                            <button
                                type="button"
                                class={cn(
                                    "rounded-lg px-5 py-2 text-sm font-semibold transition",
                                    currentSection === "categories"
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-muted-foreground hover:text-foreground",
                                )}
                                onclick={() => (currentSection = "categories")}
                            >
                                費用類別
                            </button>
                        </div>
                        {#if currentSection === "users"}
                            <div class="flex items-center gap-2 pl-1">
                                <Label
                                    for="include-inactive-users"
                                    class="text-xs font-medium text-muted-foreground"
                                    >顯示停用</Label
                                >
                                <Switch
                                    id="include-inactive-users"
                                    bind:checked={includeInactiveUsers}
                                    aria-label="顯示停用使用者"
                                />
                            </div>
                        {:else}
                            <div class="flex items-center gap-2 pl-1">
                                <Label
                                    for="include-inactive-categories"
                                    class="text-xs font-medium text-muted-foreground"
                                    >顯示已停用</Label
                                >
                                <Switch
                                    id="include-inactive-categories"
                                    bind:checked={includeInactiveCategories}
                                    aria-label="顯示已停用費用類別"
                                />
                            </div>
                        {/if}
                    </div>
                {/snippet}
                {#snippet right()}
                    <SearchField
                        bind:value={searchTerm}
                        placeholder={currentSection === "users"
                            ? "搜尋姓名或 ID..."
                            : "搜尋費用類別..."}
                        inputClassName="pl-9 text-sm"
                    />
                {/snippet}
            </ListToolbar>

            {#if currentSection === "users"}
            <Table.Root>
                <Table.Header class={LIST_TABLE_TOKENS.header}>
                    <Table.Row class={LIST_TABLE_TOKENS.headerRow}>
                        <Table.Head
                            class={cn(LIST_TABLE_TOKENS.headBase, "w-[200px]")}
                            >使用者</Table.Head
                        >
                        <Table.Head class={LIST_TABLE_TOKENS.headBase}
                            >E-MAIL</Table.Head
                        >
                        <Table.Head
                            class={cn(
                                LIST_TABLE_TOKENS.headBase,
                                LIST_TABLE_TOKENS.colStatus,
                            )}>狀態</Table.Head
                        >
                        <Table.Head class={LIST_TABLE_TOKENS.headBase}>權限</Table.Head>
                        <Table.Head class={LIST_TABLE_TOKENS.headBase}>核准人</Table.Head>
                        <Table.Head class={cn(LIST_TABLE_TOKENS.headBase, LIST_TABLE_TOKENS.colActions)}
                            >系統操作</Table.Head
                        >
                    </Table.Row>
                </Table.Header>
                <Table.Body class={LIST_TABLE_TOKENS.body}>
                    {#each pagedUsers as user}
                        <Table.Row
                            class={cn(
                                LIST_TABLE_TOKENS.row,
                                LIST_TABLE_TOKENS.rowClickable,
                            )}
                            onclick={() => {
                                selectedUser = { ...user };
                                isSheetOpen = true;
                            }}
                        >
                            <Table.Cell>
                                <div class="flex items-center gap-3">
                                    <Avatar.Root class="h-10 w-10">
                                        <Avatar.Image
                                            src={user.avatar_url}
                                            alt={user.full_name}
                                        />
                                        <Avatar.Fallback
                                            >{user.full_name?.charAt(
                                                0,
                                            )}</Avatar.Fallback
                                        >
                                    </Avatar.Root>
                                    <div class="flex flex-col">
                                        <span class="font-medium"
                                            >{user.full_name}</span
                                        >
                                    </div>
                                </div>
                            </Table.Cell>
                            <Table.Cell>
                                <span
                                    class="text-xs text-muted-foreground font-mono"
                                    >{user.email}</span
                                >
                            </Table.Cell>
                            <Table.Cell class={LIST_TABLE_TOKENS.badgeCell}>
                                <div class={LIST_TABLE_TOKENS.badgeWrap}>
                                    {#if isActiveUser(user)}
                                        <StatusBadge status="active" />
                                    {:else}
                                        <StatusBadge status="inactive" />
                                    {/if}
                                </div>
                            </Table.Cell>
                            <Table.Cell class={LIST_TABLE_TOKENS.badgeCell}>
                                <div
                                    class="flex gap-1.5 flex-nowrap items-center justify-center"
                                >
                                    {#if user.is_admin}
                                        <AppBadge preset="role.admin" />
                                    {/if}
                                    {#if user.is_finance}
                                        <AppBadge preset="role.finance" />
                                    {/if}
                                    {#if !user.is_admin && !user.is_finance}
                                        <AppBadge preset="role.employee" />
                                    {/if}
                                </div>
                            </Table.Cell>
                            <Table.Cell class={LIST_TABLE_TOKENS.roleCell}>
                                {data.approverOptions.find(
                                    (o) => o.id === user.approver_id,
                                )?.full_name || "—"}
                            </Table.Cell>
                            <Table.Cell class="text-right">
                                <RowActionButtons>
                                    {#if data.canManageLifecycle && isActiveUser(user)}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            class="h-8 w-8 text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
                                            onclick={(e) => {
                                                e.stopPropagation();
                                                openSystemConfirm({
                                                    title: "確認停用帳號",
                                                    description: `確定要停用使用者「${user.full_name}」？`,
                                                    buttonLabel: "停用帳號",
                                                    buttonVariant:
                                                        "destructive",
                                                    action: () =>
                                                        deactivateUser(user.id),
                                                });
                                            }}
                                            title="停用帳號"
                                        >
                                            <UserX class="h-4 w-4" />
                                        </Button>
                                    {:else if data.canManageLifecycle}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            class="h-8 w-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50"
                                            onclick={(e) => {
                                                e.stopPropagation();
                                                openSystemConfirm({
                                                    title: "確認重新啟用",
                                                    description: `確定要重新啟用使用者「${user.full_name}」？`,
                                                    buttonLabel: "重新啟用",
                                                    action: () =>
                                                        reactivateUser(user.id),
                                                });
                                            }}
                                            title="重新啟用"
                                        >
                                            <UserCheck class="h-4 w-4" />
                                        </Button>
                                    {/if}
                                    {#if data.canManageLifecycle}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            class="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                                            onclick={(e) => {
                                                e.stopPropagation();
                                                openSystemConfirm({
                                                    title: "確認永久刪除",
                                                    description: `確定要永久刪除使用者「${user.full_name}」？此操作無法復原。`,
                                                    buttonLabel: "永久刪除",
                                                    buttonVariant:
                                                        "destructive",
                                                    action: () =>
                                                        removeUser(user.id),
                                                });
                                            }}
                                            title="永久刪除"
                                        >
                                            <Trash2 class="h-4 w-4" />
                                        </Button>
                                    {/if}
                                </RowActionButtons>
                            </Table.Cell>
                        </Table.Row>
                    {:else}
                        <ListTableEmptyState
                            icon={Users}
                            description={emptyMessage}
                            colspan={6}
                        />
                    {/each}
                </Table.Body>
            </Table.Root>
            <ListPagination
                totalItems={filteredUsers.length}
                pageSize={PAGE_SIZE}
                bind:currentPage={userPage}
            />
            {:else}
                <Table.Root>
                    <Table.Header class={LIST_TABLE_TOKENS.header}>
                        <Table.Row class={LIST_TABLE_TOKENS.headerRow}>
                            <Table.Head class={LIST_TABLE_TOKENS.headBase}>
                                類別名稱
                            </Table.Head>
                            <Table.Head class={LIST_TABLE_TOKENS.headBase}>
                                適用情境
                            </Table.Head>
                            <Table.Head class={cn(LIST_TABLE_TOKENS.headBase, LIST_TABLE_TOKENS.colStatus)}>
                                狀態
                            </Table.Head>
                            <Table.Head class={cn(LIST_TABLE_TOKENS.headBase, LIST_TABLE_TOKENS.colActions)}>
                                操作
                            </Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body class={LIST_TABLE_TOKENS.body}>
                        {#each pagedCategories as item}
                            <Table.Row class={LIST_TABLE_TOKENS.row}>
                                <Table.Cell>
                                    <span class="font-medium">{item.name}</span>
                                </Table.Cell>
                                <Table.Cell class="text-muted-foreground">
                                    {item.description || "—"}
                                </Table.Cell>
                                <Table.Cell class={LIST_TABLE_TOKENS.badgeCell}>
                                    <div class={LIST_TABLE_TOKENS.badgeWrap}>
                                        <StatusBadge
                                            status={item.is_active ? "active" : "inactive"}
                                        />
                                    </div>
                                </Table.Cell>
                                <Table.Cell class="text-right">
                                    <RowActionButtons>
                                        <div class="flex items-center gap-2">
                                            {#if data.canManageCategories}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    class={cn(
                                                        "h-8 w-8",
                                                        item.is_active
                                                            ? "text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
                                                            : "text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50",
                                                    )}
                                                    onclick={() =>
                                                        void toggleExpenseCategory(
                                                            item,
                                                            !item.is_active,
                                                        )}
                                                    title={item.is_active
                                                        ? "停用費用類別"
                                                        : "啟用費用類別"}
                                                >
                                                    {#if item.is_active}
                                                        <UserX class="h-4 w-4" />
                                                    {:else}
                                                        <UserCheck class="h-4 w-4" />
                                                    {/if}
                                                </Button>
                                            {/if}
                                            {#if data.canManageCategories}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    class="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                                                    onclick={() => void deleteExpenseCategory(item)}
                                                    title="刪除費用類別"
                                                >
                                                    <Trash2 class="h-4 w-4" />
                                                </Button>
                                            {/if}
                                        </div>
                                    </RowActionButtons>
                                </Table.Cell>
                            </Table.Row>
                        {:else}
                            <ListTableEmptyState
                                icon={Users}
                                description={categoryEmptyMessage}
                                colspan={4}
                            />
                        {/each}
                    </Table.Body>
                </Table.Root>
                <ListPagination
                    totalItems={filteredCategories.length}
                    pageSize={PAGE_SIZE}
                    bind:currentPage={categoryPage}
                />
            {/if}
    </ListPageScaffold>
</div>

{#if selectedUser}
    <UserProfileSheet
        user={selectedUser}
        bind:open={isSheetOpen}
        isManagementMode={true}
        approverOptions={data.approverOptions}
        canEditPermissions={data.canManagePermissions}
    />
{/if}

<ConfirmActionDialog
    bind:open={isConfirmOpen}
    title={confirmTitle}
    description={confirmDescription}
    confirmLabel={confirmButtonLabel}
    confirmVariant={confirmButtonVariant}
    disabled={!confirmAction}
    onCancel={() => (isConfirmOpen = false)}
    onConfirm={runConfirmedAction}
/>

<Dialog.Root bind:open={isCategoryDialogOpen}>
    <Dialog.Content class="sm:max-w-[520px]">
        <Dialog.Header>
            <Dialog.Title>新增費用類別</Dialog.Title>
            <Dialog.Description>
                請輸入費用類別名稱與適用情境說明。
            </Dialog.Description>
        </Dialog.Header>

        <div class="space-y-4 py-1">
            <div class="space-y-2">
                <Label for="new-category-name">費用類別名稱</Label>
                <input
                    id="new-category-name"
                    class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    bind:value={newCategoryName}
                    placeholder="例：租金支出"
                />
            </div>
            <div class="space-y-2">
                <Label for="new-category-description">適用情境</Label>
                <textarea
                    id="new-category-description"
                    class="min-h-[92px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    bind:value={newCategoryDescription}
                    placeholder="請描述此費用類別的使用情境。"
                />
            </div>
        </div>

        <Dialog.Footer>
            <Button
                type="button"
                variant="outline"
                onclick={() => (isCategoryDialogOpen = false)}
            >
                取消
            </Button>
            <Button
                type="button"
                onclick={createExpenseCategory}
                disabled={!newCategoryName.trim() || !newCategoryDescription.trim()}
            >
                <Plus class="mr-1.5 h-3.5 w-3.5" />
                新增
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
