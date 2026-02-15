<script lang="ts">
    import { goto } from "$app/navigation";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import * as Table from "$lib/components/ui/table";
    import { Badge } from "$lib/components/ui/badge";
    import {
        Plus,
        Search,
        FileText,
        ReceiptText,
        ArrowRight,
    } from "lucide-svelte";
    import { fade } from "svelte/transition";
    import { cn } from "$lib/utils";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    let searchTerm = $state("");

    function handleSearch(e: Event) {
        const value = (e.target as HTMLInputElement).value;
        searchTerm = value;
        const url = new URL(window.location.href);
        if (value.trim()) {
            url.searchParams.set("search", value);
        } else {
            url.searchParams.delete("search");
        }
        window.history.replaceState(window.history.state, "", url);
    }

    function handleTabChange(value: string) {
        currentTab = value;
        const url = new URL(window.location.href);
        url.searchParams.set("tab", value);
        window.history.replaceState(window.history.state, "", url);
    }

    const statusMap: Record<string, { label: string; color: string }> = {
        draft: {
            label: "草稿",
            color: "bg-slate-100 text-slate-600 border-slate-200",
        },
        pending_manager: {
            label: "待主管審核",
            color: "bg-amber-100 text-amber-700 border-amber-200",
        },
        pending_finance: {
            label: "待財務審核",
            color: "bg-blue-100 text-blue-700 border-blue-200",
        },
        pending_payment: {
            label: "待付款",
            color: "bg-indigo-100 text-indigo-700 border-indigo-200",
        },
        paid: {
            label: "已付款",
            color: "bg-emerald-100 text-emerald-700 border-emerald-200",
        },
        paid_pending_doc: {
            label: "已付款待補件",
            color: "bg-orange-100 text-orange-700 border-orange-200",
        },
        pending_doc_review: {
            label: "補件審核中",
            color: "bg-orange-100 text-orange-700 border-orange-200",
        },
        returned: {
            label: "已退回",
            color: "bg-rose-100 text-rose-700 border-rose-200",
        },
        cancelled: {
            label: "已撤銷",
            color: "bg-slate-50 text-slate-400 border-slate-100",
        },
    };

    function getStatusBadge(status: string) {
        return (
            statusMap[status] || {
                label: status,
                color: "bg-slate-100 text-slate-600",
            }
        );
    }

    function formatDate(dateString: string) {
        return new Date(dateString).toLocaleDateString("zh-TW");
    }

    function formatAmount(amount: number) {
        return new Intl.NumberFormat("zh-TW", {
            style: "currency",
            currency: "TWD",
            maximumFractionDigits: 0,
        }).format(amount);
    }

    let currentTab = $state("drafts");

    $effect(() => {
        currentTab = data.tab || "drafts";
        searchTerm = data.search || "";
    });

    let filteredClaims = $derived.by(() => {
        if (!data.claims) return [];
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const tabFiltered = (() => {
            if (currentTab === "drafts") {
                return data.claims.filter((claim) =>
                    ["draft", "returned"].includes(claim.status),
                );
            }
            if (currentTab === "processing") {
                return data.claims.filter((claim) =>
                    [
                        "pending_manager",
                        "pending_finance",
                        "pending_payment",
                    ].includes(claim.status),
                );
            }
            if (currentTab === "action_required") {
                return data.claims.filter((claim) =>
                    ["paid_pending_doc", "pending_doc_review"].includes(
                        claim.status,
                    ),
                );
            }
            if (currentTab === "history") {
                return data.claims.filter((claim) =>
                    ["paid", "cancelled"].includes(claim.status),
                );
            }
            return data.claims;
        })();

        if (!normalizedSearch) return tabFiltered;

        return tabFiltered.filter((claim) => {
            const id = String(claim.id || "").toLowerCase();
            const payeeName = String(claim.payee?.name || "").toLowerCase();
            return (
                id.includes(normalizedSearch) ||
                payeeName.includes(normalizedSearch)
            );
        });
    });
</script>

