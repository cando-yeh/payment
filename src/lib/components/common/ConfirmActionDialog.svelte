<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Dialog from "$lib/components/ui/dialog";

    let {
        open = $bindable(false),
        title = "確認操作",
        description = "",
        confirmLabel = "確認",
        cancelLabel = "取消",
        confirmVariant = "default",
        disabled = false,
        cancelTestId,
        confirmTestId,
        onConfirm = () => {},
        onCancel = () => {},
    }: {
        open?: boolean;
        title?: string;
        description?: string;
        confirmLabel?: string;
        cancelLabel?: string;
        confirmVariant?: "default" | "destructive";
        disabled?: boolean;
        cancelTestId?: string;
        confirmTestId?: string;
        onConfirm?: () => void | Promise<void>;
        onCancel?: () => void;
    } = $props();
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="max-w-md">
        <Dialog.Header>
            <Dialog.Title>{title}</Dialog.Title>
            {#if description}
                <Dialog.Description>{description}</Dialog.Description>
            {/if}
        </Dialog.Header>
        <Dialog.Footer>
            <Button
                variant="outline"
                data-testid={cancelTestId}
                onclick={() => {
                    onCancel();
                    open = false;
                }}>{cancelLabel}</Button
            >
            <Button
                variant={confirmVariant}
                data-testid={confirmTestId}
                onclick={onConfirm}
                {disabled}
            >
                {confirmLabel}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
