import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const hasEnv = supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://your-project.supabase.co';

if (!hasEnv) {
  console.warn(
    '[RemiDe] Missing or placeholder VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and set real values. Auth and data will not work until then.'
  );
}

// Use placeholders when missing so the app still mounts (avoids white screen); auth will fail until .env.local is set
const url = hasEnv ? supabaseUrl : 'https://placeholder.supabase.co';
const key = hasEnv ? supabaseAnonKey : 'placeholder-anon-key';

export const supabase: SupabaseClient = createClient(url, key);
