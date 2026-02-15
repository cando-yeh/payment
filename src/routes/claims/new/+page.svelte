<script lang="ts">
    import { enhance } from "$app/forms";
    import { toast } from "svelte-sonner";
    import ClaimEditor from "$lib/components/claims/ClaimEditor.svelte";
    import { Button } from "$lib/components/ui/button";
    import * as Dialog from "$lib/components/ui/dialog";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    const draftClaim = {
        id: "",
        claim_type: "employee",
        status: "draft",
        created_at: null,
        applicant_name: "本人",
        items: [
            {
                date: new Date().toISOString().split("T")[0],
                category: "general",
                description: "",
                amount: "",
                invoice_number: "",
                attachment_status: "pending_supplement",
                exempt_reason: "",
                extra: {},
            },
        ],
    };

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
</script>

<ClaimEditor
    claim={draftClaim}
    payees={data.payees}
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
>
    <svelte:fragment slot="header-actions">
        <!-- 新增模式無額外操作按鈕 -->
    </svelte:fragment>
</ClaimEditor>

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
