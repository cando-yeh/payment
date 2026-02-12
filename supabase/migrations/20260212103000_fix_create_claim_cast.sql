-- Fix create_claim enum cast after description removal migration.
CREATE OR REPLACE FUNCTION public.create_claim(
    _claim_type text,
    _applicant_id uuid,
    _payee_id uuid,
    _total_amount decimal,
    _bank_code text DEFAULT NULL,
    _bank_branch text DEFAULT NULL,
    _bank_account text DEFAULT NULL,
    _account_name text DEFAULT NULL
)
RETURNS varchar(8)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _claim_id varchar(8);
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF auth.uid() <> _applicant_id THEN
        RAISE EXCEPTION 'You can only create claims for yourself';
    END IF;

    IF _claim_type <> 'employee' AND _payee_id IS NULL THEN
        RAISE EXCEPTION 'Payee is required for non-employee claims';
    END IF;

    IF _claim_type = 'employee' THEN
        _payee_id := NULL;
    END IF;

    LOOP
        _claim_id := upper(substring(md5(random()::text) from 1 for 8));
        IF NOT EXISTS (SELECT 1 FROM public.claims WHERE id = _claim_id) THEN
            EXIT;
        END IF;
    END LOOP;

    INSERT INTO public.claims (
        id,
        claim_type,
        applicant_id,
        payee_id,
        total_amount,
        status,
        created_at,
        updated_at,
        bank_code,
        bank_branch,
        bank_account,
        account_name
    ) VALUES (
        _claim_id,
        _claim_type::claim_type,
        _applicant_id,
        _payee_id,
        _total_amount,
        'draft',
        now(),
        now(),
        _bank_code,
        _bank_branch,
        CASE
            WHEN _bank_account IS NOT NULL AND _bank_account <> ''
            THEN pgp_sym_encrypt(
                _bank_account,
                COALESCE(current_setting('app.encryption_key', true), 'default_dev_key')
            )
            ELSE NULL
        END,
        _account_name
    );

    RETURN _claim_id;
END;
$$;
