import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  "https://dltavabvjwocknkyvwgz.supabase.co";

const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  "sb_publishable_CcgPNUZrnmSSZRx8EjgiEA_2Rud447o";

// Rider APK ships with the project's public Supabase URL + publishable key as a
// safe runtime fallback. These values are public client credentials; RLS/RPC
// authorization remains authoritative on the backend.
export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
