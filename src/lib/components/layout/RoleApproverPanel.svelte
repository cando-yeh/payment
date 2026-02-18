<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Label } from "$lib/components/ui/label";
    import PayeeCombobox from "$lib/components/layout/PayeeCombobox.svelte";
    import { cn } from "$lib/utils.js";
    import { CreditCard, ShieldCheck, Users, ChevronDown } from "lucide-svelte";

    type ApproverOption = { id: string; full_name: string };
    type RoleKey = "admin" | "finance";

    let {
        editable = false,
        allowRoleEdit = true,
        isEditing = false,
        isAdmin = $bindable(false),
        isFinance = $bindable(false),
        approverId = $bindable(""),
        approverName = "(無)",
        approverOptions = [] as ApproverOption[],
        currentUserId = "",
        helperText = "",
    } = $props();

    const roleConfigs: Array<{
        key: RoleKey;
        label: string;
        icon: typeof ShieldCheck;
    }> = [
        { key: "admin", label: "管理員", icon: ShieldCheck },
        { key: "finance", label: "財務", icon: CreditCard },
    ];

    function isRoleEnabled(key: RoleKey) {
        return key === "admin" ? isAdmin : isFinance;
    }

    function toggleRole(key: RoleKey) {
        if (key === "admin") isAdmin = !isAdmin;
        else isFinance = !isFinance;
    }

    function getRoleClass(
        key: RoleKey,
        enabled: boolean,
        mode: "editable" | "readonly",
    ) {
        const common =
            mode === "editable"
                ? "flex-1 min-w-0 whitespace-nowrap gap-2 transition-all h-9 disabled:opacity-100 disabled:cursor-not-allowed"
                : "flex-1 min-w-0 whitespace-nowrap h-9 rounded-md inline-flex items-center justify-center gap-2 text-sm font-medium border";

        if (enabled) {
            return key === "admin"
                ? `${common} border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-50`
                : `${common} border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-50`;
        }
        return `${common} border-muted text-muted-foreground bg-background hover:bg-muted/30`;
    }
</script>

<div class="space-y-2">
    <div class="grid grid-cols-2 items-end gap-2">
        <div class="flex items-center gap-2 text-sm font-semibold h-5">
            <ShieldCheck class="h-4 w-4 text-primary" />
            權限與角色
        </div>
        <div class="min-w-0">
            {#if editable}
                <Label
                    for="approverId"
                    class="flex items-center gap-2 text-sm font-semibold h-5"
                >
                    <Users class="h-4 w-4 text-primary" />
                    核准人
                </Label>
            {:else}
                <div class="flex items-center gap-2 text-sm font-semibold h-5">
                    <Users class="h-4 w-4 text-primary" />
                    核准人
                </div>
            {/if}
        </div>
    </div>

    <div class="grid grid-cols-2 items-end gap-2">
        <div class="flex min-w-0 gap-2">
            {#each roleConfigs as role}
                {#if editable}
                    <Button
                        type="button"
                        variant="outline"
                        disabled={!isEditing || !allowRoleEdit}
                        class={getRoleClass(
                            role.key,
                            isRoleEnabled(role.key),
                            "editable",
                        )}
                        onclick={() => {
                            if (allowRoleEdit) toggleRole(role.key);
                        }}
                    >
                        <role.icon class="h-4 w-4" />
                        <span>{role.label}</span>
                    </Button>
                {:else}
                    <div
                        class={getRoleClass(
                            role.key,
                            isRoleEnabled(role.key),
                            "readonly",
                        )}
                    >
                        <role.icon class="h-4 w-4" />
                        {role.label}
                    </div>
                {/if}
            {/each}
        </div>

        <div class="min-w-0">
            {#if editable}
                <PayeeCombobox
                    name="approverId"
                    required={true}
                    bind:value={approverId}
                    disabled={!isEditing}
                    options={approverOptions
                        .filter((o) => o.id !== currentUserId)
                        .map((option) => ({
                            id: option.id,
                            name: option.full_name,
                        }))}
                    placeholder="設定核准人"
                    emptyText="無預設項目"
                    inputClass={cn(
                        "w-full h-10",
                        !isEditing &&
                            "pointer-events-none hover:bg-transparent dark:hover:bg-transparent transition-none",
                    )}
                />
            {:else}
                <div
                    class="min-w-0 h-10 rounded-md border bg-background pl-3 pr-9 flex items-center text-sm text-foreground relative"
                >
                    <span class="truncate">{approverName}</span>
                    <ChevronDown
                        class="absolute right-3 h-4 w-4 text-muted-foreground/70"
                    />
                </div>
            {/if}
        </div>
    </div>

    {#if helperText}
        <p class="text-[0.7rem] text-muted-foreground text-left">
            {helperText}
        </p>
    {/if}
</div>
