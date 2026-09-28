import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useRiderRealtime({
  riderId,
  onWaybillChange,
  onSettlementChange,
  onNotification,
}: {
  riderId?: string;
  onWaybillChange?: () => void;
  onSettlementChange?: () => void;
  onNotification?: (payload: any) => void;
}) {
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`rider-live:${riderId || "current"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "be_wayplan_dispatch_stops" },
        (payload) => {
          const row = (payload as any)?.new || (payload as any)?.old || {};
          if (!riderId || !row.rider_code || String(row.rider_code).toUpperCase() === riderId.toUpperCase()) {
            onWaybillChange?.();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "be_finance_cod_settlements_v48" },
        () => onSettlementChange?.(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "be_app_notifications" },
        (payload) => onNotification?.((payload as any)?.new),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [riderId, onWaybillChange, onSettlementChange, onNotification]);
}
