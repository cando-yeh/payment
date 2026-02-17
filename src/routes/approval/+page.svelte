<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Tabs from "$lib/components/ui/tabs";
    import { CircleCheck, User, Landmark, History } from "lucide-svelte";
    import { fade } from "svelte/transition";
    import PageHeader from "$lib/components/common/PageHeader.svelte";
    import ClaimTable from "$lib/components/claims/ClaimTable.svelte";
    import type { PageData } from "./$types";
    import { enhance } from "$app/forms";
    import { toast } from "svelte-sonner";

    let { data }: { data: PageData } = $props();

    let selectedClaims = $state<string[]>([]);
    let isBatchPaySubmitting = $state(false);

    let {
        pendingManager,
        pendingFinance,
        pendingPayment,
        pendingDocReview,
        userRole,
    } = $derived(data);
</script>

<div class="space-y-10 pb-12" in:fade={{ duration: 400 }}>
    <!-- Header Area -->
    <PageHeader
        title="審核中心"
        description="管理待核准、待撥款及補件審核中的單據"
    />

    <!-- Main Content Area with Tabs -->
    <div
        class="bg-background border border-border/50 rounded-3xl shadow-sm overflow-hidden"
    >
        <Tabs.Root value="manager" class="w-full">
            <div
                class="p-6 border-b border-border/30 flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
                <Tabs.List
                    class="bg-secondary/40 p-1 rounded-xl h-auto inline-flex gap-1 flex-wrap"
                >
                    <Tabs.Trigger
                        value="manager"
                        class="rounded-lg px-5 py-2 font-bold text-xs whitespace-nowrap gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                        <User class="h-3.5 w-3.5" /> 主管審核
                        {#if pendingManager.length > 0}
                            <span
                                class="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground"
                            >
                                {pendingManager.length}
                            </span>
                        {/if}
                    </Tabs.Trigger>

                    {#if userRole.isFinance || userRole.isAdmin}
                        <Tabs.Trigger
                            value="finance"
                            class="rounded-lg px-5 py-2 font-bold text-xs whitespace-nowrap gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                        >
                            <CircleCheck class="h-3.5 w-3.5" /> 財務審核
                            {#if pendingFinance.length > 0}
                                <span
                                    class="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground"
                                >
                                    {pendingFinance.length}
                                </span>
                            {/if}
                        </Tabs.Trigger>

                        <Tabs.Trigger
                            value="payment"
                            class="rounded-lg px-5 py-2 font-bold text-xs whitespace-nowrap gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                        >
                            <Landmark class="h-3.5 w-3.5" /> 待撥款
                            {#if pendingPayment.length > 0}
                                <span
                                    class="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground"
                                >
                                    {pendingPayment.length}
                                </span>
                            {/if}
                        </Tabs.Trigger>

                        <Tabs.Trigger
                            value="doc"
                            class="rounded-lg px-5 py-2 font-bold text-xs whitespace-nowrap gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                        >
                            <History class="h-3.5 w-3.5" /> 補件審核
                            {#if pendingDocReview.length > 0}
                                <span
                                    class="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground"
                                >
                                    {pendingDocReview.length}
                                </span>
                            {/if}
                        </Tabs.Trigger>
                    {/if}
                </Tabs.List>

                {#if selectedClaims.length > 0}
                    <div class="flex items-center gap-4" in:fade>
                        <span
                            class="text-[11px] font-bold text-muted-foreground"
                            >已選取 {selectedClaims.length} 筆</span
                        >
                        <form
                            action="?/batchPay"
                            method="POST"
                            use:enhance={() => {
                                isBatchPaySubmitting = true;
                                return async ({ result, update }) => {
                                    if (result.type === "success") {
                                        selectedClaims = [];
                                        toast.success("批次撥款已完成");
                                    } else if (result.type === "failure") {
                                        toast.error(
                                            String(
                                                result.data?.message || "",
                                            ) || "批次撥款失敗",
                                        );
                                    }
                                    await update();
                                    isBatchPaySubmitting = false;
                                };
                            }}
                        >
                            {#each selectedClaims as id}
                                <input
                                    type="hidden"
                                    name="claimIds"
                                    value={id}
                                />
                            {/each}
                            <Button
                                type="submit"
                                class="rounded-lg bg-primary hover:bg-primary/90 font-bold shadow-md shadow-primary/10 gap-1.5 h-9 px-4 text-xs"
                                disabled={isBatchPaySubmitting}
                            >
                                <Landmark class="h-3.5 w-3.5" />
                                {isBatchPaySubmitting
                                    ? "處理中..."
                                    : "執行批次撥款"}
                            </Button>
                        </form>
                    </div>
                {/if}
            </div>

            <!-- Tab Contents -->
            <div class="m-0">
                {#each ["manager", "finance", "payment", "doc"] as tabValue}
                    <Tabs.Content value={tabValue} class="m-0">
                        {@const currentList =
                            tabValue === "manager"
                                ? pendingManager
                                : tabValue === "finance"
                                  ? pendingFinance
                                  : tabValue === "payment"
                                    ? pendingPayment
                                    : pendingDocReview}

                        <ClaimTable
                            claims={currentList}
                            selectable={tabValue === "payment"}
                            bind:selectedClaims
                            emptyIcon={CircleCheck}
                            emptyMessage="目前暫時沒有單據需要處理"
                        />
                    </Tabs.Content>
                {/each}
            </div>
        </Tabs.Root>
    </div>
</div>
