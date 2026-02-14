<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Table from "$lib/components/ui/table";
    import * as Avatar from "$lib/components/ui/avatar";
    import * as Tabs from "$lib/components/ui/tabs";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Badge } from "$lib/components/ui/badge";
    import { toast } from "svelte-sonner";
    import { Search, Users, Trash2, UserX, UserCheck } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";
    import { timedFetch } from "$lib/client/timed-fetch";
    import { deserialize } from "$app/forms";
    import { invalidateAll } from "$app/navigation";
    import UserProfileSheet from "$lib/components/layout/UserProfileSheet.svelte";

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

    const filteredUsers = $derived.by(() => {
        const normalized = searchTerm.trim().toLowerCase();
        return users.filter((u) => {
            const activeMatches =
                currentTab === "active" ? isActiveUser(u) : !isActiveUser(u);
            if (!activeMatches) return false;
            if (!normalized) return true;
            const fullName = String(u.full_name || "").toLowerCase();
            const id = String(u.id || "").toLowerCase();
            return fullName.includes(normalized) || id.includes(normalized);
        });
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
            toast.success("使用者已停用");
        } catch (e: any) {
            toast.error(e?.message || "停用失敗");
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
            toast.success("使用者已重新啟用");
        } catch (e: any) {
            toast.error(e?.message || "重新啟用失敗");
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
            toast.success("使用者已永久刪除");
        } catch (e: any) {
            toast.error(e?.message || "永久刪除失敗");
        } finally {
            setPending(opKey, false);
        }
    }
</script>

<div class="container py-10">
    <div class="flex flex-col gap-8">
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-3xl font-bold tracking-tight">使用者管理</h1>
                <p class="text-muted-foreground">
                    管理員可停用/啟用使用者，僅對無任何關聯資料的帳號執行永久刪除。
                </p>
            </div>
            <div class="flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
                <Users class="h-4 w-4 text-muted-foreground" />
                <span class="text-sm font-medium">{users.length} 位使用者</span>
            </div>
        </div>

        <Tabs.Root
            value={currentTab}
            onValueChange={(v) =>
                (currentTab = v === "inactive" ? "inactive" : "active")}
        >
            <div class="flex items-center justify-between gap-4">
                <Tabs.List>
                    <Tabs.Trigger value="active">
                        啟用中 ({activeCount})
                    </Tabs.Trigger>
                    <Tabs.Trigger value="inactive">
                        已停用 ({inactiveCount})
                    </Tabs.Trigger>
                </Tabs.List>
                <div class="relative flex-1 max-w-sm">
                    <Search
                        class="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
                    />
                    <Input
                        placeholder="搜尋姓名或 ID..."
                        class="pl-9"
                        bind:value={searchTerm}
                    />
                </div>
            </div>
        </Tabs.Root>

        <div class="rounded-md border bg-card">
            <Table.Root>
                <Table.Header>
                    <Table.Row>
                        <Table.Head class="w-[200px]">使用者</Table.Head>
                        <Table.Head>E-MAIL</Table.Head>
                        <Table.Head>狀態</Table.Head>
                        <Table.Head>權限</Table.Head>
                        <Table.Head>核准人</Table.Head>
                        <Table.Head class="text-right">系統操作</Table.Head>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {#each filteredUsers as user}
                        <Table.Row
                            class="hover:bg-muted/20 cursor-pointer"
                            on:click={() => {
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
                            <Table.Cell>
                                {#if isActiveUser(user)}
                                    <Badge
                                        variant="secondary"
                                        class="bg-emerald-50 text-emerald-700 border-emerald-200"
                                        >啟用中</Badge
                                    >
                                {:else}
                                    <Badge
                                        variant="outline"
                                        class="text-muted-foreground"
                                        >已停用</Badge
                                    >
                                {/if}
                            </Table.Cell>
                            <Table.Cell>
                                <div class="flex gap-1.5 flex-wrap">
                                    {#if user.is_admin}
                                        <Badge
                                            variant="default"
                                            class="bg-blue-50 text-blue-700 border-blue-200"
                                        >
                                            管理員
                                        </Badge>
                                    {/if}
                                    {#if user.is_finance}
                                        <Badge
                                            variant="secondary"
                                            class="bg-amber-50 text-amber-700 border-amber-200"
                                        >
                                            財務
                                        </Badge>
                                    {/if}
                                    {#if !user.is_admin && !user.is_finance}
                                        <Badge variant="outline">員工</Badge>
                                    {/if}
                                </div>
                            </Table.Cell>
                            <Table.Cell>
                                <span class="text-sm text-muted-foreground">
                                    {data.approverOptions.find(
                                        (o) => o.id === user.approver_id,
                                    )?.full_name || "—"}
                                </span>
                            </Table.Cell>
                            <Table.Cell class="text-right">
                                <div
                                    class="flex items-center justify-end gap-1"
                                >
                                    {#if isActiveUser(user)}
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
                                                        deactivateUser(
                                                            user.id,
                                                        ),
                                                });
                                            }}
                                            title="停用帳號"
                                        >
                                            <UserX class="h-4 w-4" />
                                        </Button>
                                    {:else}
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
                                                        reactivateUser(
                                                            user.id,
                                                        ),
                                                });
                                            }}
                                            title="重新啟用"
                                        >
                                            <UserCheck class="h-4 w-4" />
                                        </Button>
                                    {/if}
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
                                                buttonVariant: "destructive",
                                                action: () =>
                                                    removeUser(
                                                        user.id,
                                                    ),
                                            });
                                        }}
                                        title="永久刪除"
                                    >
                                        <Trash2 class="h-4 w-4" />
                                    </Button>
                                </div>
                            </Table.Cell>
                        </Table.Row>
                    {:else}
                        <Table.Row>
                            <Table.Cell
                                colspan={6}
                                class="h-48 text-center text-muted-foreground"
                            >
                                無符合條件的使用者
                            </Table.Cell>
                        </Table.Row>
                    {/each}
                </Table.Body>
            </Table.Root>
        </div>
    </div>
</div>

{#if selectedUser}
    <UserProfileSheet
        user={selectedUser}
        bind:open={isSheetOpen}
        isManagementMode={true}
        approverOptions={data.approverOptions}
    />
{/if}

<Dialog.Root bind:open={isConfirmOpen}>
    <Dialog.Content class="max-w-md">
        <Dialog.Header>
            <Dialog.Title>{confirmTitle}</Dialog.Title>
            <Dialog.Description>{confirmDescription}</Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
            <Button variant="outline" onclick={() => (isConfirmOpen = false)}
                >取消</Button
            >
            <Button
                variant={confirmButtonVariant}
                onclick={runConfirmedAction}
                disabled={!confirmAction}
            >
                {confirmButtonLabel}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
