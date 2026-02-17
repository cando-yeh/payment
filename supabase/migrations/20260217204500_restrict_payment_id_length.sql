-- Migration: Restrict Payment ID length to 8 characters
-- Description: Converts payments.id from UUID to varchar(8) and updates references.
-- Handles dependent RLS policies.
-- Created: 2026-02-17

DO $$
BEGIN
    -- 1. Add temporary columns to store the new 8-character IDs
    ALTER TABLE public.payments ADD COLUMN id_new VARCHAR(8);
    ALTER TABLE public.claims ADD COLUMN payment_id_new VARCHAR(8);

    -- 2. Populate new IDs for existing payments
    UPDATE public.payments SET id_new = generate_short_id();
    
    -- 3. Map the new IDs to the claims table
    UPDATE public.claims c
    SET payment_id_new = p.id_new
    FROM public.payments p
    WHERE c.payment_id = p.id;

    -- 4. Clean up old constraints and dependent policies
    ALTER TABLE public.claims DROP CONSTRAINT IF EXISTS claims_payment_id_fkey;
    DROP POLICY IF EXISTS payments_applicant ON public.payments;
    DROP POLICY IF EXISTS payments_approver_read ON public.payments;
    -- Re-dropping just in case names were slightly different in older migrations but listed in sys tables
    DROP POLICY IF EXISTS payments_applicant_read ON public.payments;

    -- 5. Drop Primary Key (CASCADE if necessary, though it should be handled by policy drops)
    ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_pkey CASCADE;

    -- 6. Swap columns
    ALTER TABLE public.claims DROP COLUMN payment_id;
    ALTER TABLE public.payments DROP COLUMN id;

    ALTER TABLE public.payments RENAME COLUMN id_new TO id;
    ALTER TABLE public.claims RENAME COLUMN payment_id_new TO payment_id;

    -- 7. Re-establish Primary and Foreign Keys
    ALTER TABLE public.payments ADD PRIMARY KEY (id);
    ALTER TABLE public.claims ADD CONSTRAINT claims_payment_id_fkey 
        FOREIGN KEY (payment_id) REFERENCES public.payments(id);
    
    -- 8. Set the default value for automatic generation
    ALTER TABLE public.payments ALTER COLUMN id SET DEFAULT generate_short_id();

    -- 9. Recreate RLS Policies
    CREATE POLICY "payments_applicant" ON public.payments 
        FOR SELECT USING (
            id IN (SELECT payment_id FROM public.claims WHERE applicant_id = auth.uid())
        );

    CREATE POLICY "payments_approver_read" ON public.payments 
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.claims 
                JOIN public.profiles ON public.profiles.id = public.claims.applicant_id
                WHERE public.claims.payment_id = public.payments.id 
                AND public.profiles.approver_id = auth.uid()
            )
        );

END $$;
