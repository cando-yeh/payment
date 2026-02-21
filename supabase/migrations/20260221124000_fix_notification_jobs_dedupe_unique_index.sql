DROP INDEX IF EXISTS public.uq_notification_jobs_dedupe_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_jobs_dedupe_key
ON public.notification_jobs (channel, dedupe_key);
