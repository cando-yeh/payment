-- 1. Add column for encrypted Tax ID in requests
ALTER TABLE public.payee_change_requests 
ADD COLUMN IF NOT EXISTS proposed_tax_id bytea;

-- 2. Function to submit a payee change request
-- Handles encryption of sensitive bank account AND Tax ID data
CREATE OR REPLACE FUNCTION public.submit_payee_change_request(
    _change_type text,             -- 'create', 'update', 'disable'
    _payee_id uuid,                -- NULL for create
    _proposed_data jsonb,          -- Non-sensitive data (name, type, etc.)
    _proposed_tax_id text,         -- Raw Tax ID (to be encrypted)
    _proposed_bank_account text,   -- Raw bank account string (to be encrypted)
    _reason text                   -- Reason for change
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _new_request_id uuid;
    _encrypted_account bytea;
    _encrypted_tax_id bytea;
BEGIN
    -- Encrypt Bank Account if provided
    IF _proposed_bank_account IS NOT NULL AND length(_proposed_bank_account) > 0 THEN
        _encrypted_account := pgp_sym_encrypt(
            _proposed_bank_account,
            COALESCE(current_setting('app.encryption_key', true), 'default_dev_key')
        );
    ELSE
        _encrypted_account := NULL;
    END IF;

    -- Encrypt Tax ID if provided
    IF _proposed_tax_id IS NOT NULL AND length(_proposed_tax_id) > 0 THEN
        _encrypted_tax_id := pgp_sym_encrypt(
            _proposed_tax_id,
            COALESCE(current_setting('app.encryption_key', true), 'default_dev_key')
        );
    ELSE
        _encrypted_tax_id := NULL;
    END IF;

    -- Insert into payee_change_requests
    INSERT INTO public.payee_change_requests (
        payee_id,
        change_type,
        requested_by,
        proposed_data,
        proposed_tax_id,
        proposed_bank_account,
        reason,
        status
    )
    VALUES (
        _payee_id,
        _change_type::vendor_change_type,
        auth.uid(),
        _proposed_data,
        _encrypted_tax_id,
        _encrypted_account,
        _reason,
        'pending'
    )
    RETURNING id INTO _new_request_id;

    RETURN _new_request_id;
END;
$$;

-- 3. Function to approve a payee change request (Finance Only)
CREATE OR REPLACE FUNCTION public.approve_payee_change_request(
    _request_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _req record;
    _new_payee_id uuid;
BEGIN
    -- Check permission (Finance Only)
    IF NOT public.is_finance() THEN
        RAISE EXCEPTION 'Only finance users can approve requests';
    END IF;

    -- Get the request
    SELECT * INTO _req FROM public.payee_change_requests WHERE id = _request_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found';
    END IF;

    IF _req.status != 'pending' THEN
        RAISE EXCEPTION 'Request is already processed';
    END IF;

    -- Validate payee type before processing
    IF _req.change_type = 'create' THEN
        IF _req.proposed_data->>'type' IS NULL OR 
           _req.proposed_data->>'type' NOT IN ('employee', 'vendor', 'personal') THEN
            RAISE EXCEPTION 'Invalid payee type: %', COALESCE(_req.proposed_data->>'type', 'NULL');
        END IF;
    END IF;

    -- Apply changes based on type
    IF _req.change_type = 'create' THEN
        -- Insert new payee
        INSERT INTO public.payees (
            type,
            name,
            tax_id, 
            bank,
            bank_account,
            service_description,
            extra_info, 
            status
        )
        VALUES (
            (_req.proposed_data->>'type')::payee_type,
            _req.proposed_data->>'name',
            _req.proposed_tax_id, -- Use the encrypted bytea directly
            _req.proposed_data->>'bank_code',
            _req.proposed_bank_account, -- Use the encrypted bytea directly
            _req.proposed_data->>'service_description',
            _req.proposed_data - 'name' - 'type' - 'bank_code' - 'service_description', 
            'available' 
        )
        RETURNING id INTO _new_payee_id;
        
        -- Update request with the new payee_id
        UPDATE public.payee_change_requests 
        SET payee_id = _new_payee_id, status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
        WHERE id = _request_id;

    ELSIF _req.change_type = 'update' THEN
        -- Update existing payee
        UPDATE public.payees
        SET
            name = COALESCE(_req.proposed_data->>'name', name),
            tax_id = COALESCE(_req.proposed_tax_id, tax_id),
            bank = COALESCE(_req.proposed_data->>'bank_code', bank),
            bank_account = COALESCE(_req.proposed_bank_account, bank_account),
            service_description = COALESCE(_req.proposed_data->>'service_description', service_description),
            extra_info = extra_info || (_req.proposed_data - 'name' - 'type' - 'bank_code' - 'service_description'),
            updated_at = now()
        WHERE id = _req.payee_id;

        UPDATE public.payee_change_requests 
        SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
        WHERE id = _request_id;

    ELSIF _req.change_type = 'disable' THEN
        -- Disable payee
        UPDATE public.payees
        SET status = 'disabled', updated_at = now()
        WHERE id = _req.payee_id;

        UPDATE public.payee_change_requests 
        SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
        WHERE id = _request_id;
    END IF;

END;
$$;

-- 4. Refine RLS policies on payee_change_requests
-- Replace overly permissive ALL policy with granular policies
DROP POLICY IF EXISTS payee_change_own ON payee_change_requests;

-- Users can SELECT their own requests
CREATE POLICY IF NOT EXISTS payee_change_select_own ON payee_change_requests
  FOR SELECT USING (requested_by = auth.uid());

-- Users can only DELETE (withdraw) their own PENDING requests
CREATE POLICY IF NOT EXISTS payee_change_delete_own ON payee_change_requests
  FOR DELETE USING (requested_by = auth.uid() AND status = 'pending');
