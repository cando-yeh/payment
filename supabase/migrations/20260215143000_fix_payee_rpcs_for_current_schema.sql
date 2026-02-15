-- Align payee RPCs with current schema (no proposed_unified_no/proposed_national_id columns).
-- Also restore get_crypto_key() compatibility helper for legacy function callers.

CREATE OR REPLACE FUNCTION public.get_crypto_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _key text;
BEGIN
    SELECT value
    INTO _key
    FROM public.system_config
    WHERE key IN ('bank_encryption_key', 'app_encryption_key')
      AND value IS NOT NULL
      AND btrim(value) <> ''
    ORDER BY CASE key WHEN 'bank_encryption_key' THEN 1 ELSE 2 END
    LIMIT 1;

    RETURN COALESCE(
        _key,
        NULLIF(current_setting('app.encryption_key', true), ''),
        'default_dev_key'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_crypto_key() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_crypto_key() TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_payee_change_request(
    _change_type text,
    _payee_id uuid,
    _proposed_data jsonb,
    _proposed_tax_id text,
    _proposed_bank_account text,
    _reason text,
    _proposed_attachments jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _new_request_id uuid;
    _payload jsonb;
    _normalized_tax_id text;
    _encrypted_account bytea;
    _account_tail text;
BEGIN
    _payload := COALESCE(_proposed_data, '{}'::jsonb);
    _normalized_tax_id := btrim(COALESCE(_proposed_tax_id, ''));

    IF _normalized_tax_id <> '' THEN
        _payload := _payload || jsonb_build_object('identity_no', _normalized_tax_id);
    END IF;

    IF _proposed_bank_account IS NOT NULL AND length(btrim(_proposed_bank_account)) > 0 THEN
        _encrypted_account := public.pgp_sym_encrypt(
            btrim(_proposed_bank_account),
            COALESCE(NULLIF(current_setting('app.encryption_key', true), ''), 'default_dev_key')
        );
        IF length(btrim(_proposed_bank_account)) <= 5 THEN
            _account_tail := btrim(_proposed_bank_account);
        ELSE
            _account_tail := right(btrim(_proposed_bank_account), 5);
        END IF;
    ELSE
        _encrypted_account := NULL;
        _account_tail := NULL;
    END IF;

    INSERT INTO public.payee_change_requests (
        payee_id,
        change_type,
        requested_by,
        proposed_data,
        proposed_bank_account,
        proposed_bank_account_tail,
        proposed_attachments,
        reason,
        status
    )
    VALUES (
        _payee_id,
        _change_type::vendor_change_type,
        auth.uid(),
        _payload,
        _encrypted_account,
        _account_tail,
        COALESCE(_proposed_attachments, '{}'::jsonb),
        _reason,
        'pending'
    )
    RETURNING id INTO _new_request_id;

    RETURN _new_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_payee_change_request(
    _request_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _req record;
    _new_payee_id uuid;
BEGIN
    IF NOT public.is_finance() THEN
        RAISE EXCEPTION 'Only finance users can approve requests';
    END IF;

    SELECT * INTO _req
    FROM public.payee_change_requests
    WHERE id = _request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found';
    END IF;

    IF _req.status <> 'pending' THEN
        RAISE EXCEPTION 'Request is already processed';
    END IF;

    IF _req.change_type = 'create' THEN
        INSERT INTO public.payees (
            type,
            name,
            bank,
            bank_account,
            bank_account_tail,
            service_description,
            extra_info,
            status,
            attachments
        )
        VALUES (
            COALESCE(NULLIF(_req.proposed_data->>'type', ''), 'vendor')::payee_type,
            COALESCE(NULLIF(_req.proposed_data->>'name', ''), '未命名收款人'),
            NULLIF(_req.proposed_data->>'bank_code', ''),
            _req.proposed_bank_account,
            _req.proposed_bank_account_tail,
            NULLIF(_req.proposed_data->>'service_description', ''),
            (_req.proposed_data - 'name' - 'type' - 'bank_code' - 'service_description'),
            'available',
            COALESCE(_req.proposed_attachments, '{}'::jsonb)
        )
        RETURNING id INTO _new_payee_id;

        UPDATE public.payee_change_requests
        SET payee_id = _new_payee_id,
            status = 'approved',
            reviewed_by = auth.uid(),
            reviewed_at = now()
        WHERE id = _request_id;

    ELSIF _req.change_type = 'update' THEN
        UPDATE public.payees
        SET
            type = CASE
                WHEN NULLIF(_req.proposed_data->>'type', '') IS NOT NULL
                    THEN (_req.proposed_data->>'type')::payee_type
                ELSE type
            END,
            name = COALESCE(NULLIF(_req.proposed_data->>'name', ''), name),
            bank = COALESCE(NULLIF(_req.proposed_data->>'bank_code', ''), bank),
            bank_account = COALESCE(_req.proposed_bank_account, bank_account),
            bank_account_tail = COALESCE(_req.proposed_bank_account_tail, bank_account_tail),
            service_description = COALESCE(NULLIF(_req.proposed_data->>'service_description', ''), service_description),
            extra_info = COALESCE(extra_info, '{}'::jsonb) || (_req.proposed_data - 'name' - 'type' - 'bank_code' - 'service_description'),
            attachments = CASE
                WHEN _req.proposed_attachments IS NOT NULL AND _req.proposed_attachments <> '{}'::jsonb
                    THEN _req.proposed_attachments
                ELSE attachments
            END,
            updated_at = now()
        WHERE id = _req.payee_id;

        UPDATE public.payee_change_requests
        SET status = 'approved',
            reviewed_by = auth.uid(),
            reviewed_at = now()
        WHERE id = _request_id;

    ELSIF _req.change_type = 'disable' THEN
        UPDATE public.payees
        SET status = 'disabled',
            updated_at = now()
        WHERE id = _req.payee_id;

        UPDATE public.payee_change_requests
        SET status = 'approved',
            reviewed_by = auth.uid(),
            reviewed_at = now()
        WHERE id = _request_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reveal_payee_tax_id(
    _payee_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _identity text;
BEGIN
    IF NOT (public.is_finance() OR public.is_admin()) THEN
        RAISE EXCEPTION 'Insufficient permissions to reveal sensitive data';
    END IF;

    SELECT NULLIF(btrim(COALESCE(extra_info->>'identity_no', '')), '')
    INTO _identity
    FROM public.payees
    WHERE id = _payee_id;

    RETURN _identity;
END;
$$;

CREATE OR REPLACE FUNCTION public.reveal_payee_change_request_tax_id(
    _request_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _identity text;
    _requested_by uuid;
BEGIN
    SELECT
        NULLIF(btrim(COALESCE(proposed_data->>'identity_no', '')), ''),
        requested_by
    INTO _identity, _requested_by
    FROM public.payee_change_requests
    WHERE id = _request_id;

    IF _requested_by IS NULL THEN
        RAISE EXCEPTION 'Request not found';
    END IF;

    IF NOT (public.is_finance() OR public.is_admin() OR auth.uid() = _requested_by) THEN
        RAISE EXCEPTION 'Not allowed to reveal proposed tax id';
    END IF;

    RETURN _identity;
END;
$$;
