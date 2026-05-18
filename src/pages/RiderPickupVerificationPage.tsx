import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle,
  FileText,
  Loader2,
  PenTool,
  RefreshCw,
  Scale,
  Truck,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProfileDrawer } from "@/components/ProfileDrawer";
import { supabase } from "@/integrations/supabase/client";

type PickupAssignment = {
  pickup_id: string;
  pickup_way_id?: string;
  way_id?: string;
  merchant_code?: string;
  merchant_name?: string;
  sender_name?: string;
  sender_phone?: string;
  pickup_address?: string;
  township?: string;
  city?: string;
  parcel_count?: number;
  status?: string;
  assigned_rider_name?: string;
  assigned_driver_name?: string;
  assigned_helper_name?: string;
  assigned_vehicle_plate?: string;
  delivery_prefix?: string;
  delivery_start_no?: number;
  delivery_end_no?: number;
  waybills?: WaybillRow[];
};

type WaybillRow = {
  id?: string;
  pickup_id?: string;
  deliver_way_id?: string;
  tracking_no?: string;
  line_no?: number;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_town?: string;
  address?: string;
  weight_kg?: number | string;
  photo_url?: string;
  status?: string;
};

type ParcelDraft = {
  line_no: number;
  deliver_way_id: string;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_town?: string;
  address?: string;
  weight_kg: string;
  photo_url: string;
  status?: string;
};

function SignaturePad({ onChange }: { onChange: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    canvas.setPointerCapture(event.pointerId);
    const ctx = canvas.getContext("2d")!;
    const p = point(event);
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const p = point(event);
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setSigned(true);
    onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setSigned(false);
    onChange("");
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(400, Math.floor(rect.width * window.devicePixelRatio));
    canvas.height = Math.max(160, Math.floor(rect.height * window.devicePixelRatio));
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }, []);

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="h-40 w-full cursor-crosshair rounded-xl border border-slate-300 bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => {
          drawing.current = false;
        }}
        onPointerCancel={() => {
          drawing.current = false;
        }}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className={`text-xs font-bold ${signed ? "text-green-700" : "text-slate-500"}`}>
          {signed ? "Signature captured" : "Draw sender signature"}
        </span>
        <button type="button" onClick={clear} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold">
          Clear
        </button>
      </div>
    </div>
  );
}

function buildDraftParcels(pickup: PickupAssignment | null): ParcelDraft[] {
  if (!pickup) return [];

  const waybills = Array.isArray(pickup.waybills) ? pickup.waybills : [];

  if (waybills.length > 0) {
    return waybills.map((w, index) => ({
      line_no: Number(w.line_no || index + 1),
      deliver_way_id: String(w.deliver_way_id || w.tracking_no || `${pickup.pickup_id}-${String(index + 1).padStart(3, "0")}`),
      recipient_name: w.recipient_name || "",
      recipient_phone: w.recipient_phone || "",
      recipient_town: w.recipient_town || "",
      address: w.address || "",
      weight_kg: w.weight_kg ? String(w.weight_kg) : "",
      photo_url: w.photo_url || "",
      status: w.status || "assigned",
    }));
  }

  const count = Math.max(Number(pickup.parcel_count || 1), 1);
  const start = Number(pickup.delivery_start_no || 1);
  const prefix = pickup.delivery_prefix || pickup.pickup_id.replace(/^P/, "D").replace(/-\d{3}$/, "");

  return Array.from({ length: count }, (_, index) => {
    const suffix = String(start + index).padStart(3, "0");
    return {
      line_no: index + 1,
      deliver_way_id: `${prefix}-${suffix}`,
      recipient_name: "",
      recipient_phone: "",
      recipient_town: "",
      address: "",
      weight_kg: "",
      photo_url: "",
      status: "assigned",
    };
  });
}

