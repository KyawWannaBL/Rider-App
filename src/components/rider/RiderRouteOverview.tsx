import { useEffect, useMemo, useState } from "react";
import { ExternalLink, MapPinned, Route as RouteIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Dispatch, Waybill } from "@/types/rider";

type Office = { branch_code: string; branch_name: string; lat: number; lng: number };
type OrderedStop = { sequence: number; waybill: Waybill; lat: number; lng: number };

function numberCoordinate(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function directionsUrl(origin: string, stops: OrderedStop[]) {
  const coords = stops.map((stop) => `${stop.lat},${stop.lng}`);
  const params = new URLSearchParams({
    api: "1", travelmode: "driving", origin,
    destination: coords[coords.length - 1],
  });
  if (coords.length > 1) params.set("waypoints", coords.slice(0, -1).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function RiderRouteOverview({ dispatch, waybills }: { dispatch: Dispatch; waybills: Waybill[] }) {
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOffice, setSelectedOffice] = useState("");
  const [officeMessage, setOfficeMessage] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!supabase) throw new Error("No database connection.");
        const { data, error } = await supabase.from("be_branch_offices")
          .select("branch_code,branch_name,lat,lng").eq("active", true);
        if (error) throw error;
        if (cancelled) return;
        const valid = (data || []).filter((row) =>
          row.branch_code && Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng)) &&
          Number(row.lat) !== 0 && Number(row.lng) !== 0,
        ).map((row) => ({
          branch_code: String(row.branch_code),
          branch_name: String(row.branch_name || row.branch_code),
          lat: Number(row.lat), lng: Number(row.lng),
        }));
        setOffices(valid);
        if (!valid.length) setOfficeMessage("Branch coordinates are unavailable. Select a departure office once the branch register is accessible.");
      } catch {
        if (!cancelled) setOfficeMessage("Could not load branch origins. The route stop list remains available.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const ordered = useMemo(() => {
    const byId = new Map(waybills.map((waybill) => [waybill.id, waybill]));
    const byWay = new Map(waybills.map((waybill) => [waybill.deliveryWayId, waybill]));
    return [...dispatch.stops].sort((a, b) => a.sequence - b.sequence)
      .map((stop) => {
        const waybill = byId.get(stop.waybillId) || byWay.get(stop.waybillId);
        if (!waybill) return null;
        const location = waybill.customer.location || stop.location;
        const lat = numberCoordinate(location?.latitude);
        const lng = numberCoordinate(location?.longitude);
        return { sequence: stop.sequence, waybill, lat, lng };
      }).filter((stop): stop is NonNullable<typeof stop> => stop !== null);
  }, [dispatch.stops, waybills]);

  const selected = offices.find((office) => office.branch_code === selectedOffice);
  const mapped = ordered.filter((stop): stop is OrderedStop => stop.lat !== null && stop.lng !== null);
  // Google Maps mobile waypoint limits vary. Use small, overlapping batches to retain every stop.
  const segments = useMemo(() => {
    if (!selected || mapped.length !== ordered.length) return [];
    const result: { from: number; to: number; url: string }[] = [];
    for (let start = 0; start < mapped.length; start += 9) {
      const stops = mapped.slice(start, start + 9);
      const origin = start === 0
        ? `${selected.lat},${selected.lng}`
        : `${mapped[start - 1].lat},${mapped[start - 1].lng}`;
      result.push({ from: start + 1, to: start + stops.length, url: directionsUrl(origin, stops) });
    }
    return result;
  }, [selected, mapped, ordered.length]);

  return <section className="mx-auto max-w-lg border-b border-blue-100 bg-white px-4 py-4" data-rider-branch-route-overview="true">
    <button type="button" onClick={() => setExpanded((value) => !value)}
      className="flex min-h-12 w-full items-center justify-between rounded-xl bg-blue-50 px-4 text-left font-black text-blue-950">
      <span className="flex items-center gap-2"><RouteIcon className="h-5 w-5"/> Full Wayplan Route · {ordered.length} stops</span>
      <span>{expanded ? "Hide" : "View"}</span>
    </button>
    {expanded && <div className="mt-3 space-y-3">
      <p className="text-xs font-semibold leading-5 text-slate-600">
        Follow the Supervisor-approved stop order. Choose the departure head office or branch to see directions from that office. Viewing the map does not reassign stops.
      </p>
      <label className="block text-xs font-black text-slate-700">Departure office
        <select className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
          value={selectedOffice} onChange={(event) => setSelectedOffice(event.target.value)}>
          <option value="">Choose head office / branch</option>
          {offices.map((office) => <option key={office.branch_code} value={office.branch_code}>{office.branch_name}</option>)}
        </select>
      </label>
      {officeMessage && <p className="text-xs font-semibold text-amber-700">{officeMessage}</p>}
      {ordered.length !== mapped.length && <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">
        {ordered.length - mapped.length} stop(s) have no precise coordinates. Complete their pins before opening the full route map.
      </p>}
      {segments.map((segment, index) => <a key={index} href={segment.url} target="_blank" rel="noopener noreferrer"
        className="flex min-h-12 items-center justify-between rounded-xl bg-blue-900 px-4 text-sm font-black text-white">
        <span><MapPinned className="mr-2 inline h-4 w-4"/> Open map · stops {segment.from}–{segment.to}</span>
        <ExternalLink className="h-4 w-4"/>
      </a>)}
      <ol className="max-h-72 space-y-2 overflow-y-auto">
        {ordered.map(({sequence, waybill, lat, lng}) => <li key={waybill.id} className="rounded-xl border border-slate-200 p-3 text-xs">
          <div className="font-black text-slate-900">#{sequence} · {waybill.deliveryWayId}</div>
          <div className="mt-1 text-slate-600">{waybill.customer.name} · {waybill.customer.address || waybill.customer.township || "No address"}</div>
          {lat === null || lng === null ? <span className="font-bold text-amber-700">Location pending</span> : null}
        </li>)}
      </ol>
      <p className="text-[11px] text-slate-500">Google Maps displays road directions for each segment. It may offer different routes due to live road conditions; it does not change the approved Wayplan sequence.</p>
    </div>}
  </section>;
}
