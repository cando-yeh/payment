-- Add dedicated identity columns for payees:
-- - unified_no: vendor unified tax id (plaintext)
-- - national_id: personal id (encrypted bytea)
-- No tail column is kept for national_id.

ALTER TABLE public.payees
ADD COLUMN IF NOT EXISTS unified_no text,
ADD COLUMN IF NOT EXISTS national_id bytea;

ALTER TABLE public.payee_change_requests
ADD COLUMN IF NOT EXISTS proposed_unified_no text,
ADD COLUMN IF NOT EXISTS proposed_national_id bytea;

ALTER TABLE public.payees
DROP COLUMN IF EXISTS national_id_tail;

ALTER TABLE public.payee_change_requests
DROP COLUMN IF EXISTS proposed_national_id_tail;

CREATE INDEX IF NOT EXISTS idx_payees_unified_no ON public.payees (unified_no);

-- Backfill existing payee identity data from extra_info.identity_no.
WITH candidates AS (
    SELECT
        p.id,
        p.type::text AS payee_type,
        NULLIF(btrim(COALESCE(p.extra_info->>'identity_no', '')), '') AS identity_no
    FROM public.payees p
)
UPDATE public.payees p
SET
    unified_no = CASE
        WHEN c.payee_type = 'vendor'
            AND c.identity_no ~ '^[0-9]{8}$'
            AND (p.unified_no IS NULL OR btrim(p.unified_no) = '')
            THEN c.identity_no
        ELSE p.unified_no
    END,
    national_id = CASE
        WHEN c.payee_type = 'personal'
            AND c.identity_no ~ '^[A-Z][0-9]{9}$'
            AND p.national_id IS NULL
            THEN public.pgp_sym_encrypt(c.identity_no, public.get_crypto_key())
        ELSE p.national_id
    END,
    extra_info = COALESCE(p.extra_info, '{}'::jsonb) - 'identity_no'
FROM candidates c
WHERE p.id = c.id
  AND c.identity_no IS NOT NULL;

-- Backfill pending/history change requests from proposed_data.identity_no.
WITH candidates AS (
    SELECT
        r.id,
        COALESCE(NULLIF(r.proposed_data->>'type', ''), p.type::text, 'vendor') AS effective_type,
        NULLIF(btrim(COALESCE(r.proposed_data->>'identity_no', '')), '') AS identity_no
    FROM public.payee_change_requests r
    LEFT JOIN public.payees p ON p.id = r.payee_id
)
UPDATE public.payee_change_requests r
SET
    proposed_unified_no = CASE
        WHEN c.effective_type = 'vendor'
            AND c.identity_no ~ '^[0-9]{8}$'
            AND (r.proposed_unified_no IS NULL OR btrim(r.proposed_unified_no) = '')
            THEN c.identity_no
        ELSE r.proposed_unified_no
    END,
    proposed_national_id = CASE
        WHEN c.effective_type = 'personal'
            AND c.identity_no ~ '^[A-Z][0-9]{9}$'
            AND r.proposed_national_id IS NULL
            THEN public.pgp_sym_encrypt(c.identity_no, public.get_crypto_key())
        ELSE r.proposed_national_id
    END,
    proposed_data = COALESCE(r.proposed_data, '{}'::jsonb) - 'identity_no'
FROM candidates c
WHERE r.id = c.id
  AND c.identity_no IS NOT NULL;

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
    _effective_type text;
    _normalized_tax_id text;
    _proposed_unified_no text;
    _proposed_national_id bytea;
    _encrypted_account bytea;
    _account_tail text;
