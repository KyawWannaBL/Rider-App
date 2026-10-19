import { supabase } from "@/integrations/supabase/client";

/** Overlay authenticated Enterprise identity; retain operational worker assignments and role. */
export async function enterpriseProfileOverlay(snapshot: any): Promise<any> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user?.id) return snapshot;
  const { data, error } = await (supabase as any).rpc("be_my_unified_workforce_profile_v1");
  if (error || !data?.ok || String(data.auth_user_id || "") !== auth.user.id) return snapshot;
  const canonical = { ...(snapshot?.canonical || {}) };
  const name = [data.full_name, snapshot?.canonical?.display_name, snapshot?.workforce?.full_name, snapshot?.workforce?.display_name, snapshot?.identity?.display_name].find((v) => typeof v === "string" && v.trim() && v.trim() !== "-");
  if (name) canonical.display_name = name.trim();
  if (typeof data.email === "string" && data.email.trim()) canonical.email = data.email.trim();
  if (typeof data.branch_code === "string" && data.branch_code.trim()) canonical.branch_code = data.branch_code.trim();
  // Enterprise role is informational. Operational role and worker-code stay in the mobile snapshot.
  return { ...(snapshot || {}), canonical, enterprise_identity: data };
}
