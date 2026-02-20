<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Tabs from "$lib/components/ui/tabs";
    import * as Dialog from "$lib/components/ui/dialog";
    import { CircleCheck, User, Landmark, History } from "lucide-svelte";
    import { fade } from "svelte/transition";
    import ListPageScaffold from "$lib/components/common/ListPageScaffold.svelte";
    import ListToolbar from "$lib/components/common/ListToolbar.svelte";
    import ListTabs from "$lib/components/common/ListTabs.svelte";
    import ListTabTrigger from "$lib/components/common/ListTabTrigger.svelte";
    import ClaimTable from "$lib/components/claims/ClaimTable.svelte";
    import type { PageData } from "./$types";
    import { enhance } from "$app/forms";
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import { UI_MESSAGES } from "$lib/constants/ui-messages";
    import { handleEnhancedActionFeedback } from "$lib/utils/action-feedback";

    let { data }: { data: PageData } = $props();

    let selectedClaims = $state<string[]>([]);
    let isBatchPaySubmitting = $state(false);
    let isBatchPayDialogOpen = $state(false);

    // Get initial tab from URL or default to "manager"
    let activeTab = $state(page.url.searchParams.get("tab") || "manager");

    function handleTabChange(value: string) {
        activeTab = value;
        const newUrl = new URL(page.url);
        newUrl.searchParams.set("tab", value);
        // Use replaceState to update URL without navigation/reload
        goto(newUrl.toString(), {
            replaceState: true,
            noScroll: true,
            keepFocus: true,
        });
    }

    let {
        pendingManager,
        pendingFinance,
        pendingPayment,
        pendingDocReview,
        userRole,
    } = $derived(data);
</script>

<div in:fade={{ duration: 400 }}>
    <ListPageScaffold
        title="審核中心"
        description="管理待核准、待撥款及補件審核中的單據"
        shellClassName="pb-2"
    >
        <Tabs.Root
            value={activeTab}
            onValueChange={handleTabChange}
            class="w-full"
        >
            <ListToolbar>
                {#snippet left()}
                    <ListTabs>
                        <ListTabTrigger
                            value="manager"
                            count={pendingManager.length}
                        >
                            <User class="h-3.5 w-3.5" /> 主管審核
                        </ListTabTrigger>

                        {#if userRole.isFinance || userRole.isAdmin}
                            <ListTabTrigger
                                value="finance"
                                count={pendingFinance.length}
                            >
                                <CircleCheck class="h-3.5 w-3.5" /> 財務審核
                            </ListTabTrigger>

                            <ListTabTrigger
                                value="payment"
                                count={pendingPayment.length}
                            >
                                <Landmark class="h-3.5 w-3.5" /> 待撥款
                            </ListTabTrigger>

                            <ListTabTrigger
                                value="doc"
                                count={pendingDocReview.length}
                            >
                                <History class="h-3.5 w-3.5" /> 補件審核
                            </ListTabTrigger>
                        {/if}
                    </ListTabs>
                {/snippet}
                {#snippet right()}
                    {#if selectedClaims.length > 0}
                        <div class="flex items-center gap-4" in:fade>
                            <span
                                class="text-[11px] font-bold text-muted-foreground"
                                >已選取 {selectedClaims.length} 筆</span
                            >
                            <Dialog.Root bind:open={isBatchPayDialogOpen}>
                                <Dialog.Trigger>
                                    <Button
                                        variant="default"
                                        class="rounded-lg bg-primary hover:bg-primary/90 font-bold shadow-md shadow-primary/10 gap-1.5 h-9 px-4 text-xs"
                                    >
                                        <Landmark class="h-3.5 w-3.5" />
                                        執行批次撥款
                                    </Button>
                                </Dialog.Trigger>
                                <Dialog.Content class="sm:max-w-[425px]">
                                    <Dialog.Header>
                                        <Dialog.Title>確認批次撥款</Dialog.Title>
                                        <Dialog.Description>
                                            您即將對 {selectedClaims.length} 筆單據進行撥款。請確認付款日期。
                                        </Dialog.Description>
                                    </Dialog.Header>
                                    <form
                                        action="?/batchPay"
                                        method="POST"
                                        use:enhance={() => {
                                            isBatchPaySubmitting = true;
                                            return async ({
                                                result,
                                                update,
                                            }) => {
                                                const ok =
                                                    await handleEnhancedActionFeedback(
                                                        {
                                                            result: result as any,
                                                            update,
                                                            successMessage:
                                                                UI_MESSAGES.approval
                                                                    .batchPayDone,
                                                            failureMessage:
                                                                UI_MESSAGES.approval
                                                                    .batchPayFailed,
                                                        },
                                                    );
                                                if (ok) {
                                                    selectedClaims = [];
                                                    isBatchPayDialogOpen =
                                                        false;
                                                }
                                                isBatchPaySubmitting = false;
                                            };
                                        }}
                                        class="space-y-6"
                                    >
                                        {#each selectedClaims as id}
                                            <input
                                                type="hidden"
                                                name="claimIds"
                                                value={id}
                                            />
                                        {/each}
                                        <div class="space-y-2">
                                            <label
                                                class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                for="paymentDate"
                                            >
                                                付款日期
                                            </label>
                                            <input
                                                type="date"
                                                id="paymentDate"
                                                name="paymentDate"
                                                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                value={new Date()
                                                    .toISOString()
                                                    .split("T")[0]}
                                                required
                                            />
                                        </div>
                                        <Dialog.Footer>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onclick={() =>
                                                    (isBatchPayDialogOpen =
                                                        false)}
                                            >
                                                取消
                                            </Button>
                                            <Button
                                                type="submit"
                                                disabled={isBatchPaySubmitting}
                                            >
                                                {isBatchPaySubmitting
                                                    ? "處理中..."
                                                    : "確認撥款"}
                                            </Button>
                                        </Dialog.Footer>
                                    </form>
                                </Dialog.Content>
                            </Dialog.Root>
                        </div>
                    {/if}
                {/snippet}
            </ListToolbar>

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
    </ListPageScaffold>
</div>
