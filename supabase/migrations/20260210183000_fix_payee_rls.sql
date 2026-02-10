-- Fix RLS policies for payee_change_requests to allow Finance users to view all requests

DROP POLICY IF EXISTS payee_change_select_own ON public.payee_change_requests;

CREATE POLICY payee_change_select ON public.payee_change_requests
  FOR SELECT USING (
    requested_by = auth.uid() OR public.is_finance()
  );
