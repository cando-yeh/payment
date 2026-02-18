-- Fix payee bank account reveal functions to use the same crypto key resolver
-- as encryption paths (public.get_crypto_key()).

CREATE OR REPLACE FUNCTION public.reveal_payee_bank_account(
    _payee_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _encrypted_val bytea;
BEGIN
    IF NOT public.is_finance() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Insufficient permissions to reveal sensitive data';
    END IF;

    SELECT bank_account
    INTO _encrypted_val
    FROM public.payees
    WHERE id = _payee_id;

    IF _encrypted_val IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN public.pgp_sym_decrypt(
        _encrypted_val,
        public.get_crypto_key()
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.reveal_payee_change_request_bank_account(
    _request_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _encrypted_bank_account bytea;
    _requested_by uuid;
BEGIN
    SELECT proposed_bank_account, requested_by
    INTO _encrypted_bank_account, _requested_by
    FROM public.payee_change_requests
    WHERE id = _request_id;

    IF _encrypted_bank_account IS NULL THEN
        RETURN NULL;
    END IF;

    IF NOT (
        public.is_finance()
        OR public.is_admin()
        OR _requested_by = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not allowed to reveal proposed bank account';
    END IF;

    RETURN public.pgp_sym_decrypt(
        _encrypted_bank_account,
        public.get_crypto_key()
    );
END;
$$;
