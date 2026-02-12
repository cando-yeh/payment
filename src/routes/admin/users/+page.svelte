<script lang="ts">
    /**
     * Admin Users Page
     *
     * 職責：
     * 1. 讓管理員管理系統內所有使用者的角色權限。
     * 2. 指派每個使用者的核准人 (Approver)。
     *
     * 技術重點：
     * - 使用 Svelte 5 $state 與 $effect 處理伺服器資料與本地資料的即時同步。
     * - 實作樂觀更新 (Optimistic UI)，點擊按鈕後立即更新本地狀態，提升操作流暢感。
     */
    import { Button } from "$lib/components/ui/button";
    import * as Table from "$lib/components/ui/table";
    import * as Avatar from "$lib/components/ui/avatar";
    import * as Select from "$lib/components/ui/select";
    import { Badge } from "$lib/components/ui/badge";
    import { toast } from "svelte-sonner";
    import { Shield, CreditCard, Search, Users, Trash2 } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";
    import { timedFetch } from "$lib/client/timed-fetch";
    import { deserialize } from "$app/forms";

    let { data } = $props();

    /**
     * 本地使用者狀態
     * 我們不直接在 Template 使用 data.users，而是轉換為 $state，
     * 這樣我們在 fetch 成功後可以直接修改該陣列項目，觸發 UI 局部重新渲染。
     */
    let users = $state<any[]>([]);

    /**
     * 資料同步效應
     *
     * 如果頁面被重新整理或 data 物件發生變化，確保本地狀態能跟上。
     */
    $effect(() => {
        users = data.users;
    });

    let searchTerm = $state("");

    /**
     * 衍生搜尋結果
     */
    let filteredUsers = $derived(
        users.filter(
            (u) =>
                u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.id.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
    );
    let pendingOps = $state<Record<string, boolean>>({});

    function setPending(op: string, isPending: boolean) {
        pendingOps = { ...pendingOps, [op]: isPending };
    }

    /**
     * 更新使用者權限 (管理員/財務)
     *
     * 使用 fetch 直接呼叫後端 Action 並取得結果後手動更新 users 狀態，
     * 以維持 Svelte 5 的零延遲反應性。
     */
    async function togglePermission(
        userId: string,
        field: string,
        currentValue: boolean,
    ) {
        const opKey = `perm:${userId}:${field}`;
        if (pendingOps[opKey]) return;

        const index = users.findIndex((u) => u.id === userId);
        if (index === -1) return;

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

            if (!response.ok) {
                throw new Error("操作失敗");
            }
            toast.success("權限已更新");
        } catch {
            users[index] = previous;
            toast.error("操作失敗");
        } finally {
            setPending(opKey, false);
        }
    }

    /**
     * 指派核准人
     *
     * 同樣使用 fetch + 本地狀態更新模式，
     * 確保選擇核准人後下拉選單能立即反映正確的名稱。
     */
    async function selectApprover(
        userId: string,
        approverId: string | undefined,
    ) {
        const opKey = `approver:${userId}`;
        if (pendingOps[opKey]) return;

        const index = users.findIndex((u) => u.id === userId);
        if (index === -1) return;

        const previous = users[index];
        users[index] = { ...previous, approver_id: approverId };
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

            if (!response.ok) {
                throw new Error("操作失敗");
            }
            toast.success("核准人指派成功");
        } catch {
            users[index] = previous;
            toast.error("操作失敗");
        } finally {
            setPending(opKey, false);
        }
    }

    /**
     * 刪除使用者
     *
     * 增加二次確認機制，並在失敗時解析後端傳回的詳細錯誤訊息。
     */
    async function removeUser(userId: string, userName: string) {
        if (!confirm(`確定要刪除使用者「${userName}」嗎？此操作無法復原。`)) {
            return;
        }

        const opKey = `delete:${userId}`;
        if (pendingOps[opKey]) return;

        const index = users.findIndex((u) => u.id === userId);
        if (index === -1) return;

        const previous = users[index];
        // 樂觀更新：先從本地列表中移除
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

            const responseText = await response.text();
            let result: any = null;
            try {
                result = deserialize(responseText) as any;
            } catch {
                try {
                    result = JSON.parse(responseText);
                } catch {
                    result = null;
                }
            }

            const resolveMessage = (data: any, fallback: string) => {
                if (typeof data?.message === "string") return data.message;
                if (Array.isArray(data) && typeof data[1] === "string")
                    return data[1];
                return fallback;
            };

            if (result?.type === "failure") {
                throw new Error(resolveMessage(result?.data, "刪除失敗"));
            }
            if (!response.ok || (result?.type && result.type !== "success")) {
                throw new Error(resolveMessage(result?.data, "刪除失敗"));
            }

            toast.success("使用者已成功刪除");
        } catch (e: any) {
            // 復原本地狀態
            users = [...users, previous].sort(
                (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime(),
            );
            toast.error(e.message || "操作失敗");
        } finally {
            setPending(opKey, false);
        }
    }
