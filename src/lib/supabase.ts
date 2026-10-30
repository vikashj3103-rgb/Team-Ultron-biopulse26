import { createClient } from '@supabase/supabase-js';

const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
const configuredUrl = env?.VITE_SUPABASE_URL?.trim();
const configuredAnonKey = env?.VITE_SUPABASE_ANON_KEY?.trim();
const supabaseUrl = configuredUrl || 'http://127.0.0.1:54321';
const supabaseAnonKey = configuredAnonKey || 'local-supabase-not-configured';

export const isSupabaseConfigured = (): boolean => {
  const localDevelopmentUrl = Boolean(env?.DEV && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(supabaseUrl));
  return (
    Boolean(configuredUrl && configuredAnonKey) &&
    (supabaseUrl.startsWith('https://') || localDevelopmentUrl) &&
    supabaseAnonKey.length > 20 &&
    !/placeholder|not-configured|your-project|example|your-anon-key/i.test(`${supabaseUrl} ${supabaseAnonKey}`)
  );
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
