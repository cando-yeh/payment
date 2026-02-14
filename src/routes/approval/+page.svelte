<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Table from "$lib/components/ui/table";
    import * as Tabs from "$lib/components/ui/tabs";
    import * as Card from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import {
        FileText,
        Search,
        Filter,
        CheckCircle2,
        User,
        Landmark,
        History,
        Bell,
        ArrowRight,
        Clock,
        Sparkles,
    } from "lucide-svelte";
    import { fade, fly } from "svelte/transition";
    import { cn } from "$lib/utils";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
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

    function formatDate(date: string) {
        if (!date) return "-";
        return new Date(date).toLocaleDateString("zh-TW", {
            month: "2-digit",
            day: "2-digit",
        });
    }

    function formatAmount(amount: number) {
        return new Intl.NumberFormat("zh-TW", {
            style: "currency",
            currency: "TWD",
            maximumFractionDigits: 0,
        }).format(amount);
    }
</script>

<div class="space-y-10 pb-12" in:fade={{ duration: 400 }}>
    <!-- Header Area -->
    <div
        class="flex flex-col md:flex-row md:items-center justify-between gap-8"
    >
        <div class="space-y-1.5">
            <h1 class="text-3xl font-bold tracking-tight text-foreground">
                審核中心
            </h1>
            <p class="text-muted-foreground text-sm font-medium">
                管理待核准、待撥款及補件審核中的單據
            </p>
        </div>
    </div>

    <!-- Main Content Area with Tabs -->
    <div
        class="bg-white/70 backdrop-blur-xl border border-white/20 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 overflow-hidden"
    >
        <Tabs.Root value="manager" class="w-full">
            <div
                class="p-8 border-b border-slate-100/50 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
            >
                <Tabs.List
                    class="bg-secondary/40 p-1 rounded-xl h-auto flex-wrap"
                >
                    <Tabs.Trigger
                        value="manager"
                        class="rounded-lg px-4 py-2 font-bold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
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
                            class="rounded-lg px-4 py-2 font-bold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
                        >
                            <CheckCircle2 class="h-3.5 w-3.5" /> 財務審核
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
                            class="rounded-lg px-4 py-2 font-bold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
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
                            class="rounded-lg px-4 py-2 font-bold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
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
                                            String(result.data?.message || "") ||
                                                "批次撥款失敗",
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

                    <Table.Root>
                        <Table.Header class="bg-secondary/20">
                            <Table.Row class="hover:bg-transparent border-none">
                                {#if tabValue === "payment"}
                                    <Table.Head class="w-[60px] pl-8 py-4">
                                        <input
                                            type="checkbox"
                                            class="h-4 w-4 rounded border-border/40 text-primary focus:ring-primary/10"
                                            checked={currentList.length > 0 &&
                                                selectedClaims.length ===
                                                    currentList.length}
                                            onchange={(e) => {
                                                if (e.currentTarget.checked) {
                                                    selectedClaims =
                                                        currentList.map(
                                                            (c) => c.id,
                                                        );
                                                } else {
                                                    selectedClaims = [];
                                                }
                                            }}
                                        />
                                    </Table.Head>
                                {/if}
                                <Table.Head
                                    class={cn(
                                        "text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-4",
                                        tabValue !== "payment" && "pl-8",
                                    )}>單號</Table.Head
                                >
                                <Table.Head
                                    class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-4"
                                    >申請人</Table.Head
                                >
                                <Table.Head
                                    class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-4"
                                    >事由</Table.Head
                                >
                                <Table.Head
                                    class="text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-4"
                                    >金額</Table.Head
                                >
                                <Table.Head
                                    class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-4"
                                    >{tabValue === "payment"
                                        ? "收款人"
                                        : "提交日期"}</Table.Head
                                >
                                <Table.Head class="pr-8 py-4"></Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body class="divide-y divide-border/10">
                            {#if currentList.length === 0}
                                <Table.Row>
                                    <Table.Cell
                                        colspan={8}
                                        class="h-72 text-center"
                                    >
                                        <div
                                            class="flex flex-col items-center justify-center space-y-4"
                                        >
                                            <div
                                                class="h-16 w-16 rounded-3xl bg-secondary/30 flex items-center justify-center"
                                            >
                                                <CheckCircle2
                                                    class="h-8 w-8 text-muted-foreground/20"
                                                />
                                            </div>
                                            <p
                                                class="text-muted-foreground font-bold text-sm"
                                            >
                                                目前暫時沒有單據需要處理
                                            </p>
                                        </div>
                                    </Table.Cell>
                                </Table.Row>
                            {:else}
                                {#each currentList as claim}
                                    <Table.Row
                                        class="group border-none hover:bg-secondary/30 transition-all cursor-pointer h-20"
                                        onclick={(e) => {
                                            if (
                                                (e.target as HTMLElement)
                                                    .tagName === "INPUT"
                                            )
                                                return;
                                            goto(`/claims/${claim.id}`);
                                        }}
                                    >
                                        {#if tabValue === "payment"}
                                            <Table.Cell class="pl-8">
                                                <input
                                                    type="checkbox"
                                                    class="h-4 w-4 rounded border-border/40 text-primary focus:ring-primary/10"
                                                    checked={selectedClaims.includes(
                                                        claim.id,
                                                    )}
                                                    onchange={() => {
                                                        if (
                                                            selectedClaims.includes(
                                                                claim.id,
                                                            )
                                                        ) {
                                                            selectedClaims =
                                                                selectedClaims.filter(
                                                                    (id) =>
                                                                        id !==
                                                                        claim.id,
                                                                );
                                                        } else {
                                                            selectedClaims = [
                                                                ...selectedClaims,
                                                                claim.id,
                                                            ];
                                                        }
                                                    }}
                                                />
                                            </Table.Cell>
                                        {/if}
                                        <Table.Cell
                                            class={cn(
                                                "py-0",
                                                tabValue !== "payment" &&
                                                    "pl-8",
                                            )}
                                        >
                                            <span
                                                class="text-xs font-bold text-foreground opacity-40 select-all"
                                                >#{claim.id.split("-")[0]}</span
                                            >
                                        </Table.Cell>
                                        <Table.Cell>
                                            <div
                                                class="flex items-center gap-3"
                                            >
                                                <div
                                                    class="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground"
                                                >
                                                    {(claim.applicant
                                                        ?.full_name || "？")[0]}
                                                </div>
                                                <div>
                                                    <div
                                                        class="text-xs font-bold text-foreground"
                                                    >
                                                        {claim.applicant
                                                            ?.full_name}
                                                    </div>
                                                    <div
                                                        class="text-[9px] text-muted-foreground font-medium uppercase truncate max-w-[100px] opacity-60"
                                                    >
                                                        {claim.applicant?.email?.split(
                                                            "@",
                                                        )[0]}
                                                    </div>
                                                </div>
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell class="max-w-[200px]">
                                            <div
                                                class="font-bold text-foreground/80 text-sm truncate"
                                            >
                                                {claim.description}
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell class="text-right pr-4">
                                            <div
                                                class="text-base font-bold text-foreground tracking-tight"
                                            >
                                                {formatAmount(
                                                    claim.total_amount,
                                                ).replace("$", "")}
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell
                                            class="text-muted-foreground font-bold text-[11px] uppercase"
                                        >
                                            {#if tabValue === "payment"}
                                                {claim.claim_type === "employee"
                                                    ? "本人"
                                                    : claim.payees?.name || "-"}
                                            {:else}
                                                {formatDate(claim.submitted_at)}
                                            {/if}
                                        </Table.Cell>
                                        <Table.Cell class="pr-8 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                class="h-8 w-8 rounded-lg p-0 text-muted-foreground/30 group-hover:bg-background group-hover:text-primary transition-all"
                                            >
                                                <ArrowRight class="h-4 w-4" />
                                            </Button>
                                        </Table.Cell>
                                    </Table.Row>
                                {/each}
                            {/if}
                        </Table.Body>
                    </Table.Root>
                </Tabs.Content>
            {/each}
        </Tabs.Root>
    </div>
</div>
