<script lang="ts">
    import ClaimEditor from "$lib/components/claims/ClaimEditor.svelte";
    import { Button } from "$lib/components/ui/button";
    import * as Dialog from "$lib/components/ui/dialog";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    const draftClaim = $derived({
        id: "",
        applicant_id: data.applicantId || "",
        claim_type: "employee",
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

<ClaimEditor
    claim={draftClaim}
    payees={data.payees}
    categoryOptions={data.categoryOptions}
    mode="edit"
    isCreate={true}
    backHref="/claims"
    backLabel="返回清單"
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
