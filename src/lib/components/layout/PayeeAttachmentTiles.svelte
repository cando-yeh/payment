<script lang="ts">
    import { Label } from "$lib/components/ui/label";
    import {
        FileText,
        Image as ImageIcon,
        Upload,
        X,
    } from "lucide-svelte";

    export type AttachmentKey = "id_card_front" | "id_card_back" | "bank_passbook";

    type AttachmentMeta = {
        key: AttachmentKey;
        label: string;
        inputId: string;
        inputName: string;
        removeName: string;
        previewAlt: string;
    };

    const ATTACHMENT_META: AttachmentMeta[] = [
        {
            key: "id_card_front",
            label: "身分證正面",
            inputId: "attachment_id_front",
            inputName: "attachment_id_front",
            removeName: "remove_attachment_id_front",
            previewAlt: "身分證正面預覽",
        },
        {
            key: "id_card_back",
            label: "身分證反面",
            inputId: "attachment_id_back",
            inputName: "attachment_id_back",
            removeName: "remove_attachment_id_back",
            previewAlt: "身分證反面預覽",
        },
        {
            key: "bank_passbook",
            label: "存摺封面",
            inputId: "attachment_bank_cover",
            inputName: "attachment_bank_cover",
            removeName: "remove_attachment_bank_cover",
            previewAlt: "存摺封面預覽",
        },
    ];

    let {
        isEditing = false,
        attachmentFiles,
        removedAttachments,
        canInteractWithAttachmentTile,
        hasAttachment,
        hasExistingAttachment,
        isAttachmentImage,
        isAttachmentPdf,
        getAttachmentPreviewUrl,
        onRemove,
        onFileSelected,
    }: {
        isEditing?: boolean;
        attachmentFiles: Record<AttachmentKey, File | null>;
        removedAttachments: Record<AttachmentKey, boolean>;
        canInteractWithAttachmentTile: (key: AttachmentKey) => boolean;
        hasAttachment: (key: AttachmentKey) => boolean;
        hasExistingAttachment: (key: AttachmentKey) => boolean;
        isAttachmentImage: (key: AttachmentKey) => boolean;
        isAttachmentPdf: (key: AttachmentKey) => boolean;
        getAttachmentPreviewUrl: (key: AttachmentKey) => string | null;
        onRemove: (key: AttachmentKey) => void;
        onFileSelected: (key: AttachmentKey, event: Event) => void;
    } = $props();

    let inputRefs = $state<Record<AttachmentKey, HTMLInputElement | null>>({
        id_card_front: null,
        id_card_back: null,
        bank_passbook: null,
    });

    function handleTileClick(key: AttachmentKey) {
        if (hasAttachment(key)) {
            const url = getAttachmentPreviewUrl(key);
            if (url) window.open(url, "_blank", "noopener,noreferrer");
            return;
        }
        if (!isEditing) return;
        inputRefs[key]?.click();
    }

    function handleRemove(key: AttachmentKey) {
        if (!isEditing) return;
        onRemove(key);
        const input = inputRefs[key];
        if (input) input.value = "";
    }

    function setInputRef(node: HTMLInputElement, key: AttachmentKey) {
        inputRefs = { ...inputRefs, [key]: node };
        return {
            destroy() {
                inputRefs = { ...inputRefs, [key]: null };
            },
        };
    }
</script>

<div class="space-y-4">
    <h4 class="font-medium text-sm">附件</h4>
    <div class="grid grid-cols-3 gap-3">
        {#each ATTACHMENT_META as item (item.key)}
            <div class="space-y-2">
                <Label class="text-xs">{item.label}</Label>
                <div class="relative">
                    <button
                        type="button"
                        class={`w-full aspect-square rounded-md border bg-background transition flex flex-col items-center justify-center gap-1 ${canInteractWithAttachmentTile(item.key) ? "hover:bg-muted/40 cursor-pointer" : "cursor-default"}`}
                        onclick={() => handleTileClick(item.key)}
                    >
                        {#if hasAttachment(item.key) && isAttachmentImage(item.key) && getAttachmentPreviewUrl(item.key)}
                            <img
                                src={getAttachmentPreviewUrl(item.key) || ""}
                                alt={item.previewAlt}
                                class="h-full w-full object-cover rounded-md"
                            />
                        {:else if hasAttachment(item.key) && isAttachmentPdf(item.key)}
                            <FileText class="h-7 w-7 text-primary" />
                            <span class="text-[11px] font-medium text-muted-foreground">
                                PDF
                            </span>
                        {:else if hasAttachment(item.key)}
                            <ImageIcon class="h-6 w-6 text-primary" />
                            <span class="text-[11px] text-muted-foreground">
                                查看檔案
                            </span>
                        {:else}
                            <Upload class="h-6 w-6 text-muted-foreground" />
                            <span class="text-[11px] text-muted-foreground">
                                上傳檔案
                            </span>
                        {/if}
                    </button>
                    {#if isEditing && (hasExistingAttachment(item.key) || attachmentFiles[item.key])}
                        <button
                            type="button"
                            class="absolute -top-1 -left-1 h-5 w-5 rounded-full border bg-background text-destructive flex items-center justify-center"
                            onclick={() => handleRemove(item.key)}
                        >
                            <X class="h-3 w-3" />
                        </button>
                    {/if}
                </div>
                <input
                    id={item.inputId}
                    name={item.inputName}
                    type="file"
                    accept="image/*,.pdf"
                    use:setInputRef={item.key}
                    disabled={!isEditing}
                    class="hidden"
                    onchange={(event) => onFileSelected(item.key, event)}
                />
                <input
                    type="hidden"
                    name={item.removeName}
                    value={removedAttachments[item.key] ? "true" : "false"}
                />
            </div>
        {/each}
    </div>
</div>
