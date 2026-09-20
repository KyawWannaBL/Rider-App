import { useEffect, useState, useCallback } from "react";
import type { CodRecord, EarningsRecord, Job, UserRole } from "@/lib/index";
import { fetchMobileAssignments, updateMobileJobStatus } from "@/lib/riderEnterpriseApi";
import { supabase } from "@/integrations/supabase/client";
import { useAppState } from "@/hooks/useAppState";

interface RiderDriverData {
  jobs: Job[];
  codRecords: CodRecord[];
  earnings: EarningsRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  handoverCod: (id: string) => Promise<void>;
  updateJobStatus: (trackingNumber: string, status: string) => Promise<void>;
}

export function useRiderDriverData(_userId?: string): RiderDriverData {
  const { activeRole, currentUser } = useAppState();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [codRecords, setCodRecords] = useState<CodRecord[]>([]);
  const [earnings, setEarnings] = useState<EarningsRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const role = (activeRole || currentUser?.role || "rider") as UserRole;
      const result = await fetchMobileAssignments({
        role,
        limit: 100,
      });

      setJobs(result.jobs);
      setCodRecords(result.codRecords);
      setEarnings(result.earnings);
    } catch (e: unknown) {
      setJobs([]);
      setCodRecords([]);
      setEarnings([]);
      setError(e instanceof Error ? e.message : "Failed to load backend assignments");
    } finally {
      setLoading(false);
    }
  }, [activeRole, currentUser?.role]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handoverCod = async (id: string) => {
    const rec = codRecords.find((x) => x.id === id);
    if (!rec) return;

    const { data, error } = await (supabase as any).rpc("be_rider_submit_cod_settlement", {
      p_delivery_way_id: rec.trackingNumber,
      p_cod_amount: rec.amount,
      p_remark: "Submitted from shared mobile COD panel",
    });
    if (error || data?.ok === false) throw new Error(error?.message || data?.error || "COD settlement failed.");

    await fetchData();
  };

  const updateJobStatus = async (trackingNumber: string, status: string) => {
    if (["delivered","failed","rto","in_transit","picked_up"].includes(String(status).toLowerCase())) {
      window.location.hash = `/delivery?deliveryWayId=${encodeURIComponent(trackingNumber)}`;
      return;
    }
    await updateMobileJobStatus(trackingNumber, status, { action: "mobile_status_update" });
    await fetchData();
  };

  return {
    jobs,
    codRecords,
    earnings,
    loading,
    error,
    refresh: fetchData,
    handoverCod,
    updateJobStatus,
  };
}
