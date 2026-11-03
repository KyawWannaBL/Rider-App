import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Minus, Plus, LocateFixed } from "lucide-react";

export type DropMapPoint = {
  id: string;
  latitude: number;
  longitude: number;
  sequence: number;
  label: string;
};
export type DropMapOffice = { label: string; latitude: number; longitude: number };
const TILE = 256;
const LAT_LIMIT = 85.05112878;
const safeLat = (lat: number) => Math.max(-LAT_LIMIT, Math.min(LAT_LIMIT, lat));
function world(latitude: number, longitude: number, zoom: number) {
  const scale = TILE * 2 ** zoom;
  const rad = safeLat(latitude) * Math.PI / 180;
  return {
    x: (longitude + 180) / 360 * scale,
    y: (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * scale,
  };
}
const isPoint = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng)
  && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

/** On-screen geographical overview, not a road-geometry claim. Google Maps links provide road directions. */
export function AssignedDropsMap({ office, stops }: { office?: DropMapOffice | null; stops: DropMapPoint[] }) {
  const element = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 360, height: 340 });
  const [zoomDelta, setZoomDelta] = useState(0);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const validStops = useMemo(() => stops.filter(s => isPoint(s.latitude, s.longitude)).sort((a,b) => a.sequence - b.sequence), [stops]);
  const all = useMemo(() => [
    ...(office && isPoint(office.latitude, office.longitude) ? [{ id: "__office__", latitude: office.latitude, longitude: office.longitude }] : []),
    ...validStops,
  ], [office, validStops]);
  useEffect(() => {
    if (!element.current) return;
    const refresh = () => setSize({ width: Math.max(280, element.current?.clientWidth || 360), height: Math.max(260, element.current?.clientHeight || 340) });
    refresh();
    const observer = new ResizeObserver(refresh);
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  const autoView = useMemo(() => {
    if (!all.length) return { zoom: 12, cx: world(16.8409, 96.1735, 12).x, cy: world(16.8409, 96.1735, 12).y };
    // Fit the full office-and-delivery bounds rather than silently cropping distant drops.
    for (let zoom = 16; zoom >= 3; zoom -= 1) {
      const pixels = all.map(p => world(p.latitude, p.longitude, zoom));
      const minX = Math.min(...pixels.map(p => p.x)), maxX = Math.max(...pixels.map(p => p.x));
      const minY = Math.min(...pixels.map(p => p.y)), maxY = Math.max(...pixels.map(p => p.y));
      if ((maxX - minX <= size.width - 88 && maxY - minY <= size.height - 100) || zoom === 3) {
        return { zoom, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
      }
    }
    return { zoom: 12, cx: 0, cy: 0 };
  }, [all, size.width, size.height]);
  const zoom = Math.max(3, Math.min(18, autoView.zoom + zoomDelta));
  const scale = 2 ** (zoom - autoView.zoom);
  const center = { x: autoView.cx * scale, y: autoView.cy * scale };
  const place = (lat: number, lng: number) => {
    const p = world(lat, lng, zoom);
    return { x: size.width / 2 + p.x - center.x, y: size.height / 2 + p.y - center.y };
  };
  const tiles = [];
  const leftWorld = center.x - size.width / 2, topWorld = center.y - size.height / 2;
  const firstX = Math.floor(leftWorld / TILE), lastX = Math.floor((leftWorld + size.width) / TILE);
  const firstY = Math.floor(topWorld / TILE), lastY = Math.floor((topWorld + size.height) / TILE);
  const side = 2 ** zoom;
  for (let x = firstX; x <= lastX; x++) for (let y = firstY; y <= lastY; y++) {
    if (y < 0 || y >= side) continue;
    const wrapped = ((x % side) + side) % side;
    tiles.push({ key: `${zoom}-${x}-${y}`, url: `https://tile.openstreetmap.org/${zoom}/${wrapped}/${y}.png`, left: x * TILE - leftWorld, top: y * TILE - topWorld });
  }
  const officePoint = office && isPoint(office.latitude, office.longitude) ? place(office.latitude, office.longitude) : null;
  const points = validStops.map(stop => ({ ...stop, xy: place(stop.latitude, stop.longitude) }));
  const focused = points.find(point => point.id === focusedId);
  return <section className="space-y-2" aria-label="All delivery drops overview">
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><MapPin className="h-4 w-4 text-blue-700" /> Delivery drops on map</h3>
      <span className="text-xs font-bold text-slate-600">{validStops.length} of {stops.length} pinned</span>
    </div>
    <div ref={element} className="relative h-[55vh] min-h-[400px] max-h-[720px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 lg:h-[620px]" role="img" aria-label={`Map showing ${validStops.length} numbered delivery drops`}>
      {tiles.map(tile => <img key={tile.key} src={tile.url} alt="" draggable={false} className="pointer-events-none absolute h-64 w-64 max-w-none select-none" style={{ left: tile.left, top: tile.top }} />)}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size.width} ${size.height}`}>
        {officePoint && points.length > 0 && <line x1={officePoint.x} y1={officePoint.y} x2={points[0].xy.x} y2={points[0].xy.y} stroke="#2563eb" strokeWidth="3" strokeDasharray="6 6" />}
        {points.slice(1).map((point, index) => <line key={point.id} x1={points[index].xy.x} y1={points[index].xy.y} x2={point.xy.x} y2={point.xy.y} stroke="#2563eb" strokeWidth="3" strokeDasharray="6 6" />)}
      </svg>
      {officePoint && <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-700 p-2 text-white shadow-lg" style={{left:officePoint.x,top:officePoint.y}} title={office?.label || "Office"}>
        <LocateFixed className="h-5 w-5" />
      </div>}
      {points.map(point => <button key={point.id} type="button" onClick={() => setFocusedId(point.id)}
        title={`Stop ${point.sequence}: ${point.label}`}
        aria-label={`Show stop ${point.sequence}: ${point.label}`}
        className="absolute z-10 flex h-9 min-w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-blue-800 px-1 text-xs font-black text-white shadow-lg focus-visible:outline-4 focus-visible:outline-amber-400"
        style={{left:point.xy.x,top:point.xy.y}}>{point.sequence}</button>)}
      <div className="absolute right-2 top-2 z-20 flex flex-col gap-2">
        <button type="button" onClick={() => setZoomDelta(z => Math.min(z + 1, 6))} className="grid h-11 w-11 place-items-center rounded-xl bg-white shadow" aria-label="Zoom in"><Plus className="h-5 w-5"/></button>
        <button type="button" onClick={() => setZoomDelta(z => Math.max(z - 1, -9))} className="grid h-11 w-11 place-items-center rounded-xl bg-white shadow" aria-label="Zoom out"><Minus className="h-5 w-5"/></button>
        <button type="button" onClick={() => {setZoomDelta(0);setFocusedId(null);}} className="rounded-xl bg-white px-2 py-2 text-xs font-black shadow">Fit all</button>
      </div>
      {focused && <div className="absolute bottom-9 left-2 right-2 z-20 rounded-xl bg-white/95 p-3 text-xs shadow-xl">
        <div className="font-black">Stop #{focused.sequence} · {focused.label}</div>
        <div className="mt-1 text-slate-600">{focused.latitude.toFixed(6)}, {focused.longitude.toFixed(6)}</div>
        <button type="button" className="mt-2 font-bold text-blue-700" onClick={() => setFocusedId(null)}>Close</button>
      </div>}
      {!points.length && <div className="absolute inset-0 z-10 grid place-items-center bg-white/85 p-5 text-center text-sm font-bold text-slate-700">
        No precise delivery pins are available for this Wayplan. Check the saved parcel locations.
      </div>}
      <div className="pointer-events-none absolute bottom-1 left-2 z-10 rounded bg-white/85 px-2 text-[10px] text-slate-700">© OpenStreetMap contributors</div>
    </div>
    <p className="text-[11px] leading-5 text-slate-600">Green marker: selected departure office. Blue numbered markers: delivery sequence. Dashed lines show stop order, not actual road geometry. Use the Google Maps buttons for road navigation.</p>
  </section>;
}
