-- Ensure pgcrypto is available for pgp_sym_encrypt/pgp_sym_decrypt used by RPCs.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
