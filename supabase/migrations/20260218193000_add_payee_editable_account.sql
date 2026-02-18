ALTER TABLE public.payees
ADD COLUMN IF NOT EXISTS editable_account boolean NOT NULL DEFAULT false;

-- Backfill from historical extra_info payloads if present.
UPDATE public.payees
SET editable_account = CASE
    WHEN type <> 'vendor' THEN false
    WHEN lower(COALESCE(extra_info->>'editable_account', 'false')) IN ('true', 't', '1', 'yes', 'on') THEN true
    ELSE false
END;

CREATE OR REPLACE FUNCTION public.sync_payee_editable_account_from_extra_info()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.type <> 'vendor' THEN
        NEW.editable_account := false;
        RETURN NEW;
    END IF;

    IF NEW.extra_info IS NOT NULL AND NEW.extra_info ? 'editable_account' THEN
        NEW.editable_account := lower(COALESCE(NEW.extra_info->>'editable_account', 'false')) IN ('true', 't', '1', 'yes', 'on');
    ELSE
        NEW.editable_account := COALESCE(NEW.editable_account, false);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_payee_editable_account ON public.payees;
CREATE TRIGGER trg_sync_payee_editable_account
BEFORE INSERT OR UPDATE OF type, extra_info, editable_account
ON public.payees
FOR EACH ROW
EXECUTE FUNCTION public.sync_payee_editable_account_from_extra_info();