</script>

<div class="container py-10">
    <div class="flex flex-col gap-8">
        <!-- 標題區域 -->
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-3xl font-bold tracking-tight">使用者管理</h1>
                <p class="text-muted-foreground">
                    管理員可在此指派核准人、授權財務權限及調整系統角色。
                </p>
            </div>
            <div class="flex items-center gap-4">
                <div
                    class="flex items-center gap-2 rounded-lg bg-muted px-4 py-2"
                >
                    <Users class="h-4 w-4 text-muted-foreground" />
                    <span class="text-sm font-medium"
                        >{users.length} 位使用者</span
                    >
                </div>
            </div>
        </div>

        <!-- 搜尋與過濾 -->
        <div class="flex items-center gap-4">
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

        <!-- 使用者列表表格 -->
        <div class="rounded-md border bg-card">
            <Table.Root>
                <Table.Header>
                    <Table.Row>
                        <Table.Head class="w-[280px]">使用者</Table.Head>
                        <Table.Head>權限角色</Table.Head>
                        <Table.Head>指派核准人</Table.Head>
                        <Table.Head class="text-right">系統操作</Table.Head>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {#each filteredUsers as user}
                        <Table.Row class="hover:bg-muted/30">
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
                                            >{user.id.slice(0, 8)}...</span
                                        >
                                    </div>
                                </div>
                            </Table.Cell>
                            <Table.Cell>
                                <div class="flex gap-2">
                                    {#if user.is_admin}
                                        <Badge
                                            variant="default"
                                            class="bg-primary text-primary-foreground gap-1"
                                        >
                                            <Shield class="h-3 w-3" />
                                            管理員
                                        </Badge>
                                    {/if}
                                    {#if user.is_finance}
                                        <Badge
                                            variant="secondary"
                                            class="gap-1"
                                        >
                                            <CreditCard class="h-3 w-3" />
                                            財務
                                        </Badge>
                                    {/if}
                                    {#if !user.is_admin && !user.is_finance}
                                        <Badge variant="outline">一般員工</Badge
                                        >
                                    {/if}
                                </div>
                            </Table.Cell>
                            <Table.Cell>
                                <Select.Root
                                    type="single"
                                    value={user.approver_id || ""}
                                    disabled={pendingOps[`approver:${user.id}`]}
                                    onValueChange={(v) =>
                                        selectApprover(user.id, v)}
                                >
                                    <Select.Trigger class="w-[200px]">
                                        <div class="flex items-center gap-2">
                                            <span>
                                                {data.approverOptions.find(
                                                    (o) =>
                                                        o.id ===
                                                        user.approver_id,
                                                )?.full_name || "選擇核准人"}
                                            </span>
                                        </div>
                                    </Select.Trigger>
                                    <Select.Content>
                                        <Select.Item value="">(無)</Select.Item>
                                        {#each data.approverOptions.filter((o) => o.id !== user.id) as option}
                                            <Select.Item
                                                value={option.id}
                                                label={option.full_name}
                                                >{option.full_name}</Select.Item
                                            >
                                        {/each}
                                    </Select.Content>
                                </Select.Root>
                            </Table.Cell>
                            <Table.Cell class="text-right">
                                <div class="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class={user.is_finance
                                            ? "text-primary border-primary bg-primary/5"
                                            : ""}
                                        onclick={() =>
                                            togglePermission(
                                                user.id,
                                                "is_finance",
                                                user.is_finance,
                                            )}
                                        disabled={pendingOps[
                                            `perm:${user.id}:is_finance`
                                        ]}
                                    >
                                        {user.is_finance
                                            ? "取消財務"
                                            : "設為財務"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class={user.is_admin
                                            ? "text-destructive border-destructive bg-destructive/5"
                                            : ""}
                                        onclick={() =>
                                            togglePermission(
                                                user.id,
                                                "is_admin",
                                                user.is_admin,
                                            )}
                                        disabled={pendingOps[
                                            `perm:${user.id}:is_admin`
                                        ]}
                                    >
                                        {user.is_admin
                                            ? "取消管理"
                                            : "設為管理"}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        class="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        onclick={() =>
                                            removeUser(user.id, user.full_name)}
                                        disabled={pendingOps[
                                            `delete:${user.id}`
                                        ]}
                                    >
                                        <Trash2 class="h-4 w-4" />
                                    </Button>
                                </div>
                            </Table.Cell>
                        </Table.Row>
                    {/each}
                </Table.Body>
            </Table.Root>
        </div>
    </div>
</div>
