<script lang="ts">
    import { enhance } from "$app/forms";
    import ClaimEditor from "$lib/components/claims/ClaimEditor.svelte";
    import { Button } from "$lib/components/ui/button";
    import * as Dialog from "$lib/components/ui/dialog";
    import { CircleAlert, CircleCheck, Undo2, CircleX } from "lucide-svelte";
    import type { PageData } from "./$types";
    import { UI_MESSAGES } from "$lib/constants/ui-messages";
    import { getClaimsTabForStatus } from "$lib/claims/constants";
    import { handleEnhancedActionFeedback } from "$lib/utils/action-feedback";

    import { page } from "$app/state";

    let { data }: { data: PageData } = $props();

    let claim = $derived(data.claim);
    let currentUser = $derived(data.user);
    let history = $derived(data.claim?.history || []);
    let duplicates = $derived(data.duplicateWarnings || []);

    // Determine back link and label based on source
    // If user came from Approval Center (passed via ?from=/approval), go back there
    const fromParam = $derived(page.url.searchParams.get("from"));

    // Status to Tab mapping
    function getApprovalTabForStatus(status: string) {
        if (["pending_manager"].includes(status)) return "manager";
        if (["pending_finance"].includes(status)) return "finance";
        if (["pending_payment"].includes(status)) return "payment";
        if (["pending_doc_review"].includes(status)) return "doc";
        return "manager"; // default fallback
    }

    const backHref = $derived.by(() => {
        if (fromParam?.includes("approval")) {
            const targetTab = getApprovalTabForStatus(claim.status);
            return `/approval?tab=${targetTab}`;
        }

        // Default behavior for "My Claims"
        // If we have a specific fromParam (e.g. from search), use it.
        // Otherwise, determine tab based on current status
        if (fromParam && fromParam !== "/claims") return fromParam;

        const targetTab = getClaimsTabForStatus(claim.status);
        return `/claims?tab=${targetTab}`;
    });

    const backLabel = $derived(
        fromParam?.includes("approval") ? "返回審核中心" : "返回清單",
    );

    const isEditableApplicant = $derived(data.viewMode === "edit");
    const isSupplementApplicant = $derived(data.viewMode === "supplement");
    const isFinanceReviewEditable = $derived(
        !isEditableApplicant &&
            !isSupplementApplicant &&
            claim.status === "pending_finance" &&
            currentUser.isFinance,
    );
    const canWithdraw = $derived(
        !isEditableApplicant &&
            claim.applicant_id === currentUser.id &&
            claim.status === "pending_manager",
    );
    const canCancel = $derived(
        !isEditableApplicant &&
            claim.applicant_id === currentUser.id &&
            claim.status === "returned",
    );
    const canApprove = $derived(
        (claim.status === "pending_manager" && currentUser.isApprover) ||
            (claim.status === "pending_finance" && currentUser.isFinance) ||
            (claim.status === "pending_doc_review" && currentUser.isFinance),
    );
    const canReject = $derived(
        (claim.status === "pending_manager" && currentUser.isApprover) ||
            (claim.status === "pending_finance" && currentUser.isFinance) ||
            (claim.status === "pending_doc_review" && currentUser.isFinance) ||
            (claim.status === "pending_payment" &&
                (currentUser.isFinance || currentUser.isAdmin)),
    );
    type NextActionKind =
        | "submit"
        | "supplement_submit"
        | "withdraw"
        | "cancel"
        | "review"
        | "payment_reject"
        | "back";

    type NextActionModel = {
        label: string;
        reason: string;
        kind: NextActionKind;
    };

    const nextAction = $derived.by<NextActionModel>(() => {
        if (isSupplementApplicant) {
            return {
                label: "進行補件送審",
                reason: "補件完成後，請由右上角送出補件審核。",
                kind: "supplement_submit",
            };
        }
        if (isEditableApplicant) {
            return {
                label: "進行送審",
                reason:
                    claim.status === "returned"
                        ? "此單據已退回，修正後請由右上角重新送審。"
                        : "草稿已可送審，請由右上角送出審核。",
                kind: "submit",
            };
        }
        if (canWithdraw) {
            return {
                label: "執行撤回",
                reason: "目前仍在主管審核前，可由右上角先撤回草稿。",
                kind: "withdraw",
            };
        }
        if (canCancel) {
            return {
                label: "執行撤銷",
                reason: "此申請若不再送審，可由右上角直接撤銷。",
                kind: "cancel",
            };
        }
        if (claim.status === "pending_payment" && canReject) {
            return {
                label: "進行付款審核",
                reason: "待付款檢核異常時，請由右上角駁回至財務。",
                kind: "payment_reject",
            };
        }
        if (canApprove || canReject) {
            return {
                label: "進行審核決策",
                reason: "你是此節點審核者，請由右上角完成核准或駁回。",
                kind: "review",
            };
        }
        return {
            label: "返回清單",
            reason: "此狀態目前無需操作，可先返回清單追蹤進度。",
            kind: "back",
        };
    });

    const editorClaim = $derived({
        ...claim,
        applicant_name: claim.applicant?.full_name || "",
        applicant_bank: claim.applicant?.bank || "",
        applicant_bank_account_tail: claim.applicant?.bank_account_tail || "",
        payee_name: claim.payee?.name || "",
        payee_bank: claim.payee?.bank || "",
        payee_bank_account_tail: claim.payee?.bank_account_tail || "",
        items: claim.items || [],
    });

    let isRejectModalOpen = $state(false);
    let comment = $state("");
    let isDuplicateModalOpen = $state(false);
    let isConfirmModalOpen = $state(false);
    let confirmTitle = $state("確認操作");
    let confirmMessage = $state("");
    let confirmButtonLabel = $state("確認");
    let confirmButtonVariant = $state<"default" | "destructive">("default");
    let pendingConfirmForm = $state<HTMLFormElement | null>(null);
    let allowConfirmedSubmitFor = $state<HTMLFormElement | null>(null);

    function requestConfirmSubmit(
        event: SubmitEvent,
        options: {
            title?: string;
            message: string;
            confirmLabel?: string;
            confirmVariant?: "default" | "destructive";
        },
    ) {
        const form = event.currentTarget as HTMLFormElement;
        if (allowConfirmedSubmitFor === form) {
            allowConfirmedSubmitFor = null;
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        pendingConfirmForm = form;
        confirmTitle = options.title || "確認操作";
        confirmMessage = options.message;
        confirmButtonLabel = options.confirmLabel || "確認";
        confirmButtonVariant = options.confirmVariant || "default";
        isConfirmModalOpen = true;
    }

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

    function enhanceAction({ successMessage }: { successMessage: string }) {
        return async ({
            result,
            update,
        }: {
            result: any;
            update: () => Promise<void>;
        }) => {
            await handleEnhancedActionFeedback({
                result,
                update,
                successMessage,
                failureMessage: UI_MESSAGES.common.actionFailed,
            });
        };
    }
</script>

{#if duplicates.length > 0}
    <div class="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-2">
                <CircleAlert class="mt-0.5 h-4 w-4 text-amber-700" />
                <p class="text-sm text-amber-800">
                    偵測到重複發票號碼（僅提醒，不阻擋提交）。
                </p>
            </div>
            <Button
                type="button"
                variant="outline"
                class="h-8 border-amber-300 px-3 text-xs text-amber-800 hover:bg-amber-100"
                onclick={() => (isDuplicateModalOpen = true)}
            >
                查看明細
            </Button>
        </div>
    </div>
{/if}

{#snippet headerActions()}
    {#if canWithdraw}
        <form
            action="?/withdraw"
            method="POST"
            data-testid="claim-withdraw-form"
            use:enhance={() =>
                enhanceAction({ successMessage: "已撤回為草稿" })}
            onsubmitcapture={(event) =>
                requestConfirmSubmit(event, {
                    title: "確認撤回草稿",
                    message: "確定要撤回此申請嗎？撤回後將變為草稿狀態。",
                    confirmLabel: "撤回草稿",
                })}
        >
            <Button
                variant="outline"
                type="submit"
                data-testid="claim-withdraw-button"
            >
                <Undo2 class="mr-1.5 h-4 w-4" /> 撤回草稿
            </Button>
        </form>
    {/if}

    {#if canCancel}
        <form
            action="?/cancel"
            method="POST"
            use:enhance={() => enhanceAction({ successMessage: "申請已撤銷" })}
            onsubmitcapture={(event) =>
                requestConfirmSubmit(event, {
                    title: "確認撤銷申請",
                    message: "確定要撤銷此申請嗎？撤銷後此單據將不可再送審。",
                    confirmLabel: "確認撤銷",
                    confirmVariant: "destructive",
                })}
        >
            <Button
                variant="outline"
                type="submit"
                data-testid="claim-cancel-button"
            >
                <CircleX class="mr-1.5 h-4 w-4" /> 撤銷申請
            </Button>
        </form>
    {/if}

    {#if canReject}
        <Button
            variant="outline"
            class="border-destructive/20 text-destructive hover:bg-destructive/5"
            data-testid="claim-reject-button"
            onclick={() => (isRejectModalOpen = true)}
        >
            <CircleX class="mr-1.5 h-4 w-4" /> 駁回
        </Button>
    {/if}
    {#if canApprove}
        <form
            action="?/approve"
            method="POST"
            use:enhance={() => enhanceAction({ successMessage: "核准成功" })}
        >
            <Button type="submit" data-testid="claim-approve-button">
                <CircleCheck class="mr-1.5 h-4 w-4" /> 核准
            </Button>
        </form>
    {/if}
{/snippet}

{#snippet nextActionBlock()}
    <div
        class="rounded-xl border border-amber-300 bg-amber-50 p-0.5"
        title={nextAction.reason}
    >
        <div
            class="flex items-start gap-2 rounded px-2 py-0.5 text-left text-[11px] leading-4 font-normal text-amber-900"
        >
            <CircleAlert class="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <span class="truncate">{nextAction.reason}</span>
        </div>
    </div>
{/snippet}

<ClaimEditor
    claim={editorClaim}
    payees={data.payees}
    mode={isEditableApplicant
        ? "edit"
        : isSupplementApplicant
          ? "supplement"
          : isFinanceReviewEditable
            ? "review"
          : "view"}
    {backHref}
    {backLabel}
    formAction="?/editUpdate"
    submitAction={isSupplementApplicant ? "?/submitSupplement" : "?/submit"}
    showSaveButton={isEditableApplicant}
    showSubmitButton={isEditableApplicant || isSupplementApplicant}
    submitButtonLabel={isSupplementApplicant ? "提交補件審核" : undefined}
    deleteAction={isEditableApplicant ? "?/delete" : undefined}
    directSubmitInSameForm={true}
    {history}
    {headerActions}
    nextAction={nextActionBlock}
    onDeleteSubmit={(e) =>
        requestConfirmSubmit(e as unknown as SubmitEvent, {
            title: "確認刪除草稿",
            message: "確定要刪除此草稿嗎？此動作無法復原。",
            confirmLabel: "確認刪除",
            confirmVariant: "destructive",
        })}
/>

<Dialog.Root bind:open={isRejectModalOpen}>
    <Dialog.Content class="max-w-md rounded-2xl">
        <Dialog.Header>
            <Dialog.Title>駁回此申請</Dialog.Title>
            <Dialog.Description
                >請提供具體的駁回原因，這將通知申請人。</Dialog.Description
            >
        </Dialog.Header>
        <form
            action="?/reject"
            method="POST"
            use:enhance={() => enhanceAction({ successMessage: "已駁回申請" })}
            class="space-y-4"
        >
            <textarea
                id="comment"
                name="comment"
                bind:value={comment}
                required
                placeholder="請輸入駁回原因"
                class="min-h-[120px] w-full rounded-xl border p-3 text-sm"
            ></textarea>
            <Dialog.Footer>
                <Button
                    variant="outline"
                    type="button"
                    onclick={() => (isRejectModalOpen = false)}>取消</Button
                >
                <Button type="submit" disabled={!comment.trim()}
                    >確認駁回</Button
                >
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={isDuplicateModalOpen}>
    <Dialog.Content class="max-w-md rounded-2xl p-7">
        <Dialog.Header>
            <Dialog.Title>檢測到重複發票</Dialog.Title>
            <Dialog.Description
                >系統發現此請款單中的發票號碼已在其他單據中使用。</Dialog.Description
            >
        </Dialog.Header>
        <div class="mt-4 space-y-4">
            {#each duplicates as dupe}
                <div class="rounded-xl border bg-secondary/20 p-4">
                    <div
                        class="mb-2 text-xs font-semibold text-muted-foreground"
                    >
                        發票號碼
                    </div>
                    <div class="mb-2 font-bold">{dupe.invoice_number}</div>
                    {#each dupe.duplicate_claims as dc}
                        <div class="mb-1 text-xs text-muted-foreground">
                            #{dc.claim_id.split("-")[0]} - {dc.applicant_name} /
                            {dc.status}
                        </div>
                    {/each}
                </div>
            {/each}
        </div>
        <Dialog.Footer class="mt-5">
            <Button
                class="w-full"
                onclick={() => (isDuplicateModalOpen = false)}>我知道了</Button
            >
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

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
