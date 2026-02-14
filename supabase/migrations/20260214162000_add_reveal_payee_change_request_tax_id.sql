-- Reveal decrypted tax id from pending payee change request (finance only)
CREATE OR REPLACE FUNCTION public.reveal_payee_change_request_tax_id(
    _request_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _encrypted_tax_id bytea;
BEGIN
    IF NOT public.is_finance() THEN
        RAISE EXCEPTION 'Only finance users can reveal proposed tax id';
    END IF;

    SELECT proposed_tax_id
    INTO _encrypted_tax_id
    FROM public.payee_change_requests
    WHERE id = _request_id;

    IF _encrypted_tax_id IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN pgp_sym_decrypt(
        _encrypted_tax_id,
        COALESCE(current_setting('app.encryption_key', true), 'default_dev_key')
    )::text;
END;
$$;

ALTER FUNCTION public.reveal_payee_change_request_tax_id(uuid)
SET search_path = public, extensions;
