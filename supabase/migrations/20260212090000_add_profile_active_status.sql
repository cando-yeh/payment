-- Add lifecycle flags to support deactivate/reactivate user management.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS deactivate_reason text;

CREATE INDEX IF NOT EXISTS profiles_is_active_idx ON public.profiles(is_active);
