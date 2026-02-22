<script lang="ts">
    import ClaimEditor from "$lib/components/claims/ClaimEditor.svelte";
    import { Button } from "$lib/components/ui/button";
    import * as Dialog from "$lib/components/ui/dialog";
    import * as Card from "$lib/components/ui/card";
    import { CLAIM_TYPE_OPTIONS } from "$lib/claims/constants";
    import { ArrowLeft, FileText, Building2, UserRound } from "lucide-svelte";
    import { fade } from "svelte/transition";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    const claimTypeDescriptions: Record<string, string> = {
        employee: "用於員工本人報銷日常費用，收款對象固定為申請人本人。",
        vendor: "用於公司對廠商付款，需指定已建檔的廠商收款對象。",
        personal_service: "用於個人勞務給付，需指定已建檔的個人收款對象。",
    };

    const claimTypeIcons: Record<string, any> = {
        employee: FileText,
        vendor: Building2,
        personal_service: UserRound,
    };

    const draftClaim = $derived({
        id: "",
        applicant_id: data.applicantId || "",
        claim_type: data.claimType || "employee",
        status: "draft",
        created_at: null,
        applicant_name: data.applicantName || "",
        applicant_bank: data.applicantBank || "",
        applicant_bank_account_tail: data.applicantBankAccountTail || "",
        items: [],
    });

    let isConfirmModalOpen = $state(false);
    let confirmTitle = $state("確認操作");
    let confirmMessage = $state("");
    let confirmButtonLabel = $state("確認");
    let confirmButtonVariant = $state<"default" | "destructive">("default");
    let pendingConfirmForm = $state<HTMLFormElement | null>(null);
    let allowConfirmedSubmitFor = $state<HTMLFormElement | null>(null);

    function executeConfirmedSubmit() {
        const form = pendingConfirmForm;
        pendingConfirmForm = null;
        isConfirmModalOpen = false;
        if (!form || !form.isConnected) return;
        allowConfirmedSubmitFor = form;
        form.requestSubmit();
    }

    function cancelConfirmedSubmit() {
        pendingConfirmForm = null;
        isConfirmModalOpen = false;
    }
</script>

{#if data.claimType}
    <!-- 已選擇類型：顯示表單 -->
    <ClaimEditor
        claim={draftClaim}
        payees={data.payees}
        categoryOptions={data.categoryOptions}
        mode="edit"
        isCreate={true}
        backHref="/claims/new"
        backLabel="返回選擇類型"
        formAction="?/create"
        formEnctype="multipart/form-data"
        showSaveButton={true}
        showSubmitButton={true}
        directSubmitInSameForm={true}
        requireApproverOnDirectSubmit={true}
        hasApprover={data.hasApprover}
    ></ClaimEditor>

    <Dialog.Root bind:open={isConfirmModalOpen}>
        <Dialog.Content
            class="max-w-md rounded-2xl"
            data-testid="claim-confirm-dialog"
        >
            <Dialog.Header>
                <Dialog.Title>{confirmTitle}</Dialog.Title>
                <Dialog.Description>{confirmMessage}</Dialog.Description>
            </Dialog.Header>
            <Dialog.Footer>
                <Button
                    variant="outline"
                    data-testid="claim-confirm-cancel"
                    onclick={cancelConfirmedSubmit}>取消</Button
                >
                <Button
                    variant={confirmButtonVariant}
                    data-testid="claim-confirm-submit"
                    onclick={executeConfirmedSubmit}
                >
                    {confirmButtonLabel}
                </Button>
            </Dialog.Footer>
        </Dialog.Content>
    </Dialog.Root>
{:else}
    <!-- 未選擇類型：顯示選擇頁面 -->
    <div class="space-y-4 pb-16" in:fade={{ duration: 300 }}>
        <Button
            variant="ghost"
            href="/claims"
            class="h-9 px-3 text-base font-semibold text-muted-foreground hover:text-foreground"
        >
            <ArrowLeft class="mr-1.5 h-4 w-4" />
            返回清單
        </Button>

        <div class="mx-auto max-w-2xl space-y-6 pt-4">
            <div class="space-y-2 text-center">
                <h1 class="text-2xl font-bold tracking-tight">建立請款單</h1>
                <p class="text-sm text-muted-foreground">
                    請先選擇請款類型，系統將依據類型載入對應的表單。
                </p>
            </div>

            <div class="grid gap-4 sm:grid-cols-3">
                {#each CLAIM_TYPE_OPTIONS as option}
                    {@const Icon = claimTypeIcons[option.value] || FileText}
                    <a
                        href="/claims/new?type={option.value}"
                        data-sveltekit-preload-data="hover"
                        class="group"
                    >
                        <Card.Root
                            class="relative overflow-hidden rounded-xl border border-border/60 bg-background transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 group-hover:-translate-y-0.5"
                        >
                            <Card.Content
                                class="flex flex-col items-center gap-3 p-6 pt-8"
                            >
                                <div
                                    class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
                                >
                                    <Icon class="h-6 w-6" />
                                </div>
                                <div class="space-y-1.5 text-center">
                                    <h2 class="text-base font-semibold">
                                        {option.label}
                                    </h2>
                                    <p
                                        class="text-xs leading-relaxed text-muted-foreground"
                                    >
                                        {claimTypeDescriptions[option.value] ||
                                            ""}
                                    </p>
                                </div>
                            </Card.Content>
                        </Card.Root>
                    </a>
                {/each}
            </div>
        </div>
    </div>
{/if}
