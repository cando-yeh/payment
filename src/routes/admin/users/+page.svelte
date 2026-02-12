<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Table from "$lib/components/ui/table";
    import * as Avatar from "$lib/components/ui/avatar";
    import * as Select from "$lib/components/ui/select";
    import * as Tabs from "$lib/components/ui/tabs";
    import { Badge } from "$lib/components/ui/badge";
    import { toast } from "svelte-sonner";
    import {
        Shield,
        CreditCard,
        Search,
        Users,
        Trash2,
        UserX,
        UserCheck,
    } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";
    import { timedFetch } from "$lib/client/timed-fetch";
    import { deserialize } from "$app/forms";
    import UserProfileSheet from "$lib/components/layout/UserProfileSheet.svelte";

    let { data } = $props();

    let users = $state<any[]>([]);
    let searchTerm = $state("");
    let currentTab = $state<"active" | "inactive">("active");
    let pendingOps = $state<Record<string, boolean>>({});

    // 選中的使用者資料（用於開啟 Sheet）
    let selectedUser = $state<any>(null);
    let isSheetOpen = $state(false);

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

    // 當 Sheet 關閉時，清除選中的使用者，確保下次點擊能正常觸發
    $effect(() => {
        if (!isSheetOpen) {
            selectedUser = null;
        }
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

    const activeApproverOptions = $derived(
        users
            .filter((u) => isActiveUser(u))
            .map((u) => ({ id: u.id, full_name: u.full_name })),
    );

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

    async function togglePermission(
        userId: string,
        field: string,
        currentValue: boolean,
    ) {
        const opKey = `perm:${userId}:${field}`;
        if (pendingOps[opKey]) return;

        const index = users.findIndex((u) => u.id === userId);
        if (index === -1 || !isActiveUser(users[index])) return;

        const previous = users[index];
        const nextValue = !currentValue;
        users[index] = { ...previous, [field]: nextValue };
        setPending(opKey, true);

        const formData = new FormData();
        formData.append("userId", userId);
        formData.append("field", field);
        formData.append("value", String(nextValue));

        try {
            const response = await timedFetch("?/updateUserPermissions", {
                method: "POST",
                body: formData,
                headers: { "x-sveltekit-action": "true" },
            });
            await parseActionResponse(response, "權限更新失敗");
            toast.success("權限已更新");
        } catch (e: any) {
            users[index] = previous;
            toast.error(e?.message || "權限更新失敗");
        } finally {
            setPending(opKey, false);
        }
    }

    async function selectApprover(
        userId: string,
        approverId: string | undefined,
    ) {
        const opKey = `approver:${userId}`;
        if (pendingOps[opKey]) return;

        const index = users.findIndex((u) => u.id === userId);
        if (index === -1 || !isActiveUser(users[index])) return;

        const previous = users[index];
        users[index] = { ...previous, approver_id: approverId || null };
        setPending(opKey, true);

        const formData = new FormData();
        formData.append("userId", userId);
        formData.append("approverId", approverId || "");

        try {
            const response = await timedFetch("?/assignApprover", {
                method: "POST",
                body: formData,
                headers: { "x-sveltekit-action": "true" },
            });
            await parseActionResponse(response, "核准人指派失敗");
            toast.success("核准人指派成功");
        } catch (e: any) {
            users[index] = previous;
            toast.error(e?.message || "核准人指派失敗");
        } finally {
            setPending(opKey, false);
        }
    }

    async function deactivateUser(userId: string, userName: string) {
        if (!confirm(`確定要停用使用者「${userName}」？`)) return;

        const opKey = `deactivate:${userId}`;
        if (pendingOps[opKey]) return;

        const index = users.findIndex((u) => u.id === userId);
        if (index === -1) return;

        const previous = users[index];
        users[index] = {
            ...previous,
            is_active: false,
            approver_id: null,
            is_admin: false,
            is_finance: false,
        };
        users = users.map((u) =>
            u.approver_id === userId ? { ...u, approver_id: null } : u,
        );
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
            toast.success("使用者已停用");
        } catch (e: any) {
            users[index] = previous;
            toast.error(e?.message || "停用失敗");
        } finally {
            setPending(opKey, false);
        }
    }

    async function reactivateUser(userId: string, userName: string) {
        if (!confirm(`確定要重新啟用使用者「${userName}」？`)) return;

        const opKey = `reactivate:${userId}`;
        if (pendingOps[opKey]) return;

        const index = users.findIndex((u) => u.id === userId);
        if (index === -1) return;

        const previous = users[index];
        users[index] = {
            ...previous,
            is_active: true,
            deactivated_at: null,
            deactivated_by: null,
            deactivate_reason: null,
        };
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
            toast.success("使用者已重新啟用");
        } catch (e: any) {
            users[index] = previous;
            toast.error(e?.message || "重新啟用失敗");
        } finally {
            setPending(opKey, false);
        }
    }

    async function removeUser(userId: string, userName: string) {
        if (!confirm(`確定要永久刪除使用者「${userName}」？此操作無法復原。`)) {
            return;
        }

        const opKey = `delete:${userId}`;
        if (pendingOps[opKey]) return;

        const index = users.findIndex((u) => u.id === userId);
        if (index === -1) return;

        const previous = users[index];
        users = users.filter((u) => u.id !== userId);
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
            toast.success("使用者已永久刪除");
        } catch (e: any) {
            users = [...users, previous].sort(
                (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime(),
            );
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
                        <Table.Head class="w-[260px]">使用者</Table.Head>
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
                                        <span
                                            class="text-xs text-muted-foreground font-mono"
                                            >{user.email}</span
                                        >
                                    </div>
                                </div>
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
                                            class="bg-blue-50 text-blue-700 border-blue-200 gap-1 text-[10px] px-1.5 py-0"
                                        >
                                            管理員
                                        </Badge>
                                    {/if}
                                    {#if user.is_finance}
                                        <Badge
                                            variant="secondary"
                                            class="bg-amber-50 text-amber-700 border-amber-200 gap-1 text-[10px] px-1.5 py-0"
                                        >
                                            財務
                                        </Badge>
                                    {/if}
                                    {#if !user.is_admin && !user.is_finance}
                                        <Badge
                                            variant="outline"
                                            class="text-[10px] px-1.5 py-0"
                                            >員工</Badge
                                        >
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
                                                deactivateUser(
                                                    user.id,
                                                    user.full_name,
                                                );
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
                                                reactivateUser(
                                                    user.id,
                                                    user.full_name,
                                                );
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
                                            removeUser(user.id, user.full_name);
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
                                colspan={5}
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

{#if selectedUser && isSheetOpen}
    <UserProfileSheet
        user={selectedUser}
        bind:open={isSheetOpen}
        isManagementMode={true}
        approverOptions={data.approverOptions}
    />
{/if}
