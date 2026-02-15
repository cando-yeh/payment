-- Remove redundant schema objects confirmed unused by app code.

-- 1) Remove legacy/unused attachment pointer (file metadata is stored in claim_items.extra)
ALTER TABLE public.claim_items
DROP COLUMN IF EXISTS attachment_id;

-- 2) Remove unused category master table (no runtime references)
DROP TABLE IF EXISTS public.expense_categories;
