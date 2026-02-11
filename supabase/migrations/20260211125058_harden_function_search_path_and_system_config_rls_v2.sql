-- Harden function search_path and add explicit RLS policies for system_config.

ALTER FUNCTION public.approve_payee_change_request(uuid)
    SET search_path = public;
ALTER FUNCTION public.handle_new_user()
    SET search_path = public;
ALTER FUNCTION public.reject_payee_change_request(uuid)
    SET search_path = public;
ALTER FUNCTION public.reveal_payee_bank_account(uuid)
    SET search_path = public;
ALTER FUNCTION public.reveal_payee_tax_id(uuid)
    SET search_path = public;
ALTER FUNCTION public.submit_payee_change_request(text, uuid, jsonb, text, text, text, jsonb)
    SET search_path = public;
ALTER FUNCTION public.generate_short_id()
    SET search_path = public;
ALTER FUNCTION public.log_claim_status_change()
    SET search_path = public;
ALTER FUNCTION public.is_admin()
    SET search_path = public;
ALTER FUNCTION public.is_finance()
    SET search_path = public;

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_config_admin_all ON public.system_config;

CREATE POLICY system_config_admin_all
ON public.system_config
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
