import { supabase } from "@/integrations/supabase/client";

/** Overlay authenticated Enterprise identity; retain operational worker assignments and role. */
export async function enterpriseProfileOverlay(snapshot: any): Promise<any> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user?.id) return snapshot;
  const { data, error } = await (supabase as any).rpc("be_my_unified_workforce_profile_v1");
  if (error || !data?.ok || String(data.auth_user_id || "") !== auth.user.id) return snapshot;
  const canonical = { ...(snapshot?.canonical || {}) };
  if (typeof data.full_name === "string" && data.full_name.trim()) canonical.display_name = data.full_name.trim();
  if (typeof data.email === "string" && data.email.trim()) canonical.email = data.email.trim();
  if (typeof data.branch_code === "string" && data.branch_code.trim()) canonical.branch_code = data.branch_code.trim();
  // Enterprise role is informational. Operational role and worker-code stay in the mobile snapshot.
  return { ...snapshot, canonical, enterprise_identity: data };
}
