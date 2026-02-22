-- Remove unused deactivation reason from profiles.
ALTER TABLE public.profiles
    DROP COLUMN IF EXISTS deactivate_reason;
