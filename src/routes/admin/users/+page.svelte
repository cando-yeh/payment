<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Table from "$lib/components/ui/table";
    import * as Avatar from "$lib/components/ui/avatar";
    import * as Tabs from "$lib/components/ui/tabs";
    import * as Dialog from "$lib/components/ui/dialog";
    import AppBadge from "$lib/components/common/AppBadge.svelte";
    import { toast } from "svelte-sonner";
    import { Search, Users, Trash2, UserX, UserCheck } from "lucide-svelte";
    import { timedFetch } from "$lib/client/timed-fetch";
    import { deserialize } from "$app/forms";
    import { invalidateAll } from "$app/navigation";
    import UserProfileSheet from "$lib/components/layout/UserProfileSheet.svelte";
    import ListPageScaffold from "$lib/components/common/ListPageScaffold.svelte";
    import ListToolbar from "$lib/components/common/ListToolbar.svelte";
    import SearchField from "$lib/components/common/SearchField.svelte";
    import RowActionButtons from "$lib/components/common/RowActionButtons.svelte";
    import ConfirmActionDialog from "$lib/components/common/ConfirmActionDialog.svelte";
    import ListTableEmptyState from "$lib/components/common/ListTableEmptyState.svelte";
    import StatusBadge from "$lib/components/common/StatusBadge.svelte";
    import { LIST_TABLE_TOKENS } from "$lib/components/common/list-table-tokens";
    import { cn } from "$lib/utils";
    import { fade } from "svelte/transition";
    import { UI_MESSAGES } from "$lib/constants/ui-messages";

    let { data } = $props();

    let users = $state<any[]>([]);
    let searchTerm = $state("");
    let currentTab = $state<"active" | "inactive">("active");
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
        currentTab = data.defaultTab === "inactive" ? "inactive" : "active";
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

    const activeCount = $derived(users.filter((u) => isActiveUser(u)).length);
    const inactiveCount = $derived(
        users.filter((u) => !isActiveUser(u)).length,
    );

    const tabFilteredUsers = $derived.by(() =>
        users.filter((u) => {
            const activeMatches =
                currentTab === "active" ? isActiveUser(u) : !isActiveUser(u);
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

    const emptyMessage = $derived.by(() => {
        const keyword = searchTerm.trim();
        if (users.length === 0) return "目前尚無使用者";
        if (keyword && filteredUsers.length === 0)
            return `找不到符合「${keyword}」的結果`;
        if (tabFilteredUsers.length === 0) return "目前篩選條件下沒有結果";
        return "目前尚無使用者";
    });

    function resolveActionMessage(payload: any, fallback: string) {
        if (typeof payload?.message === "string") return payload.message;
        if (Array.isArray(payload) && typeof payload[1] === "string")
            return payload[1];
        return fallback;
    }

    async function parseActionResponse(response: Response, fallback: string) {
        const text = await response.text();
        let result: any = null;
        try {
            result = deserialize(text) as any;
        } catch {
            try {
                result = JSON.parse(text);
            } catch {
                result = null;
            }
        }

        if (result?.type === "failure") {
            throw new Error(resolveActionMessage(result?.data, fallback));
        }
        if (!response.ok || (result?.type && result.type !== "success")) {
            throw new Error(resolveActionMessage(result?.data, fallback));
        }
        return result;
    }

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
            await parseActionResponse(response, "停用失敗");
            await invalidateAll();
            toast.success(UI_MESSAGES.user.deactivated);
        } catch (e: any) {
            toast.error(e?.message || UI_MESSAGES.user.deactivateFailed);
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
            await parseActionResponse(response, "重新啟用失敗");
            await invalidateAll();
            toast.success(UI_MESSAGES.user.reactivated);
        } catch (e: any) {
            toast.error(e?.message || UI_MESSAGES.user.reactivateFailed);
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
            await parseActionResponse(response, "永久刪除失敗");
            await invalidateAll();
            toast.success(UI_MESSAGES.user.deleted);
        } catch (e: any) {
            toast.error(e?.message || UI_MESSAGES.user.deleteFailed);
        } finally {
            setPending(opKey, false);
        }
    }
</script>

<div in:fade={{ duration: 400 }}>
    <ListPageScaffold
        title="使用者管理"
        description="管理員可停用/啟用/刪除使用者；財務可維護銀行與核准人資訊。"
        statText={`${users.length} 位使用者`}
        shellClassName="bg-card pb-2"
    >
        {#snippet statIcon()}
            <Users class="h-4 w-4 text-muted-foreground" />
        {/snippet}
            <Tabs.Root
                value={currentTab}
                onValueChange={(v) =>
                    (currentTab = v === "inactive" ? "inactive" : "active")}
            >
                <ListToolbar>
                    {#snippet left()}
                        <Tabs.List
                            class="bg-secondary/40 p-1 rounded-xl h-auto inline-flex gap-1 flex-nowrap"
                        >
                            <Tabs.Trigger
                                value="active"
                                class="rounded-lg px-5 py-2 font-bold text-xs whitespace-nowrap gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                啟用中 ({activeCount})
                            </Tabs.Trigger>
                            <Tabs.Trigger
                                value="inactive"
                                class="rounded-lg px-5 py-2 font-bold text-xs whitespace-nowrap gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                已停用 ({inactiveCount})
                            </Tabs.Trigger>
                        </Tabs.List>
                    {/snippet}
                    {#snippet right()}
                        <SearchField
                            bind:value={searchTerm}
                            placeholder="搜尋姓名或 ID..."
                            inputClassName="pl-9 text-sm"
                        />
                    {/snippet}
                </ListToolbar>
            </Tabs.Root>
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
                    {#each filteredUsers as user}
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
