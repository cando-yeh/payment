-- Create RPC for updating claim details with Floating Account encryption support
-- Handles partial updates and clearing of floating account data.

CREATE OR REPLACE FUNCTION public.update_claim(
    _claim_id varchar(8),
    _description text,
    _payee_id uuid,
    _total_amount decimal,
    _bank_code text DEFAULT NULL,
    _bank_branch text DEFAULT NULL,
    _bank_account text DEFAULT NULL, -- Raw account number to be encrypted
    _account_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Basic update for non-encrypted fields
    UPDATE public.claims
    SET 
        description = _description,
        payee_id = _payee_id,
        total_amount = _total_amount,
        bank_code = _bank_code,
        bank_branch = _bank_branch,
        account_name = _account_name,
        updated_at = now()
    WHERE id = _claim_id;

    -- Handle encrypted bank_account
    IF _bank_code IS NULL OR _bank_code = '' THEN
        -- If bank code is cleared, clear bank account too (disable floating account)
        UPDATE public.claims 
        SET bank_account = NULL 
        WHERE id = _claim_id;
    ELSIF _bank_account IS NOT NULL AND _bank_account <> '' AND _bank_account NOT LIKE '************%' THEN
        -- Only update if bank_account is provided and NOT masked (if frontend sends masked value for unchanged)
        -- Encrypt new value
        UPDATE public.claims
        SET bank_account = pgp_sym_encrypt(_bank_account, 'payment_system_secret_key')
        WHERE id = _claim_id;
    END IF;
    -- If _bank_account is NULL or empty string or masked, we KEEP existing value (do nothing w.r.t bank_account).
END;
$$;
