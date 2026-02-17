<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Plus, Search, FileText } from "lucide-svelte";
    import { fade } from "svelte/transition";
    import { cn } from "$lib/utils";
    import PageHeader from "$lib/components/common/PageHeader.svelte";
    import ClaimTable from "$lib/components/claims/ClaimTable.svelte";
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
    <PageHeader title="我的請款單" description="管理與追蹤您的所有請款申請流程">
        <div slot="actions">
            <Button
                href="/claims/new"
                class="h-10 px-6 rounded-xl shadow-lg shadow-primary/10 gap-2 font-bold text-sm"
            >
                <Plus class="h-4 w-4" /> 建立請款單
            </Button>
        </div>
    </PageHeader>

    <!-- Main Content Area -->
    <div
        class="bg-background border border-border/50 rounded-3xl shadow-sm overflow-hidden pb-2"
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
                            "rounded-lg px-5 py-2 font-bold text-xs whitespace-nowrap",
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
                            "rounded-lg px-5 py-2 font-bold text-xs whitespace-nowrap",
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
                            "rounded-lg px-5 py-2 font-bold text-xs whitespace-nowrap",
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
                            "rounded-lg px-5 py-2 font-bold text-xs whitespace-nowrap",
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
                <ClaimTable
                    claims={filteredClaims}
                    emptyIcon={FileText}
                    emptyMessage="目前尚無相關請款紀錄"
                >
                    <div slot="empty-action">
                        <Button
                            href="/claims/new"
                            variant="outline"
                            class="rounded-xl border-border/50 font-bold h-9 px-6 text-xs"
                        >
                            立即建立單據
                        </Button>
                    </div>
                </ClaimTable>
            </div>
        </div>
    </div>
</div>
