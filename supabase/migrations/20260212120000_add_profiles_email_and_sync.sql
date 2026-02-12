-- Add email to profiles and keep it in sync with auth.users.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email text;

-- Backfill existing profile emails from auth users.
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND p.email IS DISTINCT FROM u.email;

-- Keep uniqueness for non-null emails.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx
ON public.profiles (email)
WHERE email IS NOT NULL;

-- Ensure new signups store email in profiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email, is_admin, is_finance)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Unknown User'),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email,
    false,
    false
  );

  RETURN NEW;
END;
$$;

-- Sync profile email if auth email changes.
CREATE OR REPLACE FUNCTION public.sync_profile_email_from_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id
    AND email IS DISTINCT FROM NEW.email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_email_from_auth_user();
