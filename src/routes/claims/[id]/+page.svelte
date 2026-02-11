<script lang="ts">
    import { enhance } from "$app/forms";
    import { page } from "$app/state";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import * as Card from "$lib/components/ui/card";
    import * as Table from "$lib/components/ui/table";
    import * as Sheet from "$lib/components/ui/sheet";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import {
        ArrowLeft,
        FileText,
        Upload,
        Trash2,
        Send,
        Save,
        Paperclip,
        Eye,
        ExternalLink,
        Undo2,
        CheckCircle2,
        XCircle,
        History,
    } from "lucide-svelte";
    import * as Dialog from "$lib/components/ui/dialog";
    import AuditTimeline from "$lib/components/shared/AuditTimeline.svelte";

    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    let claim = $derived(data.claim);
    let items = $derived(data.claim?.items || []);
    let history = $derived(data.claim?.history || []);
    let currentUser = $derived(data.user);

    // Drawer State
    let isDrawerOpen = $state(false);
    let selectedItem = $state<any>(null);
    let isUploading = $state(false);

    // Approval Modal State
    let isRejectModalOpen = $state(false);
    let subStatus = $state<"approve" | "reject">("approve");
    let comment = $state("");

    function openAttachmentDrawer(item: any) {
        selectedItem = item;
        isDrawerOpen = true;
    }

    const statusMap: Record<string, { label: string; color: string }> = {
        draft: { label: "草稿", color: "bg-gray-200 text-gray-800" },
        pending_manager: {
            label: "待主管審核",
            color: "bg-yellow-100 text-yellow-800",
        },
        pending_finance: {
            label: "待財務審核",
            color: "bg-blue-100 text-blue-800",
        },
        pending_payment: {
            label: "待付款",
            color: "bg-purple-100 text-purple-800",
        },
        paid: { label: "已付款", color: "bg-green-100 text-green-800" },
        paid_pending_doc: {
            label: "已付款(待補件)",
            color: "bg-orange-100 text-orange-800",
        },
        pending_doc_review: {
            label: "補件審核中",
            color: "bg-orange-100 text-orange-800",
        },
        returned: { label: "已退回", color: "bg-red-100 text-red-800" },
        cancelled: { label: "已撤銷", color: "bg-gray-200 text-gray-500" },
    };

    function getStatusBadge(status: string) {
        return statusMap[status] || { label: status, color: "bg-gray-100" };
    }
</script>

