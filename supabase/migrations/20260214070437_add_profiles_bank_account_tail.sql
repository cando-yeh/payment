-- Add bank_account_tail to profiles for masked display without decryption.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS bank_account_tail text;

-- Keep encrypted account + tail in sync when updating profile bank account.
CREATE OR REPLACE FUNCTION public.update_profile_bank_account(target_id uuid, raw_account text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $function$
DECLARE
    crypto_key TEXT;
    current_uid UUID;
    normalized_account TEXT;
    account_tail TEXT;
BEGIN
    current_uid := auth.uid();

    SELECT value INTO crypto_key
    FROM public.system_config
    WHERE key = 'bank_encryption_key';

    normalized_account := btrim(COALESCE(raw_account, ''));

    IF normalized_account = '' THEN
        account_tail := NULL;
    ELSIF length(normalized_account) <= 5 THEN
        account_tail := normalized_account;
    ELSE
        account_tail := right(normalized_account, 5);
    END IF;

    IF (current_uid = target_id) OR (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE id = current_uid AND is_admin = true
        )
    ) THEN
        UPDATE public.profiles
        SET
            bank_account = pgp_sym_encrypt(normalized_account, crypto_key),
            bank_account_tail = account_tail,
            updated_at = NOW()
        WHERE id = target_id;
    ELSE
        RAISE EXCEPTION '權限不足。呼叫者 UID: %, 目標 UID: %', COALESCE(current_uid::text, 'NULL'), target_id;
    END IF;
END;
$function$;
