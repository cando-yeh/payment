-- 1) Event master for notifications/templates.
CREATE TABLE IF NOT EXISTS public.notification_event_types (
    event_code text PRIMARY KEY,
    name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.notification_event_types (event_code, name, is_active)
VALUES
    ('submit', '送出審核', true),
    ('withdraw', '撤回草稿', true),
    ('approve_manager', '主管核准', true),
    ('reject_manager', '主管駁回', true),
    ('approve_finance', '財務核准', true),
    ('reject_finance', '財務駁回', true),
    ('reject_payment', '退回財審', true),
    ('pay_completed', '完成撥款', true),
    ('pay_completed_need_doc', '完成撥款（需補件）', true),
    ('supplement_submitted', '補件送審', true),
    ('supplement_approved', '補件核准', true),
    ('supplement_rejected', '補件駁回', true),
    ('cancelled', '撤銷申請', true),
    ('payment_reversed', '撤銷撥款', true)
ON CONFLICT (event_code) DO UPDATE
SET
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- 2) Status normalization: returned -> rejected.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'claim_status'
    ) THEN
        IF EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public' AND t.typname = 'claim_status' AND e.enumlabel = 'returned'
        )
        AND NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public' AND t.typname = 'claim_status' AND e.enumlabel = 'rejected'
        ) THEN
            EXECUTE 'ALTER TYPE public.claim_status RENAME VALUE ''returned'' TO ''rejected''';
        END IF;
    END IF;
END;
$$;

UPDATE public.claims
SET status = 'rejected'
WHERE status::text = 'returned';

UPDATE public.claim_history
SET from_status = 'rejected'
WHERE from_status::text = 'returned';

UPDATE public.claim_history
SET to_status = 'rejected'
WHERE to_status::text = 'returned';

-- 3) Ensure specialized action labels exist when action is enum-backed.
DO $$
DECLARE
    _label text;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'claim_action'
    ) THEN
        FOREACH _label IN ARRAY ARRAY[
            'approve_manager',
            'reject_manager',
            'approve_finance',
            'reject_finance',
            'reject_payment',
            'pay_completed',
            'pay_completed_need_doc',
            'supplement_submitted',
            'supplement_approved',
            'supplement_rejected',
            'cancelled',
            'payment_reversed'
        ]
        LOOP
            IF NOT EXISTS (
                SELECT 1
                FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname = 'public' AND t.typname = 'claim_action' AND e.enumlabel = _label
            ) THEN
                EXECUTE format('ALTER TYPE public.claim_action ADD VALUE %L', _label);
            END IF;
        END LOOP;
    END IF;
END;
$$;

-- 4) Backfill history action to specialized event codes.
UPDATE public.claim_history
SET action = CASE
    WHEN action = 'submit' THEN 'submit'
    WHEN action = 'withdraw' THEN 'withdraw'
    WHEN action = 'cancel' THEN 'cancelled'
    WHEN action = 'cancelled' THEN 'cancelled'

    WHEN from_status = 'pending_manager' AND to_status = 'pending_finance' THEN 'approve_manager'
    WHEN from_status = 'pending_manager' AND to_status = 'rejected' THEN 'reject_manager'

    WHEN from_status = 'pending_finance' AND to_status = 'pending_payment' THEN 'approve_finance'
    WHEN from_status = 'pending_finance' AND to_status = 'rejected' THEN 'reject_finance'

    WHEN from_status = 'pending_payment' AND to_status = 'pending_finance' THEN 'reject_payment'
    WHEN from_status = 'pending_payment' AND to_status = 'paid' THEN 'pay_completed'
    WHEN from_status = 'pending_payment' AND to_status = 'paid_pending_doc' THEN 'pay_completed_need_doc'

    WHEN from_status = 'paid_pending_doc' AND to_status = 'pending_doc_review' THEN 'supplement_submitted'
    WHEN from_status = 'pending_doc_review' AND to_status = 'paid' THEN 'supplement_approved'
    WHEN from_status = 'pending_doc_review' AND to_status = 'paid_pending_doc' THEN 'supplement_rejected'

    WHEN from_status = 'paid' AND to_status = 'pending_payment' THEN 'payment_reversed'
    ELSE action
END;

-- Keep trigger behavior consistent with specialized actions.
CREATE OR REPLACE FUNCTION public.log_claim_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO claim_history (
            claim_id,
            actor_id,
            action,
            from_status,
            to_status,
            comment,
            created_at
        ) VALUES (
            NEW.id,
            auth.uid(),
            CASE
                WHEN NEW.status = 'pending_manager' AND OLD.status IN ('draft', 'rejected') THEN 'submit'
                WHEN NEW.status = 'pending_finance' AND OLD.status = 'pending_manager' THEN 'approve_manager'
                WHEN NEW.status = 'pending_payment' AND OLD.status = 'pending_finance' THEN 'approve_finance'
                WHEN NEW.status = 'rejected' AND OLD.status = 'pending_manager' THEN 'reject_manager'
                WHEN NEW.status = 'rejected' AND OLD.status = 'pending_finance' THEN 'reject_finance'
                WHEN NEW.status = 'paid' AND OLD.status = 'pending_doc_review' THEN 'supplement_approved'
                WHEN NEW.status = 'paid_pending_doc' AND OLD.status = 'pending_doc_review' THEN 'supplement_rejected'
                WHEN NEW.status = 'pending_doc_review' AND OLD.status = 'paid_pending_doc' THEN 'supplement_submitted'
                WHEN OLD.status = 'pending_payment' AND NEW.status = 'paid' THEN 'pay_completed'
                WHEN OLD.status = 'pending_payment' AND NEW.status = 'paid_pending_doc' THEN 'pay_completed_need_doc'
                WHEN NEW.status = 'pending_finance' AND OLD.status = 'pending_payment' THEN 'reject_payment'
                WHEN NEW.status = 'cancelled' THEN 'cancelled'
                WHEN NEW.status = 'pending_payment' AND OLD.status = 'paid' THEN 'payment_reversed'
                WHEN NEW.status = 'draft' AND OLD.status IN ('pending_manager', 'pending_finance') THEN 'withdraw'
                ELSE 'status_change'
            END,
            OLD.status,
            NEW.status,
            NEW.last_comment,
            now()
        );

        NEW.last_comment := NULL;
    END IF;

    RETURN NEW;
END;
$function$;
