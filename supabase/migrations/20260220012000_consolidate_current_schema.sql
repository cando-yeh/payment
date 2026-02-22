-- Consolidate current production schema/RPC surface used by application code.
-- This migration is intentionally idempotent and focuses on:
-- 1) Removing legacy columns/signatures no longer used.
-- 2) Re-applying current RPC contracts for claims/payees.
-- 3) Aligning crypto key + reveal logic with current encryption strategy.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt(data text, psw text)
RETURNS bytea
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, extensions
AS $$
  SELECT extensions.pgp_sym_encrypt(data, psw);
$$;

CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt(data bytea, psw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, extensions
AS $$
  SELECT extensions.pgp_sym_decrypt(data, psw);
$$;

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

-- Normalize schema shape to current model.
ALTER TABLE public.claims
    DROP COLUMN IF EXISTS bank_branch,
    DROP COLUMN IF EXISTS account_name;

ALTER TABLE public.claim_items
    DROP COLUMN IF EXISTS attachment_id;

ALTER TABLE public.payees
    ADD COLUMN IF NOT EXISTS editable_account boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS unified_no text,
    ADD COLUMN IF NOT EXISTS national_id bytea,
    DROP COLUMN IF EXISTS tax_id,
    DROP COLUMN IF EXISTS national_id_tail;

ALTER TABLE public.payee_change_requests
    ADD COLUMN IF NOT EXISTS proposed_unified_no text,
    ADD COLUMN IF NOT EXISTS proposed_national_id bytea,
    DROP COLUMN IF EXISTS reject_reason,
    DROP COLUMN IF EXISTS proposed_tax_id,
    DROP COLUMN IF EXISTS proposed_national_id_tail;

CREATE INDEX IF NOT EXISTS idx_payees_unified_no ON public.payees (unified_no);

-- Remove legacy/obsolete RPC signatures to avoid schema-cache ambiguity.
DROP FUNCTION IF EXISTS public.submit_payee_change_request(text, uuid, jsonb, text, text, text);
DROP FUNCTION IF EXISTS public.create_claim(text, text, uuid, uuid, decimal, text, text, text, text);
DROP FUNCTION IF EXISTS public.create_claim(text, text, uuid, uuid, numeric, text, text, text, text);
DROP FUNCTION IF EXISTS public.create_claim(text, uuid, uuid, decimal, text, text, text, text);
DROP FUNCTION IF EXISTS public.create_claim(text, uuid, uuid, numeric, text, text, text, text);
DROP FUNCTION IF EXISTS public.create_claim(text, uuid, uuid, decimal, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.create_claim(text, uuid, uuid, numeric, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.create_claim(text, text, uuid, uuid, decimal, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.create_claim(text, text, uuid, uuid, numeric, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.update_claim(varchar, text, uuid, decimal, text, text, text, text);
DROP FUNCTION IF EXISTS public.update_claim(varchar, uuid, decimal, text, text, text, text);
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
            THEN public.pgp_sym_encrypt(
                _bank_account,
                public.get_crypto_key()
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
            THEN public.pgp_sym_encrypt(
                _bank_account,
                public.get_crypto_key()
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

    IF _claim.status NOT IN ('draft', 'rejected') THEN
        RAISE EXCEPTION 'Only draft or rejected claims can be updated';
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
        SET bank_account = public.pgp_sym_encrypt(
            _bank_account,
            public.get_crypto_key()
        )
        WHERE id = _claim_id;
    END IF;
END;
$$;

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
SET search_path = public
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
            THEN public.pgp_sym_decrypt(c.bank_account, public.get_crypto_key())
            ELSE NULL
        END AS bank_account,
        COALESCE(
            (
                SELECT jsonb_agg(to_jsonb(ci.*) ORDER BY ci.item_index)
                FROM public.claim_items ci
                WHERE ci.claim_id = c.id
            ),
            '[]'::jsonb
        ) AS items
    FROM public.claims c
    WHERE c.id = _claim_id;
END;
$$;

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
            NULL;
        END;
    END LOOP;

    RAISE EXCEPTION 'Failed to decrypt proposed bank account with available keys';
END;
$$;

CREATE OR REPLACE FUNCTION public.log_claim_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO claim_history (
            claim_id,
            actor_id,
            action,
            from_status,
            to_status,
            comment,
            created_at
        ) VALUES (
            NEW.id,
            auth.uid(),
            CASE
                WHEN NEW.status = 'pending_manager' AND OLD.status IN ('draft', 'rejected') THEN 'submit'
                WHEN NEW.status = 'pending_finance' AND OLD.status = 'pending_manager' THEN 'approve_manager'
                WHEN NEW.status = 'pending_payment' AND OLD.status = 'pending_finance' THEN 'approve_finance'
                WHEN NEW.status = 'rejected' AND OLD.status = 'pending_manager' THEN 'reject_manager'
                WHEN NEW.status = 'rejected' AND OLD.status = 'pending_finance' THEN 'reject_finance'
                WHEN NEW.status = 'paid' AND OLD.status = 'pending_doc_review' THEN 'supplement_approved'
                WHEN NEW.status = 'paid_pending_doc' AND OLD.status = 'pending_doc_review' THEN 'supplement_rejected'
                WHEN NEW.status = 'pending_doc_review' AND OLD.status = 'paid_pending_doc' THEN 'supplement_submitted'
                WHEN OLD.status = 'pending_payment' AND NEW.status = 'paid' THEN 'pay_completed'
                WHEN OLD.status = 'pending_payment' AND NEW.status = 'paid_pending_doc' THEN 'pay_completed_need_doc'
                WHEN NEW.status = 'pending_finance' AND OLD.status = 'pending_payment' THEN 'reject_payment'
                WHEN NEW.status = 'cancelled' THEN 'cancelled'
                WHEN NEW.status = 'pending_payment' AND OLD.status = 'paid' THEN 'payment_reversed'
                WHEN NEW.status = 'draft' AND OLD.status IN ('pending_manager', 'pending_finance') THEN 'withdraw'
                ELSE 'status_change'
            END,
            OLD.status,
            NEW.status,
            NEW.last_comment,
            now()
        );

        NEW.last_comment := NULL;
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_claim(text, uuid, uuid, numeric, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_claim(text, uuid, uuid, numeric, text, text, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.create_claim(text, text, uuid, uuid, numeric, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_claim(text, text, uuid, uuid, numeric, text, text, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.update_claim(varchar, uuid, decimal, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_claim(varchar, uuid, decimal, text, text, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.get_claim_detail(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_claim_detail(text) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_payee_change_request(text, uuid, jsonb, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_payee_change_request(text, uuid, jsonb, text, text, text, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_payee_change_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_payee_change_request(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reveal_payee_tax_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reveal_payee_tax_id(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reveal_payee_change_request_tax_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reveal_payee_change_request_tax_id(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reveal_payee_bank_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reveal_payee_bank_account(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reveal_payee_change_request_bank_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reveal_payee_change_request_bank_account(uuid) TO authenticated;
