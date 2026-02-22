BEGIN;

-- Recreate enum to remove legacy label "cancelled" and rename it to "reversed"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'payment_status'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE n.nspname = 'public' AND t.typname = 'payment_status' AND e.enumlabel = 'cancelled'
    ) THEN
      CREATE TYPE public.payment_status_new AS ENUM ('completed', 'reversed');

      ALTER TABLE public.payments
      ALTER COLUMN status DROP DEFAULT;

      ALTER TABLE public.payments
      ALTER COLUMN status TYPE public.payment_status_new
      USING (
        CASE
          WHEN status::text = 'cancelled' THEN 'reversed'
          ELSE status::text
        END
      )::public.payment_status_new;

      DROP TYPE public.payment_status;
      ALTER TYPE public.payment_status_new RENAME TO payment_status;

      ALTER TABLE public.payments
      ALTER COLUMN status SET DEFAULT 'completed'::public.payment_status;
    END IF;
  END IF;
END
$$;

COMMIT;
