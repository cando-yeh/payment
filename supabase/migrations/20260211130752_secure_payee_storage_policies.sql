-- Tighten payee attachment storage access to prevent broad authenticated reads.
-- Keep upload policy as-is for request submission, but restrict read/update/delete by owner or finance/admin.

DROP POLICY IF EXISTS "Authenticated users can view payee attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own attachments" ON storage.objects;
DROP POLICY IF EXISTS "payee attachments select restricted" ON storage.objects;
DROP POLICY IF EXISTS "payee attachments update restricted" ON storage.objects;
DROP POLICY IF EXISTS "payee attachments delete restricted" ON storage.objects;

CREATE POLICY "payee attachments select restricted"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'payees'
    AND (
        owner = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (p.is_finance = true OR p.is_admin = true)
        )
    )
);

CREATE POLICY "payee attachments update restricted"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'payees'
    AND (
        owner = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (p.is_finance = true OR p.is_admin = true)
        )
    )
)
WITH CHECK (
    bucket_id = 'payees'
);

CREATE POLICY "payee attachments delete restricted"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'payees'
    AND (
        owner = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (p.is_finance = true OR p.is_admin = true)
        )
    )
);
