import { supabase } from "@/integrations/supabase/client";

export async function loadRiderBranchSnapshot(riderCode: string) {
  const { data, error } = await supabase.rpc("be_rider_branch_snapshot", {
    p_payload: {
      rider_code: riderCode,
    },
  } as any);

  if (error) {
    throw error;
  }

  return data;
}
