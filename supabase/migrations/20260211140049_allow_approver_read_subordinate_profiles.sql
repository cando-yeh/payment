-- Allow approvers to read subordinate profile rows.
-- Needed for claims approver RLS predicates that reference profiles.approver_id.

DROP POLICY IF EXISTS profiles_approver_read ON public.profiles;

CREATE POLICY profiles_approver_read
ON public.profiles FOR SELECT
USING (approver_id = auth.uid());
