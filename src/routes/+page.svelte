<script lang="ts">
    import { createBrowserSupabaseClient } from "$lib/supabase";
    import * as Card from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import {
        Plus,
        FileText,
        Clock,
        CheckCircle2,
        XCircle,
        Landmark,
        TrendingUp,
        ArrowRight,
        Bell,
        History as HistoryIcon,
        Sparkles,
    } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { fade, fly, slide } from "svelte/transition";
    import { cn } from "$lib/utils";

    /**
     * Svelte 5 Props
     */
    let { data } = $props();

    const supabase = createBrowserSupabaseClient();

    const signInWithGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    };

    function formatAmount(amount: number) {
        return new Intl.NumberFormat("zh-TW", {
            style: "currency",
            currency: "TWD",
            maximumFractionDigits: 0,
        }).format(amount);
    }

    function formatDate(date: string) {
        return new Date(date).toLocaleDateString("zh-TW", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    const {
        session,
        profile,
        mySummary,
        managerPendingCount,
        financeStats,
        recentActivity,
    } = $derived(data);
</script>

{#if !session}
    <div
        class="flex flex-col items-center justify-center min-h-[70vh] space-y-12"
        in:fade={{ duration: 800 }}
    >
        <div class="text-center space-y-8">
            <div
                class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase mb-4"
            >
                <Sparkles class="h-3 w-3" /> Enterprise Solutions
            </div>
            <h1
                class="text-7xl font-bold tracking-tight text-foreground leading-[1.1]"
            >
                簡約、精確、<br />
                <span class="text-primary">極致流暢</span>
            </h1>
            <p
                class="text-muted-foreground text-xl max-w-xl mx-auto leading-relaxed font-medium"
            >
                為企業量身打造的報銷管理系統。<br />讓每一筆支出都能優雅被追蹤。
            </p>
        </div>

        <button
            onclick={signInWithGoogle}
            class="group relative flex items-center justify-center gap-4 bg-foreground text-background px-10 py-4.5 rounded-2xl hover:opacity-90 transition-all font-semibold shadow-xl active:scale-[0.98]"
        >
            <img
                src="https://www.google.com/favicon.ico"
                alt="Google"
                class="w-5 h-5 grayscale brightness-200"
            />
            <span class="text-base">使用企業帳號登入</span>
        </button>
    </div>
{:else}
    <div class="space-y-12 pb-12" in:fade={{ duration: 600 }}>
        <!-- 歡迎區塊 -->
        <div
            class="flex flex-col md:flex-row md:items-end justify-between gap-8"
        >
            <div class="space-y-2">
                <h1 class="text-4xl font-bold tracking-tight text-foreground">
                    你好，{profile?.full_name?.split(" ")[0] || "使用者"}
                </h1>
                <p class="text-muted-foreground text-lg font-medium">
                    您的報銷作業一切順利。
                </p>
            </div>
            <Button
                href="/claims/new"
                class="h-12 px-8 rounded-xl shadow-lg shadow-primary/20 gap-2 font-bold text-base transition-all hover:shadow-primary/30"
            >
                <Plus class="h-5 w-5" /> 新增請款單
            </Button>
        </div>

        <!-- 關鍵指標卡片 -->
        <div class="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <Card.Root
                class="relative overflow-hidden border border-border/50 shadow-sm bg-background rounded-2xl transition-all duration-300 hover:shadow-md"
            >
                <Card.Header class="pb-3 pt-6">
                    <Card.Title
                        class="text-[13px] font-bold tracking-tight text-muted-foreground uppercase"
                        >我的草稿</Card.Title
                    >
                </Card.Header>
                <Card.Content class="pb-6">
                    <div
                        class="text-4xl font-bold text-foreground tracking-tight"
                    >
                        {mySummary.draft}
                    </div>
                    <div
                        class="flex items-center gap-1.5 text-xs text-muted-foreground mt-3 font-medium"
                    >
                        <Clock class="h-3.5 w-3.5" /> 待提交處置
                    </div>
                </Card.Content>
            </Card.Root>

            <Card.Root
                class="relative overflow-hidden border border-border/50 shadow-sm bg-background rounded-2xl transition-all duration-300 hover:shadow-md"
            >
                <Card.Header class="pb-3 pt-6">
                    <Card.Title
                        class="text-[13px] font-bold tracking-tight text-muted-foreground uppercase"
                        >正在審核</Card.Title
                    >
                </Card.Header>
                <Card.Content class="pb-6">
                    <div
                        class="text-4xl font-bold text-foreground tracking-tight"
                    >
                        {mySummary.pending}
                    </div>
                    <div
                        class="flex items-center gap-1.5 text-xs text-muted-foreground mt-3 font-medium"
                    >
                        <TrendingUp class="h-3.5 w-3.5 text-primary" /> 程序進行中
                    </div>
                </Card.Content>
                {#if mySummary.returned > 0}
                    <div class="absolute top-6 right-6">
                        <Badge
                            variant="destructive"
                            class="rounded-full px-2.5 py-0.5 text-[10px] font-bold border-none"
                        >
                            {mySummary.returned} 退回
                        </Badge>
                    </div>
                {/if}
            </Card.Root>

            {#if managerPendingCount > 0}
                <Card.Root
                    class="relative overflow-hidden border-none shadow-sm bg-primary/5 rounded-2xl transition-all duration-300 hover:shadow-md"
                >
                    <Card.Header class="pb-3 pt-6">
                        <Card.Title
                            class="text-[13px] font-bold tracking-tight text-primary uppercase"
                            >主管待核准</Card.Title
                        >
                    </Card.Header>
                    <Card.Content class="pb-6">
                        <div
                            class="text-4xl font-bold text-primary tracking-tight"
                        >
                            {managerPendingCount}
                        </div>
                        <Button
                            href="/approval"
                            variant="link"
                            class="p-0 h-auto text-[13px] text-primary font-bold mt-4 gap-1 group no-underline"
                        >
                            前往處理 <ArrowRight
                                class="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform"
                            />
                        </Button>
                    </Card.Content>
                </Card.Root>
            {:else if profile?.is_finance || profile?.is_admin}
                <Card.Root
                    class="relative overflow-hidden border border-border/50 shadow-sm bg-background rounded-2xl transition-all duration-300 hover:shadow-md"
                >
                    <Card.Header class="pb-3 pt-6">
                        <Card.Title
                            class="text-[13px] font-bold tracking-tight text-primary uppercase"
                            >財務待撥款</Card.Title
                        >
                    </Card.Header>
                    <Card.Content class="pb-6">
                        <div
                            class="text-3xl font-bold text-foreground tracking-tight"
                        >
                            {formatAmount(financeStats.totalPendingAmount)}
                        </div>
                        <p
                            class="text-xs font-medium text-muted-foreground mt-3"
                        >
                            共 {financeStats.pendingPayment} 筆單據
                        </p>
                    </Card.Content>
                </Card.Root>
            {:else}
                <Card.Root
                    class="relative overflow-hidden border border-border/50 shadow-sm bg-background rounded-2xl"
                >
                    <Card.Header class="pb-3 pt-6">
                        <Card.Title
                            class="text-[13px] font-bold tracking-tight text-muted-foreground uppercase"
                            >統計數據</Card.Title
                        >
                    </Card.Header>
                    <Card.Content class="pb-6">
                        <div
                            class="text-4xl font-bold text-muted-foreground/30"
                        >
                            --
                        </div>
                        <p
                            class="text-xs text-muted-foreground mt-3 font-medium"
                        >
                            需核發更多數據以供分析
                        </p>
                    </Card.Content>
                </Card.Root>
            {/if}

            <Card.Root
                class="relative overflow-hidden border border-border/50 shadow-sm bg-background rounded-2xl transition-all duration-300 hover:shadow-md"
            >
                <Card.Header class="pb-3 pt-6">
                    <Card.Title
                        class="text-[13px] font-bold tracking-tight text-muted-foreground uppercase"
                        >本月撥付</Card.Title
                    >
                </Card.Header>
                <Card.Content class="pb-6">
                    <div class="text-3xl font-bold text-primary tracking-tight">
                        {formatAmount(mySummary.totalAmount)}
                    </div>
                    <div
                        class="flex items-center gap-1.5 text-xs text-muted-foreground mt-3 font-medium"
                    >
                        <CheckCircle2 class="h-3.5 w-3.5 text-primary" /> 已入帳
                    </div>
                </Card.Content>
            </Card.Root>
        </div>

        <div class="grid gap-10 lg:grid-cols-3">
            <!-- 最近活動 -->
            <Card.Root
                class="lg:col-span-2 border border-border/50 shadow-sm bg-background rounded-3xl overflow-hidden"
            >
                <Card.Header
                    class="flex flex-row items-center justify-between px-8 py-6 border-b border-border/30"
                >
                    <div class="flex items-center gap-3">
                        <Card.Title class="text-lg font-bold text-foreground"
                            >最近動態</Card.Title
                        >
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        href="/claims"
                        class="text-primary font-bold text-xs hover:bg-primary/5 rounded-lg h-8"
                    >
                        瀏覽全部
                    </Button>
                </Card.Header>
                <Card.Content class="p-0">
                    {#if recentActivity.length === 0}
                        <div
                            class="py-24 text-center flex flex-col items-center gap-4"
                        >
                            <div
                                class="h-20 w-20 rounded-full bg-secondary flex items-center justify-center"
                            >
                                <FileText
                                    class="h-10 w-10 text-muted-foreground/20"
                                />
                            </div>
                            <p
                                class="text-muted-foreground font-medium text-sm"
                            >
                                目前尚無動態紀錄
                            </p>
                        </div>
                    {:else}
                        <div class="divide-y divide-border/20">
                            {#each recentActivity as item}
                                <button
                                    type="button"
                                    class="group w-full text-left px-8 py-5 hover:bg-secondary/30 transition-all duration-200 cursor-pointer flex items-center gap-6"
                                    onclick={() => goto(`/claims/${item.claim_id}`)}
                                >
                                    <div
                                        class={cn(
                                            "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                                            item.action === "approve"
                                                ? "bg-primary/10 text-primary"
                                                : item.action === "reject"
                                                  ? "bg-destructive/10 text-destructive"
                                                  : item.action === "pay"
                                                    ? "bg-primary/20 text-primary"
                                                    : "bg-secondary text-foreground/50",
                                        )}
                                    >
                                        {#if item.action === "approve"}
                                            <CheckCircle2 class="h-5 w-5" />
                                        {:else if item.action === "reject"}
                                            <XCircle class="h-5 w-5" />
                                        {:else if item.action === "pay"}
                                            <Landmark class="h-5 w-5" />
                                        {:else}
                                            <FileText class="h-5 w-5" />
                                        {/if}
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div
                                            class="flex items-center gap-2 mb-0.5"
                                        >
                                            <span
                                                class="text-[14px] font-bold text-foreground"
                                            >
                                                {item.action === "submit"
                                                    ? "提交單據"
                                                    : item.action === "approve"
                                                      ? "核准通過"
                                                      : item.action === "reject"
                                                        ? "單據駁回"
                                                        : item.action === "pay"
                                                          ? "完成撥款"
                                                          : "狀態變更"}
                                            </span>
                                            <span
                                                class="text-[11px] font-medium text-muted-foreground opacity-50"
                                            >
                                                #{item.claim?.id?.split("-")[0]}
                                            </span>
                                        </div>
                                        <p
                                            class="text-[13px] text-muted-foreground font-medium truncate"
                                        >
                                            {item.claim?.description ||
                                                "無備註描述"}
                                        </p>
                                    </div>
                                    <div class="text-right shrink-0">
                                        <div
                                            class="text-[11px] font-medium text-muted-foreground/60 mb-1"
                                        >
                                            {formatDate(item.created_at)}
                                        </div>
                                        {#if item.actor}
                                            <div
                                                class="text-[11px] font-bold text-foreground/70"
                                            >
                                                {item.actor.full_name}
                                            </div>
                                        {/if}
                                    </div>
                                </button>
                            {/each}
                        </div>
                    {/if}
                </Card.Content>
            </Card.Root>

            <div class="space-y-10">
                <!-- 快捷工具 (Apple Style Grouped) -->
                <div class="space-y-4">
                    <h3
                        class="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2"
                    >
                        快捷操作
                    </h3>
                    <Card.Root
                        class="border border-border/50 shadow-sm bg-background rounded-3xl overflow-hidden p-1"
                    >
                        <div class="grid grid-cols-1 divide-y divide-border/20">
                            <a
                                href="/payees"
                                class="flex items-center gap-4 p-4 hover:bg-secondary/40 transition-colors group"
                            >
                                <div
                                    class="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary"
                                >
                                    <Landmark class="h-4.5 w-4.5" />
                                </div>
                                <span class="text-sm font-bold text-foreground"
                                    >受款人設定</span
                                >
                                <ArrowRight
                                    class="ml-auto h-4 w-4 text-muted-foreground/30 group-hover:translate-x-1 transition-transform"
                                />
                            </a>
                            <a
                                href="/approval"
                                class="flex items-center gap-4 p-4 hover:bg-secondary/40 transition-colors group"
                            >
                                <div
                                    class="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary"
                                >
                                    <Bell class="h-4.5 w-4.5" />
                                </div>
                                <span class="text-sm font-bold text-foreground"
                                    >審核中心</span
                                >
                                <ArrowRight
                                    class="ml-auto h-4 w-4 text-muted-foreground/30 group-hover:translate-x-1 transition-transform"
                                />
                            </a>
                        </div>
                    </Card.Root>
                </div>

                <!-- 系統公告 -->
                <Card.Root
                    class="bg-foreground text-background rounded-3xl shadow-lg relative overflow-hidden border-none p-8"
                >
                    <div class="space-y-6">
                        <div
                            class="inline-flex h-8 w-8 rounded-lg bg-background/10 items-center justify-center text-background"
                        >
                            <Bell class="h-4 w-4" />
                        </div>
                        <div class="space-y-2">
                            <h3 class="text-lg font-bold tracking-tight">
                                系統公告
                            </h3>
                            <p
                                class="text-sm text-background/70 leading-relaxed font-medium"
                            >
                                每月 25
                                號為當月最後撥款日。請確認單據上傳憑證清晰，以利審核。
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            class="w-full bg-transparent border-background/20 hover:bg-background/10 text-background rounded-xl h-10 text-xs font-bold"
                        >
                            瞭解詳情
                        </Button>
                    </div>
                </Card.Root>
            </div>
        </div>
    </div>
{/if}

<style>
    /* 這裡不再需要定義全域字體，已在 app.css 透過 apple-system 設定 */
</style>
