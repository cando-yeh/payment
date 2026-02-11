-- Drop the old signature of submit_payee_change_request
-- The new signature has an additional argument: _proposed_attachments jsonb
DROP FUNCTION IF EXISTS public.submit_payee_change_request(text, uuid, jsonb, text, text, text);
