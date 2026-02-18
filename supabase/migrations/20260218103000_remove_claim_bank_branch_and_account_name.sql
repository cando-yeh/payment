-- Remove deprecated floating-account fields from claims module
-- - claims.bank_branch
-- - claims.account_name
-- and align RPC signatures accordingly.

ALTER TABLE public.claims
    DROP COLUMN IF EXISTS bank_branch,
    DROP COLUMN IF EXISTS account_name;

-- Drop old overloads/signatures that referenced removed columns
DROP FUNCTION IF EXISTS public.create_claim(text, uuid, uuid, numeric, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.create_claim(text, uuid, uuid, decimal, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.create_claim(text, text, uuid, uuid, numeric, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.create_claim(text, text, uuid, uuid, decimal, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.update_claim(varchar, uuid, decimal, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.update_claim(varchar, uuid, numeric, text, text, text, text, boolean);

CREATE OR REPLACE FUNCTION public.create_claim(
    _claim_type text,
    _applicant_id uuid,
    _payee_id uuid,
    _total_amount numeric,
    _bank_code text DEFAULT NULL::text,
    _bank_account text DEFAULT NULL::text,
    _pay_first_patch_doc boolean DEFAULT false
)
RETURNS character varying
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        bank_account,
        pay_first_patch_doc
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
        CASE
            WHEN _bank_account IS NOT NULL AND _bank_account <> ''
            THEN pgp_sym_encrypt(
                _bank_account,
                COALESCE(current_setting('app.encryption_key', true), 'default_dev_key')
            )
            ELSE NULL
        END,
        _pay_first_patch_doc
    );

    RETURN _claim_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_claim(
    _claim_type text,
    _description text,
    _applicant_id uuid,
    _payee_id uuid,
    _total_amount numeric,
    _bank_code text DEFAULT NULL::text,
    _bank_account text DEFAULT NULL::text,
    _pay_first_patch_doc boolean DEFAULT false
)
RETURNS character varying
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        description,
        applicant_id,
        payee_id,
        total_amount,
        status,
        created_at,
        updated_at,
        bank_code,
        bank_account,
        pay_first_patch_doc
    ) VALUES (
        _claim_id,
        _claim_type::claim_type,
        _description,
        _applicant_id,
        _payee_id,
        _total_amount,
        'draft',
        now(),
        now(),
        _bank_code,
        CASE
            WHEN _bank_account IS NOT NULL AND _bank_account <> ''
            THEN pgp_sym_encrypt(
                _bank_account,
                COALESCE(current_setting('app.encryption_key', true), 'default_dev_key')
            )
            ELSE NULL
        END,
        _pay_first_patch_doc
    );

    RETURN _claim_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_claim(
    _claim_id varchar(8),
    _payee_id uuid,
    _total_amount decimal,
    _bank_code text DEFAULT NULL,
    _bank_account text DEFAULT NULL,
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

REVOKE ALL ON FUNCTION public.create_claim(text, uuid, uuid, numeric, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_claim(text, uuid, uuid, numeric, text, text, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.create_claim(text, text, uuid, uuid, numeric, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_claim(text, text, uuid, uuid, numeric, text, text, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.update_claim(varchar, uuid, decimal, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_claim(varchar, uuid, decimal, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_claim_detail(_claim_id text)
RETURNS TABLE (
    id varchar(8),
    claim_type text,
    description text,
    applicant_id uuid,
    payee_id uuid,
    total_amount numeric,
    status text,
    created_at timestamptz,
    updated_at timestamptz,
    bank_code text,
    bank_account text,
    items jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.claim_type::text,
        c.description,
        c.applicant_id,
        c.payee_id,
        c.total_amount,
        c.status::text,
        c.created_at,
        c.updated_at,
        c.bank_code,
        CASE 
            WHEN c.bank_account IS NOT NULL 
            THEN pgp_sym_decrypt(c.bank_account, 'payment_system_secret_key')
            ELSE NULL 
        END as bank_account,
        coalesce(
            (
                SELECT jsonb_agg(to_jsonb(ci.*) ORDER BY ci.item_index)
                FROM public.claim_items ci
                WHERE ci.claim_id = c.id
            ),
            '[]'::jsonb
        ) as items
    FROM public.claims c
    WHERE c.id = _claim_id;
END;
$$;
