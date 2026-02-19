import { applyAction, deserialize } from "$app/forms";
import { toast } from "svelte-sonner";
import { UI_MESSAGES } from "$lib/constants/ui-messages";

type ActionResultLike = {
    type?: string;
    data?: { message?: string };
    location?: string;
};

type EnhancedParams = {
    result: ActionResultLike;
    update: () => Promise<void>;
    successMessage?: string;
    failureMessage?: string;
};

type FetchParams = {
    response: Response;
    successMessage?: string;
    failureMessage?: string;
};

export async function handleEnhancedActionFeedback({
    result,
    update,
    successMessage,
    failureMessage = UI_MESSAGES.common.actionFailed,
}: EnhancedParams): Promise<boolean> {
    if (result?.type === "redirect") {
        if (successMessage) toast.success(successMessage);
        await applyAction(result as any);
        return true;
    }
    if (result?.type === "success") {
        if (successMessage) toast.success(successMessage);
        await update();
        return true;
    }
    if (result?.type === "failure") {
        toast.error(result?.data?.message || failureMessage);
        await update();
        return false;
    }
    await update();
    return false;
}

export async function handleFetchActionFeedback({
    response,
    successMessage,
    failureMessage = UI_MESSAGES.common.actionFailed,
}: FetchParams): Promise<{ ok: boolean; result: ActionResultLike }> {
    const result = deserialize(await response.text()) as ActionResultLike;
    if (result?.type === "failure") {
        toast.error(result?.data?.message || failureMessage);
        return { ok: false, result };
    }
    if (result?.type === "redirect" || result?.type === "success") {
        if (successMessage) toast.success(successMessage);
        await applyAction(result as any);
        return { ok: true, result };
    }
    await applyAction(result as any);
    return { ok: false, result };
}
