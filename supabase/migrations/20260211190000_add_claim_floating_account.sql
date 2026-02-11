-- Add columns for Floating Account Handling to claims table
-- These columns allow overriding the vendor's default bank account for a specific claim.

ALTER TABLE public.claims
ADD COLUMN IF NOT EXISTS bank_code text,
ADD COLUMN IF NOT EXISTS bank_branch text,
ADD COLUMN IF NOT EXISTS bank_account bytea, -- Encrypted
ADD COLUMN IF NOT EXISTS account_name text;

-- Comment on columns
COMMENT ON COLUMN public.claims.bank_code IS 'Floating Account: Bank Code override';
COMMENT ON COLUMN public.claims.bank_branch IS 'Floating Account: Branch Code override';
COMMENT ON COLUMN public.claims.bank_account IS 'Floating Account: Encrypted Bank Account Number override';
COMMENT ON COLUMN public.claims.account_name IS 'Floating Account: Account Name override';
