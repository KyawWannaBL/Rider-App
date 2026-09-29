import { useEffect, useMemo, useState } from "react";
import {
  Crosshair,
  ExternalLink,
  LocateFixed,
  MapPin,
  Minus,
  Navigation,
  Plus,
  Save,
} from "lucide-react";
import type { Waybill } from "@/types/rider";
import { openPinInGoogleMaps, saveRiderDropoffPin } from "@/lib/riderOperations";
import { InteractivePinMap } from "@/components/rider/InteractivePinMap";

type Pin = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

function validCoordinate(value: number | undefined) {
  return Number.isFinite(value) && Number(value) !== 0;
}

function offsetCoordinate(pin: Pin, northMeters: number, eastMeters: number): Pin {
  const latRadians = (pin.latitude * Math.PI) / 180;
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = 111_320 * Math.cos(latRadians);

  return {
    ...pin,
    latitude: pin.latitude + northMeters / metersPerDegreeLat,
    longitude: pin.longitude + eastMeters / metersPerDegreeLng,
  };
}

export function DropoffPinEditor({
  waybill,
  onSaved,
}: {
  waybill: Waybill;
  onSaved?: (pin: Pin) => void;
}) {
  const original = waybill.customer.location;
  const [pin, setPin] = useState<Pin | null>(
    original && validCoordinate(original.latitude) && validCoordinate(original.longitude)
      ? { latitude: original.latitude, longitude: original.longitude }
      : null,
  );
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState(
    pin
      ? "Saved drop-off pin loaded. Adjust only if the actual entrance/drop-off point is different."
      : "No precise drop-off pin is saved yet. Use your current location when you are at the correct drop-off point.",
  );

  useEffect(() => {
    if (original && validCoordinate(original.latitude) && validCoordinate(original.longitude)) {
      setPin({ latitude: original.latitude, longitude: original.longitude });
    }
  }, [original?.latitude, original?.longitude]);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage("GPS is not available on this device.");
      return;
    }

    setLocating(true);
    setMessage("Finding your current GPS position…");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setPin(next);
        setLocating(false);
        setMessage(
          `Current location selected. GPS accuracy is about ±${Math.round(position.coords.accuracy)} m. Fine-adjust the pin if needed, then save.`,
        );
      },
      (error) => {
        setLocating(false);
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? "Location permission is required. Allow precise location for the Rider App and try again."
            : "Unable to read current GPS. Move outdoors or near a window and try again.",
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 12_000,
        maximumAge: 5_000,
      },
    );
  }

  async function save() {
    if (!pin) {
      setMessage("Choose the drop-off point first.");
      return;
    }

    setSaving(true);
    try {
      await saveRiderDropoffPin({
        deliveryWayId: waybill.deliveryWayId,
        latitude: pin.latitude,
        longitude: pin.longitude,
        accuracy: pin.accuracy,
      });

      setMessage("Drop-off pin saved successfully. Navigation will use this location.");
      onSaved?.(pin);
    } catch (error: any) {
      setMessage(error?.message || "Unable to save the drop-off pin.");
    } finally {
      setSaving(false);
    }
  }

  function nudge(northMeters: number, eastMeters: number) {
    if (!pin) {
      setMessage("Use current location first, then fine-adjust the pin.");
      return;
    }
    setPin((current) => (current ? offsetCoordinate(current, northMeters, eastMeters) : current));
    setMessage("Pin adjusted. Review the map and press Save Drop-off Pin.");
  }

  return (
    <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_18px_48px_rgba(15,23,42,.10)]">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 p-4 text-white">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-200">
            <MapPin className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
              Drop-off Pin
            </p>
            <h2 className="mt-1 text-lg font-black">Set the exact customer entrance / handover point</h2>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">
              {waybill.deliveryWayId} · {waybill.customer.township || "Delivery location"}
            </p>
          </div>
        </div>
      </div>

      <div className="relative h-[360px] bg-slate-100">
        {pin ? (
          <InteractivePinMap
            point={pin}
            onPointChange={(next) => {
              setPin((current) => ({ ...next, accuracy: current?.accuracy }));
              setMessage("Pin moved on the map. Review the exact gate/entrance and save.");
            }}
            interactive
          />
        ) : (
          <div className="grid h-full place-items-center px-8 text-center">
            <div>
              <Crosshair className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-3 text-sm font-black text-slate-700">Use My Current Location first</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Then tap or drag directly on the map to set the exact drop-off point.</p>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute left-3 top-12 rounded-2xl border border-white/70 bg-white/94 px-3 py-2 text-xs font-black text-slate-700 shadow-lg backdrop-blur">
          {pin ? `${pin.latitude.toFixed(6)}, ${pin.longitude.toFixed(6)}` : "No precise pin yet"}
        </div>
      </div>

      <div className="space-y-4 p-4">
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="v142-jelly flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 font-black text-slate-950 shadow-[0_14px_32px_rgba(34,211,238,.18)] disabled:opacity-50"
        >
          <LocateFixed className={`h-5 w-5 ${locating ? "animate-pulse" : ""}`} />
          {locating ? "Finding precise GPS…" : "Use My Current Location"}
        </button>

        {pin && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-900">Fine-adjust the pin</p>
                <p className="text-xs font-semibold text-slate-500">
                  Move the pin by 5 m for the exact gate/entrance.
                </p>
              </div>
              {pin.accuracy != null && (
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600 shadow-sm">
                  GPS ±{Math.round(pin.accuracy)} m
                </span>
              )}
            </div>

            <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-2">
              <span />
              <NudgeButton label="North" onClick={() => nudge(5, 0)} icon={<Plus className="h-4 w-4 rotate-45" />} />
              <span />
              <NudgeButton label="West" onClick={() => nudge(0, -5)} icon={<Navigation className="h-4 w-4 -rotate-90" />} />
              <button
                type="button"
                onClick={() => {
                  if (original) {
                    setPin({ latitude: original.latitude, longitude: original.longitude });
                    setMessage("Pin reset to the saved delivery location.");
                  }
                }}
                className="grid min-h-12 place-items-center rounded-2xl border border-slate-200 bg-white text-xs font-black text-slate-600 shadow-sm"
              >
                Reset
              </button>
              <NudgeButton label="East" onClick={() => nudge(0, 5)} icon={<Navigation className="h-4 w-4 rotate-90" />} />
              <span />
              <NudgeButton label="South" onClick={() => nudge(-5, 0)} icon={<Minus className="h-4 w-4" />} />
              <span />
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-blue-50 p-3 text-sm font-bold leading-6 text-blue-900">
          {message}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={!pin}
            onClick={() => pin && openPinInGoogleMaps(pin.latitude, pin.longitude)}
            className="v142-jelly flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 font-black text-slate-800 shadow-sm disabled:opacity-40"
          >
            <ExternalLink className="h-5 w-5" />
            Open in Google Maps
          </button>

          <button
            type="button"
            disabled={!pin || saving}
            onClick={() => void save()}
            className="v142-button-sheen v142-jelly flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#d4af37] to-[#f4d66d] px-4 font-black text-slate-950 shadow-[0_14px_32px_rgba(212,175,55,.18)] disabled:opacity-40"
          >
            <Save className="h-5 w-5" />
            {saving ? "Saving…" : "Save Drop-off Pin"}
          </button>
        </div>
      </div>
    </section>
  );
}

function NudgeButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="v142-jelly flex min-h-12 items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-white px-2 text-xs font-black text-slate-700 shadow-sm"
    >
      {icon}
      {label}
    </button>
  );
}
