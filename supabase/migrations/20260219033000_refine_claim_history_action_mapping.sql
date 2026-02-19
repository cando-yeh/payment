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
                WHEN NEW.status = 'pending_manager' AND OLD.status IN ('draft', 'returned') THEN 'submit'
                WHEN NEW.status = 'pending_finance' AND OLD.status = 'pending_manager' THEN 'approve'
                WHEN NEW.status = 'pending_payment' AND OLD.status = 'pending_finance' THEN 'approve'
                WHEN NEW.status = 'paid' AND OLD.status = 'pending_doc_review' THEN 'approve'
                WHEN OLD.status = 'pending_payment' AND NEW.status IN ('paid', 'paid_pending_doc') THEN 'pay'
                WHEN NEW.status = 'returned' THEN 'reject'
                WHEN NEW.status = 'cancelled' THEN 'cancel'
                WHEN NEW.status = 'draft' AND OLD.status = 'pending_manager' THEN 'withdraw'
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
