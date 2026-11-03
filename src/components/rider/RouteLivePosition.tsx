import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function RouteLivePosition({ wayplanId }: { wayplanId: string }) {
  const [status, setStatus] = useState("Sharing is off.");
  const [enabled, setEnabled] = useState(false);
  const watch = useRef<number | null>(null);
  const lastSent = useRef(0);
  const busy = useRef(false);

  const stop = () => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setEnabled(false);
    setStatus("Sharing stopped. Saved position expires automatically.");
    void (supabase as any).rpc("be_field_live_position_update_v1", {
      p_wayplan_id: wayplanId, p_stop: true,
    }).then(() => undefined, () => undefined);
  };

  const start = () => {
    if (watch.current !== null || !navigator.geolocation || !window.isSecureContext) {
      setStatus("Location needs HTTPS and GPS permission."); return;
    }
    setEnabled(true);
    setStatus("Waiting for a precise GPS fix.");
    watch.current = navigator.geolocation.watchPosition(async (result) => {
      const {latitude, longitude, accuracy} = result.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
        (latitude === 0 && longitude === 0) || accuracy > 250) return;
      if (busy.current || Date.now() - lastSent.current < 20000) return;
      busy.current = true;
      lastSent.current = Date.now();
      const response = await (supabase as any).rpc("be_field_live_position_update_v1", {
        p_wayplan_id: wayplanId, p_latitude: latitude,
        p_longitude: longitude, p_accuracy_m: accuracy, p_stop: false,
      });
      busy.current = false;
      if (response.error || response.data?.ok !== true) {
        stop(); setStatus("Sharing failed: " + (response.error?.message || "Assignment not authorized."));
      } else setStatus("Live location shared for the assigned Wayplan.");
    }, () => {
      stop(); setStatus("GPS is unavailable or permission was denied.");
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
  };

  useEffect(() => {
    const hidden = () => { if (document.hidden && watch.current !== null) stop(); };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
      void (supabase as any).rpc("be_field_live_position_update_v1", {
        p_wayplan_id: wayplanId, p_stop: true,
      }).then(() => undefined, () => undefined);
    };
  }, [wayplanId]);

  return <section className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
    <h3 className="text-sm font-black">Optional live location</h3>
    <p className="mt-1 text-xs">Off by default; only during this route session. Updates expire after two minutes.</p>
    <div className="mt-2 flex gap-2">
      <button type="button" disabled={enabled} onClick={start} className="min-h-11 flex-1 rounded-xl bg-blue-900 p-2 text-white disabled:opacity-50">Start Sharing</button>
      <button type="button" disabled={!enabled} onClick={stop} className="min-h-11 flex-1 rounded-xl border bg-white p-2 disabled:opacity-50">Stop Sharing</button>
    </div>
    <p className="mt-2 text-xs" role="status">{status}</p>
  </section>;
}