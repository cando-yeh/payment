
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS deactivate_reason text;

CREATE INDEX IF NOT EXISTS profiles_is_active_idx ON public.profiles(is_active);
`;

async function applyMigration() {
    console.log('Applying migration to add is_active column...');

    // Note: supabase-js doesn't have a direct "execute raw sql" method for security reasons
    // unless you use an RPC. However, for a one-off schema change on a remote DB,
    // usually we'd use the CLI. 
    // Since I'm in a pinch, I will check if there's a postgres-mcp or if I can use npx supabase.

    console.log('Environment check complete.');
}

applyMigration();
