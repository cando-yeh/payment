import { applyAction, deserialize } from "$app/forms";
import { toast } from "svelte-sonner";
import { UI_MESSAGES } from "$lib/constants/ui-messages";

type ActionResultLike = {
    type?: string;
    data?: { message?: string };
    location?: string;
};

type MessageResolver =
    | string
    | ((result: ActionResultLike) => string | undefined | null);

type EnhancedParams = {
    result: ActionResultLike;
    update: () => Promise<void>;
    successMessage?: string;
    failureMessage?: string;
};

type FetchParams = {
    response: Response;
    successMessage?: MessageResolver;
    failureMessage?: MessageResolver;
};

function resolveMessage(
    input: MessageResolver | undefined,
    result: ActionResultLike,
): string | undefined {
    if (!input) return undefined;
    if (typeof input === "function") {
        const resolved = input(result);
        return resolved ? String(resolved) : undefined;
    }
    return input;
}

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
    const text = await response.text();
    let result: ActionResultLike;
    try {
        result = deserialize(text) as ActionResultLike;
    } catch {
        try {
            result = JSON.parse(text) as ActionResultLike;
        } catch {
            result = { type: "error", data: { message: undefined } };
        }
    }

    const resolvedFailure =
        resolveMessage(failureMessage, result) || UI_MESSAGES.common.actionFailed;
    const resolvedSuccess = resolveMessage(successMessage, result);

    if (result?.type === "failure") {
        toast.error(result?.data?.message || resolvedFailure);
        return { ok: false, result };
    }
    if (result?.type === "redirect" || result?.type === "success") {
        if (resolvedSuccess) toast.success(resolvedSuccess);
        await applyAction(result as any);
        return { ok: true, result };
    }
    await applyAction(result as any);
    return { ok: false, result };
}
