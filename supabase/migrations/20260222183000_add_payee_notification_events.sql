INSERT INTO public.notification_event_types (event_code, name, is_active)
VALUES
    ('payee_create_submitted', '收款人新增申請', true),
    ('payee_update_submitted', '收款人變更申請', true),
    ('payee_disable_submitted', '收款人停用申請', true),
    ('payee_request_withdrawn', '收款人申請撤回', true),
    ('payee_request_approved', '收款人申請核准', true),
    ('payee_request_rejected', '收款人申請駁回', true)
ON CONFLICT (event_code) DO UPDATE
SET
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    updated_at = now();

INSERT INTO public.notification_event_template_map (event_code, channel, template_key, is_active)
VALUES
    ('payee_create_submitted', 'email', 'payee.create_submitted', true),
    ('payee_update_submitted', 'email', 'payee.update_submitted', true),
    ('payee_disable_submitted', 'email', 'payee.disable_submitted', true),
    ('payee_request_withdrawn', 'email', 'payee.request_withdrawn', true),
    ('payee_request_approved', 'email', 'payee.request_approved', true),
    ('payee_request_rejected', 'email', 'payee.request_rejected', true)
ON CONFLICT (event_code, channel) DO UPDATE
SET
    template_key = EXCLUDED.template_key,
    is_active = EXCLUDED.is_active,
    updated_at = now();
