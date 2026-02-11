-- Create RPC for creating claims with Floating Account encryption support
-- This allows us to use pgp_sym_encrypt for the bank_account field within a transaction.

CREATE OR REPLACE FUNCTION public.create_claim(
    _claim_type text,
    _description text,
    _applicant_id uuid,
    _payee_id uuid,
    _total_amount decimal,
    _bank_code text DEFAULT NULL,
    _bank_branch text DEFAULT NULL,
    _bank_account text DEFAULT NULL, -- Raw account number to be encrypted
    _account_name text DEFAULT NULL
)
RETURNS varchar(8) -- Returns the generated Claim ID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _claim_id varchar(8);
BEGIN
    -- Generate Random 8-char ID (Uppercase Alphanumeric)
    -- Loop to ensure uniqueness (though collision is rare with 8 chars ~ 2 trillion combinations)
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
        bank_branch,
        bank_account,
        account_name
    ) VALUES (
        _claim_id,
        _claim_type::claim_type_enum, -- Cast to enum
        _description,
        _applicant_id,
        _payee_id,
        _total_amount,
        'draft',
        now(),
        now(),
        _bank_code,
        _bank_branch,
        CASE 
            WHEN _bank_account IS NOT NULL AND _bank_account != '' 
            THEN pgp_sym_encrypt(_bank_account, 'payment_system_secret_key')
            ELSE NULL 
        END,
        _account_name
    );

    RETURN _claim_id;
END;
$$;
