ALTER TABLE public.claims DROP COLUMN IF EXISTS description;

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
        _claim_type::claim_type_enum,
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

CREATE OR REPLACE FUNCTION public.get_claim_detail(_claim_id text)
RETURNS TABLE (
    id varchar(8),
    claim_type text,
    applicant_id uuid,
    payee_id uuid,
    total_amount numeric,
    status text,
    created_at timestamptz,
    updated_at timestamptz,
    bank_code text,
    bank_branch text,
    bank_account text,
    account_name text,
    items jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _viewer_id uuid;
BEGIN
    _viewer_id := auth.uid();
    IF _viewer_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    RETURN QUERY
    SELECT
        c.id,
        c.claim_type::text,
        c.applicant_id,
        c.payee_id,
        c.total_amount,
        c.status::text,
        c.created_at,
        c.updated_at,
        c.bank_code,
        c.bank_branch,
        CASE
            WHEN c.bank_account IS NOT NULL
            THEN pgp_sym_decrypt(
                c.bank_account,
                COALESCE(current_setting('app.encryption_key', true), 'default_dev_key')
            )
            ELSE NULL
        END as bank_account,
        c.account_name,
        coalesce(
            (
                SELECT jsonb_agg(to_jsonb(ci.*) ORDER BY ci.item_index)
                FROM public.claim_items ci
                WHERE ci.claim_id = c.id
            ),
            '[]'::jsonb
        ) as items
    FROM public.claims c
    JOIN public.profiles viewer ON viewer.id = _viewer_id
    WHERE c.id = _claim_id
      AND (
            c.applicant_id = _viewer_id
            OR viewer.is_admin = true
            OR viewer.is_finance = true
            OR EXISTS (
                SELECT 1
                FROM public.profiles applicant
                WHERE applicant.id = c.applicant_id
                  AND applicant.approver_id = _viewer_id
            )
      );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_claim(
    _claim_id varchar(8),
    _payee_id uuid,
    _total_amount decimal,
    _bank_code text DEFAULT NULL,
    _bank_branch text DEFAULT NULL,
    _bank_account text DEFAULT NULL,
    _account_name text DEFAULT NULL
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

REVOKE ALL ON FUNCTION public.create_claim(text, uuid, uuid, decimal, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_claim(text, uuid, uuid, decimal, text, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.update_claim(varchar, uuid, decimal, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_claim(varchar, uuid, decimal, text, text, text, text) TO authenticated;

