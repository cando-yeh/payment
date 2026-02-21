<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Plus, FileText } from "lucide-svelte";
    import { fade } from "svelte/transition";
    import * as Tabs from "$lib/components/ui/tabs";
    import ListPageScaffold from "$lib/components/common/ListPageScaffold.svelte";
    import ListToolbar from "$lib/components/common/ListToolbar.svelte";
    import ListTabs from "$lib/components/common/ListTabs.svelte";
    import ListTabTrigger from "$lib/components/common/ListTabTrigger.svelte";
    import SearchField from "$lib/components/common/SearchField.svelte";
    import ListPagination from "$lib/components/common/ListPagination.svelte";
    import ClaimTable from "$lib/components/claims/ClaimTable.svelte";
    import {
        getClaimStatusesForTab,
        isClaimsTabKey,
    } from "$lib/claims/constants";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    let searchTerm = $state("");
    const PAGE_SIZE = 10;
    let currentPage = $state(1);

    function handleSearch(e: Event) {
        const value = (e.target as HTMLInputElement).value;
        searchTerm = value;
        currentPage = 1;
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
        currentPage = 1;
        const url = new URL(window.location.href);
        url.searchParams.set("tab", value);
        window.history.replaceState(window.history.state, "", url);
    }

    let currentTab = $state("drafts");

    $effect(() => {
        currentTab = data.tab || "drafts";
        searchTerm = data.search || "";
    });

    let tabClaims = $derived.by(() => {
        if (!data.claims) return [];
        if (!isClaimsTabKey(currentTab)) return data.claims;
        const statuses = getClaimStatusesForTab(currentTab);
        return data.claims.filter((claim) => statuses.includes(claim.status));
    });

    let filteredClaims = $derived.by(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        if (!normalizedSearch) return tabClaims;

        return tabClaims.filter((claim) => {
            const id = String(claim.id || "").toLowerCase();
            const payeeName = String(claim.payee?.name || "").toLowerCase();
            const applicantName = String(
                claim.applicant?.full_name || "",
            ).toLowerCase();
            return (
                id.includes(normalizedSearch) ||
                payeeName.includes(normalizedSearch) ||
                applicantName.includes(normalizedSearch)
            );
        });
    });
    let pagedClaims = $derived.by(() =>
        filteredClaims.slice(
            (currentPage - 1) * PAGE_SIZE,
            currentPage * PAGE_SIZE,
        ),
    );

    let emptyMessage = $derived.by(() => {
        const keyword = searchTerm.trim();
        if ((data.claims?.length || 0) === 0) return "目前尚無請款單";
        if (keyword && filteredClaims.length === 0)
            return `找不到符合「${keyword}」的結果`;
        if (tabClaims.length === 0) return "目前篩選條件下沒有結果";
        return "目前尚無相關請款紀錄";
    });

    const returnedCount = $derived(
        (data.claims || []).filter((claim) => claim.status === "rejected").length,
    );
    const pendingDocCount = $derived(
        (data.claims || []).filter((claim) => claim.status === "paid_pending_doc")
            .length,
    );
</script>

<div in:fade={{ duration: 400 }}>
    <ListPageScaffold
        title="我的請款單"
        description="管理與追蹤您的所有請款申請流程"
        shellClassName="pb-2"
    >
        {#snippet headerActions()}
            <div>
                <Button
                    href="/claims/new"
                    class="h-10 px-6 rounded-xl shadow-lg shadow-primary/10 gap-2 font-bold text-sm"
                >
                    <Plus class="h-4 w-4" /> 建立請款單
                </Button>
            </div>
        {/snippet}
        <div class="w-full">
            <ListToolbar>
                {#snippet left()}
                    <Tabs.Root
                        value={currentTab}
                        onValueChange={handleTabChange}
                    >
                        <ListTabs>
                            <ListTabTrigger
                                value="drafts"
                                count={returnedCount}
                            >
                                草稿/退回
                            </ListTabTrigger>
                            <ListTabTrigger value="processing">
                                審核中
                            </ListTabTrigger>
                            <ListTabTrigger
                                value="action_required"
                                count={pendingDocCount}
                            >
                                待補件
                            </ListTabTrigger>
                            <ListTabTrigger value="history">
                                已結案
                            </ListTabTrigger>
                        </ListTabs>
                    </Tabs.Root>
                {/snippet}
                {#snippet right()}
                    <SearchField
                        placeholder="搜尋單號或收款人..."
                        bind:value={searchTerm}
                        oninput={handleSearch}
                    />
                {/snippet}
            </ListToolbar>

            <div class="m-0">
                <ClaimTable
                    claims={pagedClaims}
                    emptyIcon={FileText}
                    {emptyMessage}
                >
                    {#snippet emptyAction()}
                        {#if (data.claims?.length || 0) === 0}
                            <Button
                                href="/claims/new"
                                variant="outline"
                                class="rounded-xl border-border/50 font-bold h-9 px-6 text-xs"
                            >
                                立即建立單據
                            </Button>
                        {/if}
                    {/snippet}
                </ClaimTable>
                <ListPagination
                    totalItems={filteredClaims.length}
                    pageSize={PAGE_SIZE}
                    bind:currentPage
                />
            </div>
        </div>
    </ListPageScaffold>
</div>
