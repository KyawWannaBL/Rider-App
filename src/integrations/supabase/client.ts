import { createClient } from '@supabase/supabase-js';

// In production route Rider Auth, REST, and Storage through the Rider domain.
// Browser deployments use their own origin, while native Capacitor WebViews
// (capacitor://localhost or http://localhost) use the public HTTPS hostname.
// This avoids requiring every Rider device to reach supabase.co directly.
// WebSocket/Realtime compatibility must be verified before production rollout.
const directSupabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  "https://dltavabvjwocknkyvwgz.supabase.co";
const riderProxyUrl = (
  (import.meta.env.VITE_RIDER_SUPABASE_PROXY_URL as string | undefined) ||
  "https://www.britiumexpress.app/supabase"
).replace(/\/+$/, "");
const isPublicWebOrigin =
  typeof window !== "undefined" &&
  (window.location.protocol === "https:" || window.location.protocol === "http:") &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1";
const SUPABASE_URL = import.meta.env.PROD
  ? (isPublicWebOrigin ? `${window.location.origin}/supabase` : riderProxyUrl)
  : directSupabaseUrl;

const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  "sb_publishable_CcgPNUZrnmSSZRx8EjgiEA_2Rud447o";

// Rider APK ships with the project's public Supabase URL + publishable key as a
// safe runtime fallback. These values are public client credentials; RLS/RPC
// authorization remains authoritative on the backend.
export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { "x-britium-data-epoch": "2026-11-01" } },
    })
  : null;

export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
