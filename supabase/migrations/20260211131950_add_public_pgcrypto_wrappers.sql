-- Provide public-schema wrappers for pgcrypto so SECURITY DEFINER functions with
-- search_path=public can still use pgp_sym_encrypt/decrypt safely.

CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt(data text, psw text)
RETURNS bytea
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, extensions
AS $$
  SELECT extensions.pgp_sym_encrypt(data, psw);
$$;

CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt(data bytea, psw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, extensions
AS $$
  SELECT extensions.pgp_sym_decrypt(data, psw);
$$;