export default function RiderPickupVerificationPage() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [pickups, setPickups] = useState<PickupAssignment[]>([]);
  const [selectedPickupId, setSelectedPickupId] = useState("");
  const [parcels, setParcels] = useState<ParcelDraft[]>([]);
  const [signature, setSignature] = useState("");
  const [notice, setNotice] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedPickup = useMemo(
    () => pickups.find((p) => p.pickup_id === selectedPickupId) || null,
    [pickups, selectedPickupId]
  );

  const totalWeight = parcels.reduce((sum, p) => sum + (Number(p.weight_kg) || 0), 0);
  const allItemsReady = parcels.length > 0 && parcels.every((p) => Number(p.weight_kg) > 0 && !!p.photo_url);

  async function loadAssignedPickups() {
    setLoading(true);
    setNotice(null);

    try {
      const { data, error } = await (supabase as any).rpc("be_mobile_app_pickup_verification_queue", {
        p_workforce_code: null,
        p_workforce_type: "rider",
        p_limit: 100,
      });

      if (error) throw error;

      const nextPickups = Array.isArray(data?.pickups) ? data.pickups : [];
      setPickups(nextPickups);

      const first = nextPickups[0];
      if (!selectedPickupId && first?.pickup_id) {
        setSelectedPickupId(first.pickup_id);
        setParcels(buildDraftParcels(first));
      }

      if (nextPickups.length === 0) {
        setNotice({
          type: "error",
          text: "No assigned pickup found. Ask Supervisor to assign this rider in Enterprise Portal.",
        });
      }
    } catch (err: any) {
      setNotice({ type: "error", text: err?.message || "Failed to load assigned pickups." });
    } finally {
      setLoading(false);
    }
  }

  function selectPickup(pickupId: string) {
    const pickup = pickups.find((p) => p.pickup_id === pickupId) || null;
    setSelectedPickupId(pickupId);
    setParcels(buildDraftParcels(pickup));
    setSignature("");
    setNotice(null);
  }

  function updateParcel(index: number, patch: Partial<ParcelDraft>) {
    setParcels((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function handlePhoto(index: number, file?: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateParcel(index, { photo_url: String(reader.result || "") });
    reader.readAsDataURL(file);
  }

  async function finalizeHandover() {
    if (!selectedPickup) {
      setNotice({ type: "error", text: "Please select an assigned pickup first." });
      return;
    }

    if (!signature) {
      setNotice({ type: "error", text: "Sender signature is mandatory before finalizing handover." });
      return;
    }

    if (!allItemsReady) {
      setNotice({ type: "error", text: "Every parcel must have weight and cargo photo." });
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      const { error } = await (supabase as any).rpc("be_mobile_app_finalize_pickup_verification", {
        p_pickup_id: selectedPickup.pickup_id,
        p_payload: {
          pickup_id: selectedPickup.pickup_id,
          signature_url: signature,
          total_weight: totalWeight,
          parcel_count: parcels.length,
          parcels,
        },
      });

      if (error) throw error;

      setNotice({
        type: "success",
        text: `Pickup ${selectedPickup.pickup_id} verified and synchronized to Enterprise Portal.`,
      });

      await loadAssignedPickups();
    } catch (err: any) {
      setNotice({ type: "error", text: err?.message || "Finalize failed." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAssignedPickups();
  }, []);

  return (
    <>
      <AppShell role="rider" onOpenProfile={() => setProfileOpen(true)}>
        <main className="min-h-screen bg-slate-50 p-4 pb-32">
          <section className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-slate-950">Field Pickup Verification</h1>
              <p className="mt-1 text-sm text-slate-600">
                Load assigned pickups from Enterprise Portal, verify parcels, then synchronize handover.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadAssignedPickups()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Sync Assignments
            </button>
          </section>

          {notice && (
            <div
              className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-bold ${
                notice.type === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-green-200 bg-green-50 text-green-700"
              }`}
            >
              {notice.text}
            </div>
          )}

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500">
                Assigned Pickup Way ID
              </span>
              <select
                value={selectedPickupId}
                onChange={(event) => selectPickup(event.target.value)}
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 font-mono text-sm font-bold text-slate-900"
              >
                <option value="">No assigned pickup selected...</option>
                {pickups.map((p) => (
                  <option key={p.pickup_id} value={p.pickup_id}>
                    {p.pickup_id} — {p.merchant_name || p.merchant_code || "-"} — Count: {p.parcel_count || 1}
                  </option>
                ))}
              </select>
            </label>

            {selectedPickup ? (
              <div className="mt-5 grid gap-4 md:grid-cols-4">
                <Info label="Pickup Way ID" value={selectedPickup.pickup_id} mono />
                <Info label="Merchant" value={selectedPickup.merchant_name || selectedPickup.merchant_code || "-"} />
                <Info label="Township" value={selectedPickup.township || "-"} />
                <Info label="Parcel Count" value={String(selectedPickup.parcel_count || parcels.length || 1)} />
                <div className="md:col-span-4 rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-500">Pickup Address</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">{selectedPickup.pickup_address || "-"}</div>
                </div>
              </div>
            ) : (
              <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                <Truck className="mb-3 h-12 w-12 text-slate-400" />
                <h2 className="text-base font-black uppercase text-slate-950">No Assigned Pickup</h2>
                <p className="mt-1 max-w-md text-sm text-slate-500">
                  This screen does not create local pickup templates. It only loads assignments from Enterprise Portal.
                </p>
              </div>
            )}
          </section>

          {selectedPickup && (
            <section className="mt-5 space-y-4">
              {parcels.map((parcel, index) => (
                <div key={parcel.deliver_way_id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm font-black text-blue-700">{parcel.deliver_way_id}</div>
                      <div className="text-xs text-slate-500">{parcel.status || "assigned"}</div>
                    </div>
                    <FileText className="h-5 w-5 text-slate-400" />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Input label="Recipient Name" value={parcel.recipient_name || ""} readOnly />
                    <Input label="Recipient Phone" value={parcel.recipient_phone || ""} readOnly />
                    <Input label="Township" value={parcel.recipient_town || ""} readOnly />
                    <Input label="Address" value={parcel.address || ""} readOnly />
                    <Input
                      label="Actual Weight KG"
                      value={parcel.weight_kg}
                      type="number"
                      onChange={(value) => updateParcel(index, { weight_kg: value })}
                    />

                    <label className="flex min-h-[76px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3 text-center">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(event) => handlePhoto(index, event.target.files?.[0])}
                      />
                      <Camera className={`mb-1 h-5 w-5 ${parcel.photo_url ? "text-green-600" : "text-slate-500"}`} />
                      <span className={`text-xs font-black uppercase ${parcel.photo_url ? "text-green-700" : "text-slate-600"}`}>
                        {parcel.photo_url ? "Cargo Photo OK" : "Capture Cargo Photo"}
                      </span>
                    </label>
                  </div>
                </div>
              ))}

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <PenTool className="h-5 w-5 text-blue-700" />
                  <h2 className="text-base font-black uppercase text-slate-950">Sender Signature</h2>
                </div>

                <SignaturePad onChange={setSignature} />

                <div className="mt-4 flex items-start gap-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Sender confirms parcel count, actual weight, cargo condition, and handover.
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-slate-500" />
                    <span className="font-black text-slate-950">{parcels.length} Parcels</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-slate-500" />
                    <span className="font-black text-slate-950">{totalWeight.toFixed(1)} KG</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void finalizeHandover()}
                  disabled={loading || !signature || !allItemsReady}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-4 text-sm font-black uppercase tracking-wide text-white disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                  Finalize Pickup Verification
                </button>
              </div>
            </section>
          )}
        </main>
      </AppShell>

      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`mt-1 font-black text-slate-950 ${mono ? "font-mono text-blue-700" : ""}`}>{value}</div>
    </div>
  );
}

function Input({
  label,
  value,
  type = "text",
  readOnly = false,
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
        className={`h-11 w-full rounded-xl border border-slate-300 px-3 text-sm ${
          readOnly ? "bg-slate-100 font-bold text-slate-700" : "bg-white text-slate-950"
        }`}
      />
    </label>
  );
}
