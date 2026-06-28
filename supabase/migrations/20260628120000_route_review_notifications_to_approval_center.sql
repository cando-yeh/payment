-- 通知 e-mail 連結改善：
-- 送給審核者（待主管 / 待財務 / 待撥款 / 補件審核）的通知，連結改為導向「審核中心」對應頁籤，
-- 讓主管 / 財務可直接在列表逐列核准，不必先進單據明細頁。
-- 送給申請人的通知（退件、撥款完成、撤回、取消等）維持導向該請款單明細頁 /claims/<id>。
--
-- 判斷依據：to_status。所有送給申請人的事件其 to_status 皆非 pending_*（rejected / paid / draft / cancelled / paid_pending_doc），
-- 因此用 to_status 即可乾淨分流，不需逐事件特例。

CREATE OR REPLACE FUNCTION public.enqueue_claim_notification_jobs(
    p_history_id uuid,
    p_claim_id text,
    p_event_code text,
    p_actor_id uuid,
    p_from_status public.claim_status,
    p_to_status public.claim_status,
    p_reason text,
    p_happened_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_claim record;
    v_actor_name text;
    v_actor_email text;
    v_link_path text;
BEGIN
    IF p_event_code IS NULL OR p_event_code = 'status_change' THEN
        RETURN;
    END IF;

    SELECT
        c.id,
        c.claim_type,
        c.total_amount,
        c.applicant_id,
        c.payee_id,
        c.created_at,
        c.updated_at,
        ap.full_name AS applicant_name,
        ap.email AS applicant_email,
        ap.approver_id,
        av.full_name AS approver_name,
        av.email AS approver_email,
        py.name AS payee_name
    INTO v_claim
    FROM public.claims c
    LEFT JOIN public.profiles ap ON ap.id = c.applicant_id
    LEFT JOIN public.profiles av ON av.id = ap.approver_id
    LEFT JOIN public.payees py ON py.id = c.payee_id
    WHERE c.id = p_claim_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT p.full_name, p.email
    INTO v_actor_name, v_actor_email
    FROM public.profiles p
    WHERE p.id = p_actor_id;

    -- 依目標狀態決定連結：審核者導向審核中心對應頁籤，其餘導向單據明細。
    v_link_path := CASE p_to_status
        WHEN 'pending_manager' THEN '/approval?tab=manager'
        WHEN 'pending_finance' THEN '/approval?tab=finance'
        WHEN 'pending_payment' THEN '/approval?tab=payment'
        WHEN 'pending_doc_review' THEN '/approval?tab=doc'
        ELSE '/claims/' || v_claim.id
    END;

    WITH finance_recipients AS (
        SELECT p.id AS user_id, p.email, p.full_name
        FROM public.profiles p
        WHERE p.is_finance = true
          AND p.is_active = true
          AND p.email IS NOT NULL
    ),
    recipients AS (
        -- submit -> approver
        SELECT v_claim.approver_id AS user_id, v_claim.approver_email AS email, v_claim.approver_name AS full_name
        WHERE p_event_code = 'submit'

        UNION ALL
        -- approver/finance style notifications to applicant
        SELECT v_claim.applicant_id, v_claim.applicant_email, v_claim.applicant_name
        WHERE p_event_code IN (
            'withdraw',
            'reject_manager',
            'reject_finance',
            'pay_completed',
            'pay_completed_need_doc',
            'supplement_approved',
            'supplement_rejected',
            'cancelled'
        )

        UNION ALL
        -- events sent to finance group
        SELECT f.user_id, f.email, f.full_name
        FROM finance_recipients f
        WHERE p_event_code IN (
            'approve_manager',
            'approve_finance',
            'supplement_submitted',
            'reject_payment',
            'payment_reversed'
        )
    ),
    to_insert AS (
        SELECT
            r.user_id,
            r.email,
            COALESCE(r.full_name, '') AS full_name
        FROM recipients r
        WHERE r.user_id IS NOT NULL
          AND r.email IS NOT NULL
    )
    INSERT INTO public.notification_jobs (
        event_code,
        channel,
        template_key,
        claim_id,
        actor_id,
        recipient_user_id,
        recipient_email,
        cc_emails,
        payload,
        status,
        attempts,
        max_attempts,
        dedupe_key,
        scheduled_at
    )
    SELECT
        p_event_code,
        'email',
        m.template_key,
        v_claim.id,
        p_actor_id,
        t.user_id,
        t.email,
        CASE
            WHEN p_event_code = 'submit' AND v_claim.applicant_email IS NOT NULL AND v_claim.applicant_email <> t.email
                THEN ARRAY[v_claim.applicant_email]
            WHEN p_event_code IN ('approve_manager', 'approve_finance', 'supplement_submitted')
                AND v_claim.applicant_email IS NOT NULL
                THEN ARRAY[v_claim.applicant_email]
            ELSE ARRAY[]::text[]
        END AS cc_emails,
        jsonb_build_object(
            'history_id', p_history_id,
            'event_code', p_event_code,
            'claim_id', v_claim.id,
            'claim_type', v_claim.claim_type,
            'from_status', p_from_status::text,
            'to_status', p_to_status::text,
            'actor_id', p_actor_id,
            'actor_name', COALESCE(v_actor_name, ''),
            'actor_email', COALESCE(v_actor_email, ''),
            'applicant_id', v_claim.applicant_id,
            'applicant_name', COALESCE(v_claim.applicant_name, ''),
            'applicant_email', COALESCE(v_claim.applicant_email, ''),
            'approver_id', v_claim.approver_id,
            'approver_name', COALESCE(v_claim.approver_name, ''),
            'approver_email', COALESCE(v_claim.approver_email, ''),
            'payee_id', v_claim.payee_id,
            'payee_name', COALESCE(v_claim.payee_name, ''),
            'total_amount', v_claim.total_amount,
            'reason', COALESCE(p_reason, ''),
            'claim_link_path', v_link_path,
            'recipient_name', t.full_name,
            'recipient_email', t.email,
            'happened_at', COALESCE(p_happened_at, now())
        ),
        'queued',
        0,
        3,
        concat_ws(':', 'claim-event', p_history_id::text, t.user_id::text, p_event_code, 'email'),
        now()
    FROM to_insert t
    JOIN public.notification_event_template_map m
      ON m.event_code = p_event_code
     AND m.channel = 'email'
     AND m.is_active = true
    ON CONFLICT (channel, dedupe_key) DO NOTHING;
END;
$function$;
