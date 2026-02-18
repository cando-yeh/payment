-- Backward-compatible bank account decryption:
-- try current primary key first, then legacy keys for historical ciphertexts.

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
    _decrypted_val text;
    _key text;
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

    FOREACH _key IN ARRAY ARRAY[
        public.get_crypto_key(),
        NULLIF(current_setting('app.encryption_key', true), ''),
        'default_dev_key'
    ]
    LOOP
        IF _key IS NULL OR btrim(_key) = '' THEN
            CONTINUE;
        END IF;

        BEGIN
            _decrypted_val := public.pgp_sym_decrypt(_encrypted_val, _key);
            IF _decrypted_val IS NOT NULL THEN
                RETURN _decrypted_val;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- try next key
            NULL;
        END;
    END LOOP;

    RAISE EXCEPTION 'Failed to decrypt bank account with available keys';
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
    _decrypted_val text;
    _key text;
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

    FOREACH _key IN ARRAY ARRAY[
        public.get_crypto_key(),
        NULLIF(current_setting('app.encryption_key', true), ''),
        'default_dev_key'
    ]
    LOOP
        IF _key IS NULL OR btrim(_key) = '' THEN
            CONTINUE;
        END IF;

        BEGIN
            _decrypted_val := public.pgp_sym_decrypt(_encrypted_bank_account, _key);
            IF _decrypted_val IS NOT NULL THEN
                RETURN _decrypted_val;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- try next key
            NULL;
        END;
    END LOOP;

    RAISE EXCEPTION 'Failed to decrypt proposed bank account with available keys';
END;
$$;
