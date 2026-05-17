import { useEffect, useState, useCallback } from "react";
import type { CodRecord, EarningsRecord, Job, UserRole } from "@/lib/index";
import { fetchMobileAssignments, updateMobileJobStatus } from "@/lib/riderEnterpriseApi";
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

    await updateMobileJobStatus(rec.trackingNumber, "cod_handed_over", {
      cod_record_id: id,
      action: "cod_handed_over",
    });

    await fetchData();
  };

  const updateJobStatus = async (trackingNumber: string, status: string) => {
    await updateMobileJobStatus(trackingNumber, status, {
      action: "mobile_status_update",
    });

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
