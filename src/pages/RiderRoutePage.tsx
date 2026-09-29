import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Route as RouteIcon } from "lucide-react";
import { ActiveRouteScreen } from "@/components/rider/ActiveRouteScreen";
import { RiderNotification } from "@/components/rider/RiderNotification";
import { loadRiderRoute, openNavigation } from "@/lib/riderOperations";
import { useRiderRealtime } from "@/hooks/useRiderRealtime";
import type { Dispatch, Waybill } from "@/types/rider";

export default function RiderRoutePage() {
  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const [waybills, setWaybills] = useState<Waybill[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [notification, setNotification] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadRiderRoute();
      setDispatch(next.dispatch);
      setWaybills(next.waybills);
      setSelectedId((current) =>
        current && next.waybills.some((x) => x.id === current)
          ? current
          : next.waybills[0]?.id || "",
      );
      setMessage(next.waybills.length ? `${next.waybills.length} active stop(s) synchronized.` : "No active delivery stop assigned.");
    } catch (error: any) {
      setMessage(error?.message || "Unable to load active Rider route.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRiderRealtime({
    riderId: dispatch?.riderId,
    onWaybillChange: load,
    onNotification: (payload) => setNotification(payload),
  });

  const selected = useMemo(
    () => waybills.find((waybill) => waybill.id === selectedId) || waybills[0] || null,
    [selectedId, waybills],
  );

  function openDelivery(waybill: Waybill) {
    window.location.hash = `/delivery?deliveryWayId=${encodeURIComponent(waybill.deliveryWayId)}`;
  }

  if (loading && !selected) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-slate-100">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-700" />
          <p className="mt-3 font-black text-slate-700">Loading active route...</p>
        </div>
      </div>
    );
  }

  if (!dispatch || !selected) {
    return (
      <div className="min-h-[65vh] bg-slate-100 p-4">
        <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <RouteIcon className="mx-auto h-10 w-10 text-slate-400" />
          <h1 className="mt-4 text-xl font-black text-slate-950">No Active Route</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">{message}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 font-black text-white"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {notification && (
        <RiderNotification
          title={String(notification.title || "Dispatch update")}
          message={String(notification.message || notification.body || "Your route has been updated.")}
          actionLabel="Refresh route"
          onAction={() => {
            setNotification(null);
            void load();
          }}
          onClose={() => setNotification(null)}
        />
      )}

      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-2 overflow-x-auto">
          {waybills.map((waybill) => (
            <button
              type="button"
              key={waybill.id}
              onClick={() => setSelectedId(waybill.id)}
              className={[
                "shrink-0 rounded-2xl px-4 py-3 text-left text-xs font-black transition",
                waybill.id === selected.id
                  ? "bg-blue-700 text-white"
                  : "border border-slate-200 bg-white text-slate-700",
              ].join(" ")}
            >
              <span className="block">#{waybill.sequenceNo || "-"}</span>
              <span className="mt-1 block font-mono">{waybill.deliveryWayId}</span>
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div className="bg-blue-50 px-4 py-2 text-center text-xs font-bold text-blue-900">
          {message}
        </div>
      )}

      <ActiveRouteScreen
        dispatch={dispatch}
        waybill={selected}
        onNavigate={openNavigation}
        onOpenDelivery={openDelivery}
        onPinSaved={() => {
          setMessage("Drop-off pin saved. Route coordinates refreshed.");
          void load();
        }}
      />
    </>
  );
}
