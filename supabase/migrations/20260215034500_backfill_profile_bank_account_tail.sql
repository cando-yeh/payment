-- Backfill profile bank account tail for legacy rows that predate tail storage.

UPDATE public.profiles
SET bank_account_tail = right(
    public.pgp_sym_decrypt(bank_account, public.get_crypto_key())::text,
    5
)
WHERE bank_account IS NOT NULL
  AND (bank_account_tail IS NULL OR btrim(bank_account_tail) = '');
