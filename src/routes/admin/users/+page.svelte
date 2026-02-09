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
    import { enhance } from "$app/forms";
    import { Button } from "$lib/components/ui/button";
    import * as Table from "$lib/components/ui/table";
    import * as Avatar from "$lib/components/ui/avatar";
    import * as Select from "$lib/components/ui/select";
    import { Badge } from "$lib/components/ui/badge";
    import { toast } from "svelte-sonner";
    import {
        Shield,
        CreditCard,
        UserCheck,
        Search,
        Users,
        Settings2,
    } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";

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
        const formData = new FormData();
        formData.append("userId", userId);
        formData.append("field", field);
        formData.append("value", String(!currentValue));

        const response = await fetch("?/updateUserPermissions", {
            method: "POST",
            body: formData,
        });

        if (response.ok) {
            // 手動更新本地狀態物件，觸發 Svelte 5 的 Proxy 選取
            const index = users.findIndex((u) => u.id === userId);
            if (index !== -1) {
                users[index] = { ...users[index], [field]: !currentValue };
            }
            toast.success("權限已更新");
        } else {
            toast.error("操作失敗");
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
        const formData = new FormData();
        formData.append("userId", userId);
        formData.append("approverId", approverId || "");

        const response = await fetch("?/assignApprover", {
            method: "POST",
            body: formData,
        });

        if (response.ok) {
            const index = users.findIndex((u) => u.id === userId);
            if (index !== -1) {
                users[index] = { ...users[index], approver_id: approverId };
            }
            toast.success("核准人指派成功");
        } else {
            toast.error("操作失敗");
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
                                    >
                                        {user.is_admin
                                            ? "取消管理"
                                            : "設為管理"}
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