<div class="container mx-auto py-8 max-w-5xl">
    <div class="mb-6">
        <Button
            variant="ghost"
            href="/claims"
            class="pl-0 hover:pl-0 hover:bg-transparent"
        >
            <ArrowLeft class="mr-2 h-4 w-4" /> 返回列表
        </Button>
    </div>

    <!-- Header -->
    <div
        class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
    >
        <div>
            <div class="flex items-center gap-3 mb-2">
                <h1 class="text-3xl font-bold tracking-tight">
                    請款單 #{claim.id}
                </h1>
                <Badge
                    class={getStatusBadge(claim.status).color}
                    variant="outline"
                >
                    {getStatusBadge(claim.status).label}
                </Badge>
            </div>
            <p class="text-muted-foreground">
                {new Date(claim.created_at).toLocaleDateString()} 建立
            </p>
        </div>

        <div class="flex items-center gap-2">
            <!-- Applicant Actions -->
            {#if (claim.status === "draft" || claim.status === "returned") && claim.applicant_id === currentUser.id}
                <form
                    action="?/delete"
                    method="POST"
                    use:enhance
                    onsubmit={() => confirm("確定要刪除此草稿嗎？")}
                >
                    <Button variant="destructive" type="submit" size="sm">
                        <Trash2 class="mr-2 h-4 w-4" /> 刪除
                    </Button>
                </form>
                <form
                    action="?/submit"
                    method="POST"
                    use:enhance
                    onsubmit={() => confirm("確定要提交審核嗎？")}
                >
                    <Button type="submit">
                        <Send class="mr-2 h-4 w-4" /> 提交審核
                    </Button>
                </form>
            {/if}

            {#if claim.status === "returned" && claim.applicant_id === currentUser.id}
                <form action="?/cancel" method="POST" use:enhance>
                    <Button variant="outline" type="submit">
                        <XCircle class="mr-2 h-4 w-4" /> 撤銷申請
                    </Button>
                </form>
            {/if}

            {#if claim.status === "pending_manager" && claim.applicant_id === currentUser.id}
                <form
                    action="?/withdraw"
                    method="POST"
                    use:enhance
                    onsubmit={() =>
                        confirm("確定要撤回此申請嗎？撤回後將變為草稿狀態。")}
                >
                    <Button variant="outline" type="submit">
                        <Undo2 class="mr-2 h-4 w-4" /> 撤回草稿
                    </Button>
                </form>
            {/if}

            <!-- Approver/Finance Actions -->
            {#if (claim.status === "pending_manager" && currentUser.isApprover) || (claim.status === "pending_finance" && currentUser.isFinance) || (claim.status === "pending_doc_review" && currentUser.isFinance)}
                <Button
                    variant="outline"
                    class="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onclick={() => {
                        subStatus = "reject";
                        isRejectModalOpen = true;
                    }}
                >
                    <XCircle class="mr-2 h-4 w-4" /> 駁回
                </Button>
                <form action="?/approve" method="POST" use:enhance>
                    <Button
                        type="submit"
                        class="bg-green-600 hover:bg-green-700"
                    >
                        <CheckCircle2 class="mr-2 h-4 w-4" /> 核准
                    </Button>
                </form>
            {/if}
        </div>
    </div>

    <div class="grid gap-6">
        <!-- Main Info -->
        <Card.Root>
            <Card.Header><Card.Title>基本資訊</Card.Title></Card.Header>
            <Card.Content class="grid md:grid-cols-2 gap-6">
                <div>
                    <Label class="text-muted-foreground">申請類別</Label>
                    <div class="text-lg font-medium mt-1">
                        {#if claim.claim_type === "employee"}員工報銷
                        {:else if claim.claim_type === "vendor"}廠商請款
                        {:else}個人勞務{/if}
                    </div>
                </div>
                <div>
                    <Label class="text-muted-foreground">受款對象</Label>
                    <div class="text-lg font-medium mt-1">
                        {claim.payee?.name ||
                            claim.approver?.full_name ||
                            "本人"}
                    </div>
                </div>
                <div class="md:col-span-2">
                    <Label class="text-muted-foreground">說明</Label>
                    <div class="text-lg mt-1">{claim.description}</div>
                </div>
            </Card.Content>
        </Card.Root>

        <!-- Line Items -->
        <Card.Root>
            <Card.Header class="flex flex-row justify-between items-center">
                <Card.Title>費用明細</Card.Title>
                <div class="text-xl font-bold">
                    總計: {new Intl.NumberFormat("zh-TW", {
                        style: "currency",
                        currency: "TWD",
                        maximumFractionDigits: 0,
                    }).format(claim.total_amount)}
                </div>
            </Card.Header>
            <Card.Content>
                <Table.Root>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head class="w-[50px]">#</Table.Head>
                            <Table.Head class="w-[120px]">日期</Table.Head>
                            <Table.Head class="w-[120px]">類別</Table.Head>
                            <Table.Head>項目說明</Table.Head>
                            <Table.Head class="w-[120px] text-right"
                                >金額</Table.Head
                            >
                            <Table.Head class="w-[100px] text-center"
                                >憑證</Table.Head
                            >
                            <Table.Head class="w-[80px]"></Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {#each items as item, i}
                            <Table.Row>
                                <Table.Cell>{i + 1}</Table.Cell>
                                <Table.Cell
                                    >{new Date(
                                        item.date_start,
                                    ).toLocaleDateString()}</Table.Cell
                                >
                                <Table.Cell>{item.category}</Table.Cell>
                                <Table.Cell>
                                    <div class="font-medium">
                                        {item.description}
                                    </div>
                                    {#if item.invoice_number}
                                        <div
                                            class="text-xs text-muted-foreground"
                                        >
                                            發票: {item.invoice_number}
                                        </div>
                                    {/if}
                                </Table.Cell>
                                <Table.Cell class="text-right font-mono">
                                    {new Intl.NumberFormat("en-US").format(
                                        item.amount,
                                    )}
                                </Table.Cell>
                                <Table.Cell class="text-center">
                                    {#if item.attachment_status === "uploaded"}
                                        <Badge
                                            variant="outline"
                                            class="bg-green-50 text-green-700 border-green-200"
                                        >
                                            <Paperclip class="h-3 w-3 mr-1" /> 已上傳
                                        </Badge>
                                    {:else if item.attachment_status === "exempt"}
                                        <Badge variant="secondary">免附</Badge>
                                    {:else}
                                        <Badge
                                            variant="outline"
                                            class="text-orange-600 border-orange-200"
                                            >缺件</Badge
                                        >
                                    {/if}
                                </Table.Cell>
                                <Table.Cell>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onclick={() =>
                                            openAttachmentDrawer(item)}
                                    >
                                        {#if item.attachment_status === "uploaded"}
                                            <Eye class="h-4 w-4" />
                                        {:else}
                                            <Upload class="h-4 w-4" />
                                        {/if}
                                    </Button>
                                </Table.Cell>
                            </Table.Row>
                        {/each}
                    </Table.Body>
                </Table.Root>
            </Card.Content>
        </Card.Root>

        <!-- Audit History -->
        <Card.Root>
            <Card.Header class="flex flex-row items-center gap-2">
                <History class="h-5 w-5 text-muted-foreground" />
                <Card.Title>審核歷程</Card.Title>
            </Card.Header>
            <Card.Content>
                <AuditTimeline {history} />
            </Card.Content>
        </Card.Root>
    </div>

    <!-- Reject Modal -->
    <Dialog.Root bind:open={isRejectModalOpen}>
        <Dialog.Content>
            <Dialog.Header>
                <Dialog.Title>駁回請款申請</Dialog.Title>
                <Dialog.Description>
                    請填寫駁回原因，這將幫助申請人了解如何修正並重新提交。
                </Dialog.Description>
            </Dialog.Header>
            <form
                action="?/reject"
                method="POST"
                use:enhance={() => {
                    return async ({ result, update }) => {
                        if (result.type === "success") {
                            isRejectModalOpen = false;
                            comment = "";
                        }
                        await update();
                    };
                }}
            >
                <div class="space-y-4 py-4">
                    <div class="space-y-2">
                        <Label for="comment"
                            >駁回原因 <span class="text-red-500">*</span></Label
                        >
                        <Textarea
                            id="comment"
                            name="comment"
                            placeholder="例如：發票金額與填寫不符、憑證影像模糊..."
                            bind:value={comment}
                            required
                        />
                    </div>
                </div>
                <Dialog.Footer>
                    <Button
                        variant="ghost"
                        onclick={() => (isRejectModalOpen = false)}>取消</Button
                    >
                    <Button
                        type="submit"
                        variant="destructive"
                        disabled={!comment.trim()}>確認駁回</Button
                    >
                </Dialog.Footer>
            </form>
        </Dialog.Content>
    </Dialog.Root>

    <!-- Attachment Drawer (Existing) -->
    <Sheet.Root bind:open={isDrawerOpen}>
        <Sheet.Content class="w-[400px] sm:w-[540px] overflow-y-auto">
            <Sheet.Header>
                <Sheet.Title>附件管理</Sheet.Title>
                <Sheet.Description>
                    項目 #{selectedItem?.item_index}: {selectedItem?.description}
                </Sheet.Description>
            </Sheet.Header>

            <div class="py-6">
                {#if selectedItem?.attachment_status === "uploaded" && selectedItem?.extra?.file_path}
                    <!-- Using signed URL would be better, but assuming public or generic path for now -->
                    <!-- Since we don't have signed URL in data yet, we might need to fetch it or rely on storage proxy -->
                    <!-- For now, showing placeholder concept -->
                    <div class="mb-4 p-4 border rounded bg-gray-50 text-center">
                        <FileText
                            class="h-12 w-12 mx-auto text-gray-400 mb-2"
                        />
                        <p class="text-sm text-gray-500 break-all">
                            {selectedItem.extra.original_name}
                        </p>
                        <p class="text-xs text-gray-400 mt-1">
                            ({selectedItem.extra.file_path})
                        </p>
                    </div>

                    <div class="flex gap-2">
                        <Button
                            variant="outline"
                            class="w-full"
                            href={`/api/claims/attachment/${selectedItem.id}`}
                            target="_blank"
                        >
                            <ExternalLink class="mr-2 h-4 w-4" /> 下載/檢視
                        </Button>

                        {#if claim.status === "draft" || claim.status === "pending_doc_review"}
                            <form
                                action="?/delete_attachment"
                                method="POST"
                                use:enhance
                                class="flex-1"
                            >
                                <input
                                    type="hidden"
                                    name="item_id"
                                    value={selectedItem.id}
                                />
                                <input
                                    type="hidden"
                                    name="file_path"
                                    value={selectedItem.extra.file_path}
                                />
                                <Button
                                    variant="destructive"
                                    type="submit"
                                    class="w-full"
                                >
                                    <Trash2 class="mr-2 h-4 w-4" /> 刪除
                                </Button>
                            </form>
                        {/if}
                    </div>
                {:else if claim.status === "draft" || claim.status === "pending_doc_review" || claim.status === "paid_pending_doc"}
                    <div
                        class="border-2 border-dashed rounded-lg p-8 text-center hover:bg-gray-50 transition-colors"
                    >
                        <form
                            action="?/upload"
                            method="POST"
                            enctype="multipart/form-data"
                            use:enhance={() => {
                                isUploading = true;
                                return async ({ update, result }) => {
                                    isUploading = false;
                                    await update();
                                    if (result.type === "success") {
                                        // ideally close drawer or refresh
                                    }
                                };
                            }}
                        >
                            <input
                                type="hidden"
                                name="item_id"
                                value={selectedItem?.id}
                            />
                            <div class="mb-4">
                                <Upload
                                    class="h-10 w-10 mx-auto text-gray-400"
                                />
                                <h3
                                    class="mt-2 text-sm font-semibold text-gray-900"
                                >
                                    上傳附件
                                </h3>
                                <p class="mt-1 text-sm text-gray-500">
                                    PNG, JPG, PDF (Max 10MB)
                                </p>
                            </div>
                            <Label for="file-upload" class="cursor-pointer">
                                <span class="sr-only">Choose file</span>
                                <Input
                                    id="file-upload"
                                    name="file"
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    required
                                    class="cursor-pointer"
                                />
                            </Label>

                            <Button
                                type="submit"
                                class="w-full mt-4"
                                disabled={isUploading}
                            >
                                {isUploading ? "上傳中..." : "開始上傳"}
                            </Button>
                        </form>
                    </div>
                {:else}
                    <div class="text-center py-8 text-muted-foreground">
                        尚無附件
                    </div>
                {/if}
            </div>
        </Sheet.Content>
    </Sheet.Root>
</div>
