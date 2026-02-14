-- Reveal decrypted proposed bank account from payee change request
CREATE OR REPLACE FUNCTION public.reveal_payee_change_request_bank_account(
    _request_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
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

    RETURN pgp_sym_decrypt(
        _encrypted_bank_account,
        COALESCE(current_setting('app.encryption_key', true), 'default_dev_key')
    )::text;
END;
$$;

ALTER FUNCTION public.reveal_payee_change_request_bank_account(uuid)
SET search_path = public, extensions;
