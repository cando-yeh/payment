-- Expense categories + profile timestamp hardening
-- Scope:
-- 1) Add expense_categories master table (finance-managed)
-- 2) Normalize claim_items legacy category values to category names
-- 3) Ensure profiles.created_at / updated_at are present and non-null

CREATE TABLE IF NOT EXISTS public.expense_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_active_name
    ON public.expense_categories (is_active, name);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'expense_categories'
          AND policyname = 'expense_categories_select_authenticated'
    ) THEN
        CREATE POLICY expense_categories_select_authenticated
            ON public.expense_categories
            FOR SELECT
            TO authenticated
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'expense_categories'
          AND policyname = 'expense_categories_insert_finance'
    ) THEN
        CREATE POLICY expense_categories_insert_finance
            ON public.expense_categories
            FOR INSERT
            TO authenticated
            WITH CHECK (public.is_finance());
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'expense_categories'
          AND policyname = 'expense_categories_update_finance'
    ) THEN
        CREATE POLICY expense_categories_update_finance
            ON public.expense_categories
            FOR UPDATE
            TO authenticated
            USING (public.is_finance())
            WITH CHECK (public.is_finance());
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'expense_categories'
          AND policyname = 'expense_categories_delete_finance'
    ) THEN
        CREATE POLICY expense_categories_delete_finance
            ON public.expense_categories
            FOR DELETE
            TO authenticated
            USING (public.is_finance());
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_row_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_expense_categories_updated_at'
    ) THEN
        CREATE TRIGGER trg_expense_categories_updated_at
            BEFORE UPDATE ON public.expense_categories
            FOR EACH ROW
            EXECUTE FUNCTION public.set_row_updated_at();
    END IF;
END $$;

INSERT INTO public.expense_categories (name, is_active)
SELECT seed.name, true
FROM (VALUES ('一般雜支'), ('差旅費'), ('伙食費')) AS seed(name)
WHERE NOT EXISTS (
    SELECT 1 FROM public.expense_categories c WHERE c.name = seed.name
);

-- Legacy value mapping for existing claim items.
UPDATE public.claim_items
SET category = CASE category
    WHEN 'general' THEN '一般雜支'
    WHEN 'travel' THEN '差旅費'
    WHEN 'food' THEN '伙食費'
    ELSE category
END
WHERE category IN ('general', 'travel', 'food');

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.profiles
SET created_at = COALESCE(created_at, now()),
    updated_at = COALESCE(updated_at, now())
WHERE created_at IS NULL OR updated_at IS NULL;

ALTER TABLE public.profiles
    ALTER COLUMN created_at SET DEFAULT now(),
    ALTER COLUMN updated_at SET DEFAULT now(),
    ALTER COLUMN created_at SET NOT NULL,
    ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_profiles_updated_at'
    ) THEN
        CREATE TRIGGER trg_profiles_updated_at
            BEFORE UPDATE ON public.profiles
            FOR EACH ROW
            EXECUTE FUNCTION public.set_row_updated_at();
    END IF;
END $$;

