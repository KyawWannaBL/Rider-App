import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Route as RouteIcon } from "lucide-react";
import { ActiveRouteScreen } from "@/components/rider/ActiveRouteScreen";
import { DeliveryMissionPanel } from "@/components/rider/DeliveryMissionPanel";
import { RiderRouteOverview } from "@/components/rider/RiderRouteOverview";
import { RiderNotification } from "@/components/rider/RiderNotification";
import { loadRiderRoute, openNavigation } from "@/lib/riderOperations";
import { useRiderRealtime } from "@/hooks/useRiderRealtime";
import type { Dispatch, Waybill } from "@/types/rider";

export default function RiderRoutePage() {
  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const [waybills, setWaybills] = useState<Waybill[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedWayplanId, setSelectedWayplanId] = useState("");
  const [wayplanIds, setWayplanIds] = useState<string[]>([]);
  const [showStopDetails, setShowStopDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [notification, setNotification] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadRiderRoute(selectedWayplanId || undefined);
      setWayplanIds(next.wayplanIds);
      setSelectedWayplanId(next.dispatch?.id || "");
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
  }, [selectedWayplanId]);

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

      <div className="border-b border-blue-200 bg-blue-950 px-4 py-4 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-blue-200">BRITIUM EXPRESS · FIELD OPERATIONS</p>
          <h1 className="mt-1 text-2xl font-black">Delivery Mission Control</h1>
          <p className="mt-1 text-xs font-semibold text-blue-100">Assigned route map, customer contact and secure delivery actions in one workspace</p>
        </div>
      </div>
      {message && <div className="mx-auto max-w-7xl px-4 py-2 text-xs font-bold text-blue-900" role="status">{message}</div>}
      {wayplanIds.length > 1 && <div className="mx-auto max-w-7xl px-4 pt-3">
        <label className="block text-sm font-black text-slate-800">Assigned Wayplan
          <select className="mt-1 min-h-12 w-full max-w-xl rounded-xl border border-blue-200 bg-white px-3 font-bold text-slate-900"
            value={selectedWayplanId} onChange={event => { setSelectedWayplanId(event.target.value); setSelectedId(""); }}>
            {wayplanIds.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
        </label>
      </div>}
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-4 px-3 py-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.9fr)] lg:px-5">
        <div className="min-w-0 space-y-4">
          <RiderRouteOverview dispatch={dispatch} waybills={waybills} />
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <button type="button" className="w-full px-4 py-3 text-left font-black text-slate-900"
              onClick={() => setShowStopDetails(value => !value)}>
              {showStopDetails ? "Hide detailed stop information −" : "Show selected stop details and pin editor +"}
            </button>
            {showStopDetails && <ActiveRouteScreen
              dispatch={dispatch}
              waybill={selected}
              onNavigate={openNavigation}
              onOpenDelivery={openDelivery}
              onPinSaved={() => {
                setMessage("Drop-off pin saved. Route coordinates refreshed.");
                void load();
              }}
            />}
          </div>
        </div>
        <DeliveryMissionPanel
          waybills={waybills}
          selected={selected}
          onSelect={waybill => setSelectedId(waybill.id)}
          onNavigate={openNavigation}
          onVerify={openDelivery}
          onRefresh={() => void load()}
          loading={loading}
        />
      </div>
    </>
  );
}
