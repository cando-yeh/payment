-- Remove legacy identity columns now that split fields are fully adopted.

ALTER TABLE public.payees
DROP COLUMN IF EXISTS tax_id;

ALTER TABLE public.payee_change_requests
DROP COLUMN IF EXISTS proposed_tax_id;

-- Keep RPC signature for backward compatibility, but stop persisting legacy tax_id columns.
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
    _effective_type text;
    _normalized_tax_id text;
    _encrypted_account bytea;
    _account_tail text;
    _proposed_unified_no text;
    _proposed_national_id bytea;
    _proposed_national_id_tail text;
    _payload jsonb;
BEGIN
    _payload := COALESCE(_proposed_data, '{}'::jsonb);
    _normalized_tax_id := btrim(COALESCE(_proposed_tax_id, ''));

    IF _change_type = 'create' THEN
        _effective_type := COALESCE(NULLIF(btrim(_payload->>'type'), ''), 'vendor');
    ELSE
        SELECT type::text INTO _effective_type
        FROM public.payees
        WHERE id = _payee_id;

        IF _payload ? 'type' AND NULLIF(btrim(_payload->>'type'), '') IS NOT NULL THEN
            _effective_type := btrim(_payload->>'type');
        END IF;

        IF _effective_type IS NULL THEN
            RAISE EXCEPTION 'Cannot infer payee type for request';
        END IF;
    END IF;

    IF _proposed_bank_account IS NOT NULL AND length(btrim(_proposed_bank_account)) > 0 THEN
        _encrypted_account := public.pgp_sym_encrypt(
            btrim(_proposed_bank_account),
            public.get_crypto_key()
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

    IF _normalized_tax_id <> '' THEN
        IF _effective_type = 'vendor' THEN
            _proposed_unified_no := _normalized_tax_id;
            _proposed_national_id := NULL;
            _proposed_national_id_tail := NULL;
            _payload := _payload || jsonb_build_object('identity_no', _proposed_unified_no);
        ELSE
            _proposed_unified_no := NULL;
            _proposed_national_id := public.pgp_sym_encrypt(
                _normalized_tax_id,
                public.get_crypto_key()
            );
            IF length(_normalized_tax_id) <= 5 THEN
                _proposed_national_id_tail := _normalized_tax_id;
            ELSE
                _proposed_national_id_tail := right(_normalized_tax_id, 5);
            END IF;
        END IF;
    ELSE
        _proposed_unified_no := NULL;
        _proposed_national_id := NULL;
        _proposed_national_id_tail := NULL;
    END IF;

    INSERT INTO public.payee_change_requests (
        payee_id,
        change_type,
        requested_by,
        proposed_data,
        proposed_bank_account,
        proposed_bank_account_tail,
        proposed_attachments,
        proposed_unified_no,
        proposed_national_id,
        proposed_national_id_tail,
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
        _proposed_unified_no,
        _proposed_national_id,
        _proposed_national_id_tail,
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
    _effective_type text;
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
        _effective_type := COALESCE(NULLIF(_req.proposed_data->>'type', ''), 'vendor');
    ELSE
        SELECT COALESCE(NULLIF(_req.proposed_data->>'type', ''), type::text)
        INTO _effective_type
        FROM public.payees
        WHERE id = _req.payee_id;
    END IF;

    IF _req.change_type = 'create' THEN
        INSERT INTO public.payees (
            type,
            name,
            unified_no,
            national_id,
            national_id_tail,
            bank,
            bank_account,
            bank_account_tail,
            service_description,
            extra_info,
            status,
            attachments
        )
        VALUES (
            (_req.proposed_data->>'type')::payee_type,
            _req.proposed_data->>'name',
            _req.proposed_unified_no,
            _req.proposed_national_id,
            _req.proposed_national_id_tail,
            _req.proposed_data->>'bank_code',
            _req.proposed_bank_account,
            _req.proposed_bank_account_tail,
            _req.proposed_data->>'service_description',
            _req.proposed_data - 'name' - 'type' - 'bank_code' - 'service_description' - 'identity_no',
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
            type = COALESCE((_req.proposed_data->>'type')::payee_type, type),
            name = COALESCE(_req.proposed_data->>'name', name),
            unified_no = CASE
                WHEN _effective_type = 'vendor' THEN COALESCE(_req.proposed_unified_no, unified_no)
                ELSE NULL
            END,
            national_id = CASE
                WHEN _effective_type = 'personal' THEN COALESCE(_req.proposed_national_id, national_id)
                ELSE NULL
            END,
            national_id_tail = CASE
                WHEN _effective_type = 'personal' THEN COALESCE(_req.proposed_national_id_tail, national_id_tail)
                ELSE NULL
            END,
            bank = COALESCE(_req.proposed_data->>'bank_code', bank),
            bank_account = COALESCE(_req.proposed_bank_account, bank_account),
            bank_account_tail = COALESCE(_req.proposed_bank_account_tail, bank_account_tail),
            service_description = COALESCE(_req.proposed_data->>'service_description', service_description),
            extra_info = extra_info || (_req.proposed_data - 'name' - 'type' - 'bank_code' - 'service_description' - 'identity_no'),
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
    _payee_type text;
    _unified_no text;
    _encrypted_national_id bytea;
BEGIN
    SELECT
        type::text,
        unified_no,
        national_id
    INTO
        _payee_type,
        _unified_no,
        _encrypted_national_id
    FROM public.payees
    WHERE id = _payee_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payee not found';
    END IF;

    IF _payee_type = 'vendor' THEN
        RETURN _unified_no;
    END IF;

    IF NOT (public.is_finance() OR public.is_admin()) THEN
        RAISE EXCEPTION 'Insufficient permissions to reveal sensitive data';
    END IF;

    IF _encrypted_national_id IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN public.pgp_sym_decrypt(
        _encrypted_national_id,
        public.get_crypto_key()
    )::text;
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
    _request_type text;
    _proposed_type text;
    _linked_payee_type text;
    _proposed_unified_no text;
    _encrypted_national_id bytea;
BEGIN
    SELECT
        r.change_type::text,
        NULLIF(r.proposed_data->>'type', ''),
        p.type::text,
        r.proposed_unified_no,
        r.proposed_national_id
    INTO
        _request_type,
        _proposed_type,
        _linked_payee_type,
        _proposed_unified_no,
        _encrypted_national_id
    FROM public.payee_change_requests r
    LEFT JOIN public.payees p ON p.id = r.payee_id
    WHERE r.id = _request_id;

    IF _request_type IS NULL THEN
        RAISE EXCEPTION 'Request not found';
    END IF;

    IF COALESCE(_proposed_type, _linked_payee_type, 'vendor') = 'vendor' THEN
        RETURN _proposed_unified_no;
    END IF;

    IF NOT public.is_finance() THEN
        RAISE EXCEPTION 'Only finance users can reveal proposed tax id';
    END IF;

    IF _encrypted_national_id IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN public.pgp_sym_decrypt(
        _encrypted_national_id,
        public.get_crypto_key()
    )::text;
END;
$$;

ALTER FUNCTION public.submit_payee_change_request(text, uuid, jsonb, text, text, text, jsonb)
    SET search_path = public;
ALTER FUNCTION public.approve_payee_change_request(uuid)
    SET search_path = public;
ALTER FUNCTION public.reveal_payee_tax_id(uuid)
    SET search_path = public;
ALTER FUNCTION public.reveal_payee_change_request_tax_id(uuid)
    SET search_path = public;
