-- 1. Ensure claim_items has the necessary columns for attachments
ALTER TABLE public.claim_items 
ADD COLUMN IF NOT EXISTS extra jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS attachment_status text DEFAULT 'none';

-- 2. Create 'claims' storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('claims', 'claims', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies for 'claims' bucket
-- Allow authenticated users to upload/view/delete for now. 
-- Ideally we should restrict by owner, but since storage.objects doesn't easily link to claims table, 
-- we rely on application logic + basic auth check for MVP.

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can upload claims attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view claims attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own attachments" ON storage.objects;

-- Re-create policies
CREATE POLICY "Authenticated users can upload claims attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'claims' );

CREATE POLICY "Authenticated users can view claims attachments"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'claims' );

CREATE POLICY "Users can update own attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'claims' );

CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'claims' );
