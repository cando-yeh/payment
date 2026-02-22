-- Remove unused reject_reason from payee_change_requests.
ALTER TABLE public.payee_change_requests
    DROP COLUMN IF EXISTS reject_reason;
