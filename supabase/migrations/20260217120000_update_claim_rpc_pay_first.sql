-- Update update_claim RPC to include pay_first_patch_doc
CREATE OR REPLACE FUNCTION public.update_claim(
    _claim_id varchar(8),
    _payee_id uuid,
    _total_amount decimal,
    _bank_code text DEFAULT NULL,
    _bank_branch text DEFAULT NULL,
    _bank_account text DEFAULT NULL,
    _account_name text DEFAULT NULL,
    _pay_first_patch_doc boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _claim record;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT id, applicant_id, status
    INTO _claim
    FROM public.claims
    WHERE id = _claim_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim not found';
    END IF;

    IF _claim.applicant_id <> auth.uid() THEN
        RAISE EXCEPTION 'You can only update your own claim';
    END IF;

    IF _claim.status NOT IN ('draft', 'returned') THEN
        RAISE EXCEPTION 'Only draft or returned claims can be updated';
    END IF;

    UPDATE public.claims
    SET
        payee_id = _payee_id,
        total_amount = _total_amount,
        bank_code = NULLIF(_bank_code, ''),
        bank_branch = CASE WHEN NULLIF(_bank_code, '') IS NULL THEN NULL ELSE NULLIF(_bank_branch, '') END,
        account_name = CASE WHEN NULLIF(_bank_code, '') IS NULL THEN NULL ELSE NULLIF(_account_name, '') END,
        pay_first_patch_doc = _pay_first_patch_doc,
        updated_at = now()
    WHERE id = _claim_id;

    IF NULLIF(_bank_code, '') IS NULL THEN
        UPDATE public.claims
        SET bank_account = NULL
        WHERE id = _claim_id;
    ELSIF _bank_account IS NOT NULL AND _bank_account <> '' THEN
        UPDATE public.claims
        SET bank_account = pgp_sym_encrypt(
            _bank_account,
            COALESCE(current_setting('app.encryption_key', true), 'default_dev_key')
        )
        WHERE id = _claim_id;
    END IF;
END;
$$;

-- Revoke and Grant again to ensure correct signatures
REVOKE ALL ON FUNCTION public.update_claim(varchar, uuid, decimal, text, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_claim(varchar, uuid, decimal, text, text, text, text, boolean) TO authenticated;
