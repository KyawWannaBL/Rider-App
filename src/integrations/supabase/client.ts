import { createClient } from '@supabase/supabase-js';

// Separate Rider UAT project must never use a production fallback. Configure
// both values from an isolated UAT Supabase project in Vercel before testing.
const isRiderUat = import.meta.env.VITE_UAT_MODE === 'true';
const configuredUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const configuredKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';
const SUPABASE_URL = configuredUrl || (isRiderUat ? '' : 'https://dltavabvjwocknkyvwgz.supabase.co');
const SUPABASE_ANON_KEY = configuredKey || (isRiderUat ? '' : "https://dltavabvjwocknkyvwgz.supabase.co");
if (isRiderUat && (!configuredUrl || !configuredKey)) {
  console.warn('[Britium Rider UAT] Isolated Supabase URL/key not configured; authentication is disabled to protect production data.');
}

// Rider APK ships with the project's public Supabase URL + publishable key as a
// safe runtime fallback. These values are public client credentials; RLS/RPC
// authorization remains authoritative on the backend.
export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { "x-britium-data-epoch": "2026-11-01" } },
    })
  : null;

export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
