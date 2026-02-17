-- Migration: Update create_claim RPC to accept pay_first_patch_doc
-- Description: Adds _pay_first_patch_doc parameter to create_claim function.
-- Created: 2026-02-17

CREATE OR REPLACE FUNCTION public.create_claim(
    _claim_type text,
    _applicant_id uuid,
    _payee_id uuid,
    _total_amount numeric,
    _bank_code text DEFAULT NULL::text,
    _bank_branch text DEFAULT NULL::text,
    _bank_account text DEFAULT NULL::text,
    _account_name text DEFAULT NULL::text,
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
        bank_branch,
        bank_account,
        account_name,
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
        _bank_branch,
        CASE
            WHEN _bank_account IS NOT NULL AND _bank_account <> ''
            THEN pgp_sym_encrypt(
                _bank_account,
                COALESCE(current_setting('app.encryption_key', true), 'default_dev_key')
            )
            ELSE NULL
        END,
        _account_name,
        _pay_first_patch_doc
    );

    RETURN _claim_id;
END;
$function$;

-- Update the version with description parameter as well (if needed, but usually one is preferred)
-- Actually the previous view_file showed two versions. I should probably update both or consolidate.
-- Let's update the one that matches what it will likely be used with.

CREATE OR REPLACE FUNCTION public.create_claim(
    _claim_type text,
    _description text,
    _applicant_id uuid,
    _payee_id uuid,
    _total_amount numeric,
    _bank_code text DEFAULT NULL::text,
    _bank_branch text DEFAULT NULL::text,
    _bank_account text DEFAULT NULL::text,
    _account_name text DEFAULT NULL::text,
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
        bank_branch,
        bank_account,
        account_name,
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
        _bank_branch,
        CASE
            WHEN _bank_account IS NOT NULL AND _bank_account <> ''
            THEN pgp_sym_encrypt(
                _bank_account,
                COALESCE(current_setting('app.encryption_key', true), 'default_dev_key')
            )
            ELSE NULL
        END,
        _account_name,
        _pay_first_patch_doc
    );

    RETURN _claim_id;
END;
$function$;
