import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const disableRemoteData = import.meta.env.VITE_DISABLE_REMOTE_DATA === 'true';

const hasEnv = supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://your-project.supabase.co';

if (!hasEnv) {
  console.warn(
    '[RemiDe] Missing or placeholder VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and set real values. Auth and data will not work until then.'
  );
}

export const isSupabaseConfigured = Boolean(hasEnv);
export const isBackendEnabled = Boolean(hasEnv) && !disableRemoteData;

export const backendUnavailableReason = disableRemoteData
  ? 'Remote data is disabled for this local preview.'
  : 'Missing or placeholder VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.';

const enabledClient = createClient(
  supabaseUrl ?? 'http://127.0.0.1',
  supabaseAnonKey ?? 'preview-anon-key',
);

const disabledClient = new Proxy({} as typeof enabledClient, {
  get() {
    throw new Error(backendUnavailableReason);
  },
});

export const supabase: typeof enabledClient = isBackendEnabled
  ? enabledClient
  : disabledClient;
