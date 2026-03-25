-- Clear Security Advisor INFO "RLS Enabled No Policy" by adding explicit deny policies.
-- These tables are internal and should not be directly accessible via PostgREST roles.

DO $$
BEGIN
    -- allowed_email_domains
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'allowed_email_domains'
          AND policyname = 'allowed_email_domains_no_direct_access'
    ) THEN
        CREATE POLICY allowed_email_domains_no_direct_access
            ON public.allowed_email_domains
            FOR ALL
            TO public
            USING (false)
            WITH CHECK (false);
    END IF;

    -- notification_event_types
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'notification_event_types'
          AND policyname = 'notification_event_types_no_direct_access'
    ) THEN
        CREATE POLICY notification_event_types_no_direct_access
            ON public.notification_event_types
            FOR ALL
            TO public
            USING (false)
            WITH CHECK (false);
    END IF;

    -- notification_event_template_map
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'notification_event_template_map'
          AND policyname = 'notification_event_template_map_no_direct_access'
    ) THEN
        CREATE POLICY notification_event_template_map_no_direct_access
            ON public.notification_event_template_map
            FOR ALL
            TO public
            USING (false)
            WITH CHECK (false);
    END IF;

    -- notification_jobs
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'notification_jobs'
          AND policyname = 'notification_jobs_no_direct_access'
    ) THEN
        CREATE POLICY notification_jobs_no_direct_access
            ON public.notification_jobs
            FOR ALL
            TO public
            USING (false)
            WITH CHECK (false);
    END IF;

    -- notification_logs
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'notification_logs'
          AND policyname = 'notification_logs_no_direct_access'
    ) THEN
        CREATE POLICY notification_logs_no_direct_access
            ON public.notification_logs
            FOR ALL
            TO public
            USING (false)
            WITH CHECK (false);
    END IF;
END;
$$;

