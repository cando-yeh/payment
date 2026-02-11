-- Allow finance users to read profiles needed by payment/approval screens.
-- This is SELECT-only and complements existing individual/approver/admin policies.

DROP POLICY IF EXISTS profiles_finance_read ON public.profiles;

CREATE POLICY profiles_finance_read
ON public.profiles
FOR SELECT
USING (is_finance());