BEGIN
    _payload := COALESCE(_proposed_data, '{}'::jsonb) - 'identity_no';
    _normalized_tax_id := btrim(COALESCE(_proposed_tax_id, ''));

    IF _payee_id IS NOT NULL THEN
        SELECT COALESCE(NULLIF(_payload->>'type', ''), p.type::text, 'vendor')
        INTO _effective_type
        FROM public.payees p
        WHERE p.id = _payee_id;
        _effective_type := COALESCE(_effective_type, COALESCE(NULLIF(_payload->>'type', ''), 'vendor'));
    ELSE
        _effective_type := COALESCE(NULLIF(_payload->>'type', ''), 'vendor');
    END IF;

    IF _normalized_tax_id <> '' THEN
        IF _effective_type = 'vendor' THEN
            _proposed_unified_no := _normalized_tax_id;
            _proposed_national_id := NULL;
        ELSE
            _proposed_unified_no := NULL;
            _proposed_national_id := public.pgp_sym_encrypt(
                _normalized_tax_id,
                public.get_crypto_key()
            );
        END IF;
    ELSE
        _proposed_unified_no := NULL;
        _proposed_national_id := NULL;
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

    INSERT INTO public.payee_change_requests (
        payee_id,
        change_type,
        requested_by,
        proposed_data,
        proposed_unified_no,
        proposed_national_id,
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
        _proposed_unified_no,
        _proposed_national_id,
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

        INSERT INTO public.payees (
            type,
            name,
            bank,
            bank_account,
            bank_account_tail,
            unified_no,
            national_id,
            editable_account,
            service_description,
            extra_info,
            status,
            attachments
        )
        VALUES (
            _effective_type::payee_type,
            COALESCE(NULLIF(_req.proposed_data->>'name', ''), '未命名收款人'),
            NULLIF(_req.proposed_data->>'bank_code', ''),
            _req.proposed_bank_account,
            _req.proposed_bank_account_tail,
            CASE WHEN _effective_type = 'vendor' THEN _req.proposed_unified_no ELSE NULL END,
            CASE WHEN _effective_type = 'personal' THEN _req.proposed_national_id ELSE NULL END,
            CASE
                WHEN _effective_type = 'vendor'
                    THEN COALESCE(NULLIF(_req.proposed_data->>'editable_account', '')::boolean, false)
                ELSE false
            END,
            NULLIF(_req.proposed_data->>'service_description', ''),
            (_req.proposed_data - 'name' - 'type' - 'bank_code' - 'service_description' - 'editable_account' - 'identity_no'),
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
        SELECT COALESCE(NULLIF(_req.proposed_data->>'type', ''), p.type::text, 'vendor')
        INTO _effective_type
        FROM public.payees p
        WHERE p.id = _req.payee_id;

        _effective_type := COALESCE(_effective_type, 'vendor');

        UPDATE public.payees
        SET
            type = _effective_type::payee_type,
            name = COALESCE(NULLIF(_req.proposed_data->>'name', ''), name),
            bank = COALESCE(NULLIF(_req.proposed_data->>'bank_code', ''), bank),
            bank_account = COALESCE(_req.proposed_bank_account, bank_account),
            bank_account_tail = COALESCE(_req.proposed_bank_account_tail, bank_account_tail),
            unified_no = CASE
                WHEN _effective_type = 'vendor' THEN COALESCE(_req.proposed_unified_no, unified_no)
                ELSE NULL
            END,
            national_id = CASE
                WHEN _effective_type = 'personal' THEN COALESCE(_req.proposed_national_id, national_id)
                ELSE NULL
            END,
            editable_account = CASE
                WHEN _effective_type = 'vendor'
                    THEN COALESCE(NULLIF(_req.proposed_data->>'editable_account', '')::boolean, editable_account)
                ELSE false
            END,
            service_description = COALESCE(NULLIF(_req.proposed_data->>'service_description', ''), service_description),
            extra_info = COALESCE(extra_info, '{}'::jsonb) || (_req.proposed_data - 'name' - 'type' - 'bank_code' - 'service_description' - 'editable_account' - 'identity_no'),
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
    IF NOT (public.is_finance() OR public.is_admin()) THEN
        RAISE EXCEPTION 'Insufficient permissions to reveal sensitive data';
    END IF;

    SELECT
        p.type::text,
        NULLIF(btrim(COALESCE(p.unified_no, '')), ''),
        p.national_id
    INTO
        _payee_type,
        _unified_no,
        _encrypted_national_id
    FROM public.payees p
    WHERE p.id = _payee_id;

    IF _payee_type = 'vendor' THEN
        RETURN _unified_no;
    END IF;

    IF _encrypted_national_id IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN public.pgp_sym_decrypt(
        _encrypted_national_id,
        public.get_crypto_key()
    );
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
    _requested_by uuid;
    _effective_type text;
    _proposed_unified_no text;
    _encrypted_national_id bytea;
BEGIN
    SELECT
        r.requested_by,
        COALESCE(NULLIF(r.proposed_data->>'type', ''), p.type::text, 'vendor'),
        NULLIF(btrim(COALESCE(r.proposed_unified_no, '')), ''),
        r.proposed_national_id
    INTO
        _requested_by,
        _effective_type,
        _proposed_unified_no,
        _encrypted_national_id
    FROM public.payee_change_requests r
    LEFT JOIN public.payees p ON p.id = r.payee_id
    WHERE r.id = _request_id;

    IF _requested_by IS NULL THEN
        RAISE EXCEPTION 'Request not found';
    END IF;

    IF NOT (public.is_finance() OR public.is_admin() OR auth.uid() = _requested_by) THEN
        RAISE EXCEPTION 'Not allowed to reveal proposed tax id';
    END IF;

    IF _effective_type = 'vendor' THEN
        RETURN _proposed_unified_no;
    END IF;

    IF _encrypted_national_id IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN public.pgp_sym_decrypt(
        _encrypted_national_id,
        public.get_crypto_key()
    );
END;
$$;
