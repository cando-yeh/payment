import { CLAIM_ITEM_CATEGORIES } from "$lib/claims/constants";

export type ExpenseCategoryOption = {
    id: string;
    name: string;
    description?: string;
    is_active?: boolean;
};

export function getFallbackExpenseCategories(): ExpenseCategoryOption[] {
    return CLAIM_ITEM_CATEGORIES.map((item) => ({
        id: item.value,
        name: item.label,
        is_active: true,
    }));
}

export async function getExpenseCategories(
    supabase: App.Locals["supabase"],
    options: { activeOnly?: boolean } = {},
): Promise<ExpenseCategoryOption[]> {
    let query = supabase
        .from("expense_categories")
        .select("id, name, description, is_active")
        .order("name", { ascending: true });

    if (options.activeOnly) {
        query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) {
        console.warn("Failed to load expense categories:", error);
        return getFallbackExpenseCategories();
    }
    if (!data || data.length === 0) {
        return getFallbackExpenseCategories();
    }

    return (data as ExpenseCategoryOption[]).map((item) => ({
        id: String(item.id),
        name: String(item.name),
        description: String(item.description || ""),
        is_active: Boolean(item.is_active),
    }));
}

export async function getActiveExpenseCategoryNames(
    supabase: App.Locals["supabase"],
): Promise<Set<string>> {
    const categories = await getExpenseCategories(supabase, { activeOnly: true });
    return new Set(categories.map((item) => item.name.trim()).filter(Boolean));
}
