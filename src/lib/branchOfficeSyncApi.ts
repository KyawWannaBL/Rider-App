import { supabase } from "@/integrations/supabase/client";

export async function loadRiderBranchSnapshot() {
  const { data, error } = await (supabase as any).rpc("be_rider_branch_snapshot");
  if (error) throw error;
  return data;
}
