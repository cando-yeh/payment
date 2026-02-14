<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Select from "$lib/components/ui/select";
  import { ShieldCheck, Users, CreditCard } from "lucide-svelte";
  import { cn } from "$lib/utils";

  type Mode = "management" | "personal";
  type ApproverOption = { id: string; full_name: string };

  let {
    mode,
    isEditing = false,
    isAdmin = $bindable(false),
    isFinance = $bindable(false),
    approverId = $bindable(""),
    approverOptions = [],
    currentUserId = "",
    approverDisplayName = "(無)",
  }: {
    mode: Mode;
    isEditing?: boolean;
    isAdmin?: boolean;
    isFinance?: boolean;
    approverId?: string;
    approverOptions?: ApproverOption[];
    currentUserId?: string;
    approverDisplayName?: string;
  } = $props();

  const isManagement = $derived(mode === "management");
</script>

<div class="space-y-2">
  <div class="grid grid-cols-2 items-end gap-2">
    <div class="flex items-center gap-2 text-sm font-semibold h-5">
      <ShieldCheck class="h-4 w-4 text-primary" />
      權限與角色
    </div>
    <div class="min-w-0 pl-1">
      {#if isManagement}
        <Label for="approverId" class="flex items-center gap-2 text-sm font-semibold h-5">
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
    <div class="flex gap-2">
      <Button
        type="button"
        variant={isAdmin ? "default" : "outline"}
        disabled={isManagement ? !isEditing : false}
        class={cn(
          "flex-1 gap-2 h-9",
          isManagement && "transition-all",
          !isManagement && "pointer-events-none",
          isAdmin && "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50",
          isManagement && !isAdmin && "text-muted-foreground opacity-60 grayscale",
        )}
        onclick={() => {
          if (isManagement) isAdmin = !isAdmin;
        }}
      >
        <ShieldCheck class="h-4 w-4" />
        管理員
      </Button>

      <Button
        type="button"
        variant={isFinance ? "default" : "outline"}
        disabled={isManagement ? !isEditing : false}
        class={cn(
          "flex-1 gap-2 h-9",
          isManagement && "transition-all",
          !isManagement && "pointer-events-none",
          isFinance && "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50",
          isManagement && !isFinance && "text-muted-foreground opacity-60 grayscale",
        )}
        onclick={() => {
          if (isManagement) isFinance = !isFinance;
        }}
      >
        <CreditCard class="h-4 w-4" />
        財務
      </Button>
    </div>

    <div class="min-w-0 pl-1">
      {#if isManagement}
        <Select.Root type="single" name="approverId" disabled={!isEditing} bind:value={approverId}>
          <Select.Trigger id="approverId" class="w-full h-10">
            <div class="flex items-center gap-2 truncate">
              <span class="truncate">
                {approverOptions.find((o) => o.id === approverId)?.full_name || "設定核准人"}
              </span>
            </div>
          </Select.Trigger>
          <Select.Content>
            {#each approverOptions.filter((o) => o.id !== currentUserId) as option}
              <Select.Item value={option.id} label={option.full_name}>
                {option.full_name}
              </Select.Item>
            {:else}
              <div class="p-2 text-xs text-muted-foreground">無預設項目</div>
            {/each}
          </Select.Content>
        </Select.Root>
      {:else}
        <Input type="text" value={approverDisplayName} readonly disabled class="pointer-events-none" />
      {/if}
    </div>
  </div>

  {#if isManagement}
    <p class="text-[0.7rem] text-muted-foreground text-right">該使用者提交請款時，將送往此核准人。</p>
  {:else}
    <p class="text-[0.7rem] text-muted-foreground text-center">角色與核准人由管理員設定。</p>
  {/if}
</div>
