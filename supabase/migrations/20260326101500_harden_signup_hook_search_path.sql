-- Security Advisor warning fix:
-- Function Search Path Mutable on public.hook_restrict_signup_by_email_domain

DO $$
DECLARE
    fn record;
BEGIN
    FOR fn IN
        SELECT p.oid::regprocedure AS fn_signature
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'hook_restrict_signup_by_email_domain'
    LOOP
        EXECUTE format(
            'ALTER FUNCTION %s SET search_path = public, pg_catalog',
            fn.fn_signature
        );
    END LOOP;
END;
$$;

