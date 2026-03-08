<script lang="ts">
    import { goto } from "$app/navigation";
    import { Button } from "$lib/components/ui/button";
    import { Plus, FileText } from "lucide-svelte";
    import { onDestroy } from "svelte";
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
    let currentPage = $state(1);
    let currentTab = $state("drafts");
    let syncedPage = $state(1);
    let searchTimer: ReturnType<typeof setTimeout> | null = null;

    function buildClaimsUrl(next: {
        tab?: string;
        search?: string;
        page?: number;
    }) {
        const url = new URL(window.location.href);
        const tab = next.tab ?? currentTab;
        const search = next.search ?? searchTerm;
        const page = next.page ?? currentPage;

        url.searchParams.set("tab", tab);
        if (search.trim()) {
            url.searchParams.set("search", search.trim());
        } else {
            url.searchParams.delete("search");
        }
        if (page > 1) {
            url.searchParams.set("page", String(page));
        } else {
            url.searchParams.delete("page");
        }
        return `${url.pathname}${url.search}`;
    }

    async function navigateClaims(next: {
        tab?: string;
        search?: string;
        page?: number;
    }) {
        await goto(buildClaimsUrl(next), {
            replaceState: true,
            noScroll: true,
            keepFocus: true,
            invalidateAll: true,
        });
    }

    function handleSearch(e: Event) {
        const value = (e.target as HTMLInputElement).value;
        searchTerm = value;
        currentPage = 1;
        syncedPage = 1;

        if (searchTimer) {
            clearTimeout(searchTimer);
        }
        searchTimer = setTimeout(() => {
            void navigateClaims({ search: value, page: 1 });
        }, 250);
    }

    function handleTabChange(value: string) {
        currentTab = value;
        currentPage = 1;
        syncedPage = 1;
        void navigateClaims({ tab: value, page: 1 });
    }

    $effect(() => {
        currentTab = data.tab || "drafts";
        searchTerm = data.search || "";
        currentPage = data.page || 1;
        syncedPage = data.page || 1;
    });

    $effect(() => {
        if (currentPage === syncedPage) return;
        syncedPage = currentPage;
        void navigateClaims({ page: currentPage });
    });

    let emptyMessage = $derived.by(() => {
        const keyword = searchTerm.trim();
        if ((data.totalItems || 0) === 0 && !keyword) return "目前尚無請款單";
        if (keyword && (data.totalItems || 0) === 0)
            return `找不到符合「${keyword}」的結果`;
        if ((data.totalItems || 0) === 0) return "目前篩選條件下沒有結果";
        return "目前尚無相關請款紀錄";
    });

    const returnedCount = $derived(data.tabCounts?.drafts || 0);
    const processingCount = $derived(data.tabCounts?.processing || 0);
    const pendingDocCount = $derived(data.tabCounts?.actionRequired || 0);
    const historyCount = $derived(data.tabCounts?.history || 0);

    onDestroy(() => {
        if (searchTimer) clearTimeout(searchTimer);
    });
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
                                審核中 ({processingCount})
                            </ListTabTrigger>
                            <ListTabTrigger
                                value="action_required"
                                count={pendingDocCount}
                            >
                                待補件
                            </ListTabTrigger>
                            <ListTabTrigger value="history">
                                已結案 ({historyCount})
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
                    claims={data.claims || []}
                    emptyIcon={FileText}
                    {emptyMessage}
                >
                    {#snippet emptyAction()}
                        {#if (data.totalItems || 0) === 0}
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
                    totalItems={data.totalItems || 0}
                    pageSize={data.pageSize || 10}
                    bind:currentPage
                />
            </div>
        </div>
    </ListPageScaffold>
</div>