<div class="space-y-10 pb-12" in:fade={{ duration: 400 }}>
    <!-- Header Area -->
    <div
        class="flex flex-col md:flex-row md:items-center justify-between gap-8"
    >
        <div class="space-y-1.5">
            <h1 class="text-3xl font-bold tracking-tight text-foreground">
                我的請款單
            </h1>
            <p class="text-muted-foreground text-sm font-medium">
                管理與追蹤您的所有請款申請流程
            </p>
        </div>
        <Button
            href="/claims/new"
            class="h-10 px-6 rounded-xl shadow-lg shadow-primary/10 gap-2 font-bold text-sm"
        >
            <Plus class="h-4 w-4" /> 建立請款單
        </Button>
    </div>

    <!-- Main Content Area -->
    <div
        class="bg-background border border-border/50 rounded-3xl shadow-sm overflow-hidden"
    >
        <div class="w-full">
            <div
                class="p-6 border-b border-border/30 flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
                <div
                    class="bg-secondary/40 p-1 rounded-xl h-auto inline-flex gap-1"
                >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={currentTab === "drafts"}
                        class={cn(
                            "rounded-lg px-5 py-2 font-bold text-xs",
                            currentTab === "drafts"
                                ? "bg-background shadow-sm"
                                : "",
                        )}
                        onclick={() => handleTabChange("drafts")}
                        >草稿/退回</button
                    >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={currentTab === "processing"}
                        class={cn(
                            "rounded-lg px-5 py-2 font-bold text-xs",
                            currentTab === "processing"
                                ? "bg-background shadow-sm"
                                : "",
                        )}
                        onclick={() => handleTabChange("processing")}
                        >審核中</button
                    >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={currentTab === "action_required"}
                        class={cn(
                            "rounded-lg px-5 py-2 font-bold text-xs",
                            currentTab === "action_required"
                                ? "bg-background shadow-sm"
                                : "",
                        )}
                        onclick={() => handleTabChange("action_required")}
                        >待補件</button
                    >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={currentTab === "history"}
                        class={cn(
                            "rounded-lg px-5 py-2 font-bold text-xs",
                            currentTab === "history"
                                ? "bg-background shadow-sm"
                                : "",
                        )}
                        onclick={() => handleTabChange("history")}
                        >歷史紀錄</button
                    >
                </div>

                <div class="relative group">
                    <Search
                        class="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 group-focus-within:text-primary transition-colors"
                    />
                    <Input
                        type="search"
                        placeholder="搜尋單號或收款人..."
                        class="pl-10 pr-4 h-10 w-full md:w-[280px] rounded-xl bg-secondary/30 border-none focus:ring-primary/10 transition-all text-xs font-medium"
                        value={searchTerm}
                        oninput={handleSearch}
                    />
                </div>
            </div>

            <div class="m-0">
                <Table.Root>
                    <Table.Header class="bg-secondary/20">
                        <Table.Row class="hover:bg-transparent border-none">
                            <Table.Head
                                class="pl-8 text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-4"
                                >單號</Table.Head
                            >
                            <Table.Head
                                class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-4"
                                >類別</Table.Head
                            >
                            <Table.Head
                                class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-4"
                                >收款對象</Table.Head
                            >
                            <Table.Head
                                class="text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-4"
                                >總金額</Table.Head
                            >
                            <Table.Head
                                class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-4"
                                >當前狀態</Table.Head
                            >
                            <Table.Head
                                class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-4"
                                >日期</Table.Head
                            >
                            <Table.Head class="pr-8 py-4"></Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body class="divide-y divide-border/10">
                        {#if filteredClaims.length > 0}
                            {#each filteredClaims as claim}
                                {@const claimHref = `/claims/${claim.id}`}
                                <Table.Row
                                    class="group border-none hover:bg-secondary/30 transition-all cursor-pointer h-20"
                                    onclick={() => goto(claimHref)}
                                >
                                    <Table.Cell class="pl-8 py-0">
                                        <span
                                            class="text-xs font-bold text-foreground opacity-40 select-all"
                                        >
                                            #{claim.id.split("-")[0]}
                                        </span>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Badge
                                            variant="secondary"
                                            class="rounded-md font-bold text-[10px] px-2 py-0"
                                        >
                                            {#if claim.claim_type === "employee"}員工報銷
                                            {:else if claim.claim_type === "vendor"}廠商請款
                                            {:else}個人勞務{/if}
                                        </Badge>
                                    </Table.Cell>
                                    <Table.Cell class="max-w-[250px]">
                                        {#if claim.items && claim.items[0]?.count > 0}
                                            <div
                                                class="text-[10px] text-muted-foreground font-medium mt-1 flex items-center gap-1 opacity-60"
                                            >
                                                <ReceiptText
                                                    class="h-2.5 w-2.5"
                                                />
                                                包含 {claim.items[0].count} 個細目
                                            </div>
                                        {/if}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <div class="flex items-center gap-2">
                                            <div
                                                class="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground"
                                            >
                                                {(claim.payee?.name ||
                                                    claim.approver?.full_name ||
                                                    "本")[0]}
                                            </div>
                                            <span
                                                class="text-xs font-bold text-foreground/70"
                                            >
                                                {claim.payee?.name ||
                                                    claim.approver?.full_name ||
                                                    "本人"}
                                            </span>
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
                                    <Table.Cell>
                                        {@const status = getStatusBadge(
                                            claim.status,
                                        )}
                                        <Badge
                                            class={cn(
                                                "rounded-full px-3 py-0 scale-90 origin-left text-[10px] font-bold border-none",
                                                status.color,
                                            )}
                                        >
                                            {status.label}
                                        </Badge>
                                    </Table.Cell>
                                    <Table.Cell
                                        class="text-muted-foreground font-bold text-xs"
                                    >
                                        {formatDate(claim.created_at)}
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
                        {:else}
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
                                            <FileText
                                                class="h-8 w-8 text-muted-foreground/20"
                                            />
                                        </div>
                                        <div class="space-y-1">
                                            <p
                                                class="text-muted-foreground font-bold text-sm"
                                            >
                                                目前尚無相關請款紀錄
                                            </p>
                                        </div>
                                        <Button
                                            href="/claims/new"
                                            variant="outline"
                                            class="rounded-xl border-border/50 font-bold h-9 px-6 text-xs"
                                        >
                                            立即建立單據
                                        </Button>
                                    </div>
                                </Table.Cell>
                            </Table.Row>
                        {/if}
                    </Table.Body>
                </Table.Root>
            </div>
        </div>
    </div>
</div>
