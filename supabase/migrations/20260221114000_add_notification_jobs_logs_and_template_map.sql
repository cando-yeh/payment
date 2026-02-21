-- 5) Notification delivery data structures.
-- Event -> template mapping (channel-aware, starting with email).
CREATE TABLE IF NOT EXISTS public.notification_event_template_map (
    event_code text NOT NULL REFERENCES public.notification_event_types(event_code) ON UPDATE CASCADE ON DELETE CASCADE,
    channel text NOT NULL DEFAULT 'email',
    template_key text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (event_code, channel)
);

CREATE TABLE IF NOT EXISTS public.notification_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_code text NOT NULL REFERENCES public.notification_event_types(event_code) ON UPDATE CASCADE,
    channel text NOT NULL DEFAULT 'email',
    template_key text,
    claim_id text REFERENCES public.claims(id) ON UPDATE CASCADE ON DELETE SET NULL,
    actor_id uuid REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    recipient_user_id uuid REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    recipient_email text,
    cc_emails text[] NOT NULL DEFAULT '{}',
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'sent', 'failed', 'cancelled')),
    attempts integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 3,
    dedupe_key text,
    scheduled_at timestamptz NOT NULL DEFAULT now(),
    processing_started_at timestamptz,
    sent_at timestamptz,
    failed_at timestamptz,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT notification_jobs_template_fk
        FOREIGN KEY (event_code, channel)
        REFERENCES public.notification_event_template_map(event_code, channel)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.notification_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid REFERENCES public.notification_jobs(id) ON UPDATE CASCADE ON DELETE SET NULL,
    event_code text NOT NULL REFERENCES public.notification_event_types(event_code) ON UPDATE CASCADE,
    channel text NOT NULL DEFAULT 'email',
    template_key text,
    claim_id text REFERENCES public.claims(id) ON UPDATE CASCADE ON DELETE SET NULL,
    recipient_user_id uuid REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    recipient_email text,
    cc_emails text[] NOT NULL DEFAULT '{}',
    status text NOT NULL CHECK (status IN ('sent', 'failed', 'cancelled')),
    provider text,
    provider_message_id text,
    response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_jobs_dedupe_key
ON public.notification_jobs (channel, dedupe_key);

CREATE INDEX IF NOT EXISTS idx_notification_jobs_queue_pick
ON public.notification_jobs (status, scheduled_at, created_at)
WHERE status IN ('queued', 'processing');

CREATE INDEX IF NOT EXISTS idx_notification_jobs_claim
ON public.notification_jobs (claim_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_logs_claim
ON public.notification_logs (claim_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_logs_job
ON public.notification_logs (job_id, created_at DESC);

ALTER TABLE public.notification_event_template_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- 6) Fixed event -> template mapping for email channel.
INSERT INTO public.notification_event_template_map (event_code, channel, template_key, is_active)
VALUES
    ('submit', 'email', 'claim.submit', true),
    ('withdraw', 'email', 'claim.withdraw', true),
    ('approve_manager', 'email', 'claim.approve_manager', true),
    ('reject_manager', 'email', 'claim.reject_manager', true),
    ('approve_finance', 'email', 'claim.approve_finance', true),
    ('reject_finance', 'email', 'claim.reject_finance', true),
    ('reject_payment', 'email', 'claim.reject_payment', true),
    ('pay_completed', 'email', 'claim.pay_completed', true),
    ('pay_completed_need_doc', 'email', 'claim.pay_completed_need_doc', true),
    ('supplement_submitted', 'email', 'claim.supplement_submitted', true),
    ('supplement_approved', 'email', 'claim.supplement_approved', true),
    ('supplement_rejected', 'email', 'claim.supplement_rejected', true),
    ('cancelled', 'email', 'claim.cancelled', true),
    ('payment_reversed', 'email', 'claim.payment_reversed', true)
ON CONFLICT (event_code, channel) DO UPDATE
SET
    template_key = EXCLUDED.template_key,
    is_active = EXCLUDED.is_active,
    updated_at = now();
