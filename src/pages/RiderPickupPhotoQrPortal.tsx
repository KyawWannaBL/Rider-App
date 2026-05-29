// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";

type PickupRow = Record<string, any>;

type ParcelDraft = {
  line_no: number;
  waybill_no: string;
  delivery_way_id: string;
  temp_qr_code: string;
  parcel_weight: string;
  remarks: string;
  cargo_photo_data_url?: string;
  cargo_photo_url?: string;
  cargo_photo_name?: string;
  photo_status?: string;
  saved?: boolean;
};

function rowsFromSnapshot(data: any): PickupRow[] {
  for (const key of ["assigned_pickups", "delivery_jobs", "jobs", "items"]) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

function safeText(value: any, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function baseFromPickup(pickupId: string) {
  const clean = String(pickupId || "").toUpperCase();
  const match = clean.match(/^P([0-9]{4}-[A-Z0-9]+)-[0-9]{3}$/);
  return match ? match[1] : clean.replace(/^P/, "");
}

function lineCode(prefix: "D" | "W", pickupId: string, lineNo: number) {
  const safeLine = Math.max(1, Math.min(Number(lineNo || 1), 50));
  return `${prefix}${baseFromPickup(pickupId)}-${String(safeLine).padStart(3, "0")}`;
}

function tempQrCode(pickupId: string, lineNo: number) {
  return `TQR-${String(pickupId || "").toUpperCase()}-${String(lineNo).padStart(3, "0")}`;
}

function qrImageUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(value)}`;
}

function buildParcels(pickup: PickupRow): ParcelDraft[] {
  const pickupId = safeText(pickup.pickup_id || pickup.pickup_way_id, "");
  const count = Math.max(1, Math.min(Number(pickup.parcel_count || 1), 50));

  return Array.from({ length: count }, (_, idx) => {
    const line = idx + 1;
    return {
      line_no: line,
      waybill_no: lineCode("W", pickupId, line),
      delivery_way_id: lineCode("D", pickupId, line),
      temp_qr_code: tempQrCode(pickupId, line),
      parcel_weight: "",
      remarks: "",
      photo_status: "pending_photo_check",
      saved: false,
    };
  });
}

export default function RiderPickupPhotoQrPortal() {
  const params = useParams();
  const [pickups, setPickups] = useState<PickupRow[]>([]);
  const [selectedPickup, setSelectedPickup] = useState<PickupRow | null>(null);
  const [parcels, setParcels] = useState<ParcelDraft[]>([]);
  const [search, setSearch] = useState(params.pickupId || "");
  const [message, setMessage] = useState("Loading assigned pickups...");
  const [loading, setLoading] = useState(false);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  async function loadAssignedPickups() {
    setLoading(true);
    setMessage("Loading assigned pickups from Britium workflow...");

    const { data, error } = await (supabase as any).rpc("be_mobile_go_live_snapshot", {
      p_payload: {
        role: "rider",
        search: search || null,
        p_limit: 200,
      },
    });

    if (error) {
      console.error(error);
      setMessage(`Failed to load assigned pickups: ${error.message}`);
      setLoading(false);
      return;
    }

    const rows = rowsFromSnapshot(data);
    setPickups(rows);

    const requested = params.pickupId || search;
    const first =
      rows.find((row) => row.pickup_id === requested || row.pickup_way_id === requested) ||
      rows[0];

    if (first) {
      await selectPickup(first);
    }

    setMessage(`Loaded ${rows.length} assigned pickup(s).`);
    setLoading(false);
  }

  async function selectPickup(row: PickupRow) {
    setSelectedPickup(row);

    const pickupId = safeText(row.pickup_id || row.pickup_way_id, "");

    const { data } = await (supabase as any).rpc("be_pickup_parcel_capture_snapshot", {
      p_pickup_id: pickupId,
    });

    const generated = buildParcels(row);
    const savedParcels = Array.isArray(data?.parcels) ? data.parcels : [];

    const merged = generated.map((draft) => {
      const saved = savedParcels.find((p: any) => Number(p.line_no || p.row_no) === draft.line_no);
      if (!saved) return draft;

      return {
        ...draft,
        waybill_no: saved.waybill_no || draft.waybill_no,
        delivery_way_id: saved.delivery_way_id || draft.delivery_way_id,
        temp_qr_code: saved.temp_qr_code || draft.temp_qr_code,
        parcel_weight: saved.parcel_weight ? String(saved.parcel_weight) : "",
        remarks: saved.remarks || "",
        cargo_photo_url: saved.cargo_photo_url || "",
        cargo_photo_data_url: saved.cargo_photo_data_url || "",
        cargo_photo_name: saved.cargo_photo_name || "",
        photo_status: saved.photo_status || draft.photo_status,
        saved: true,
      };
    });

    setParcels(merged);
  }

  function updateParcel(lineNo: number, patch: Partial<ParcelDraft>) {
    setParcels((current) =>
      current.map((parcel) =>
        parcel.line_no === lineNo ? { ...parcel, ...patch, saved: false } : parcel
      )
    );
  }

  async function onPhotoSelected(lineNo: number, file?: File) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateParcel(lineNo, {
        cargo_photo_data_url: String(reader.result || ""),
        cargo_photo_name: file.name,
        photo_status: "photo_captured",
      });
      setMessage(`Cargo photo captured for parcel ${lineNo}. Press “Save This Parcel” or “Save All Parcel Records”.`);
    };
    reader.readAsDataURL(file);
  }

  async function saveParcel(parcel: ParcelDraft) {
    if (!selectedPickup) return false;

    const pickupId = safeText(selectedPickup.pickup_id || selectedPickup.pickup_way_id, "");

    const payload = {
      pickup_id: pickupId,
      pickup_way_id: selectedPickup.pickup_way_id || pickupId,
      line_no: parcel.line_no,
      row_no: parcel.line_no,
      waybill_no: parcel.waybill_no,
      delivery_way_id: parcel.delivery_way_id,
      parcel_weight: parcel.parcel_weight || 0,
      remarks: parcel.remarks || "",
      cargo_photo_url: parcel.cargo_photo_url || null,
      cargo_photo_data_url: parcel.cargo_photo_data_url || null,
      cargo_photo_name: parcel.cargo_photo_name || null,
      temp_qr_code: parcel.temp_qr_code,
    };

    const { data, error } = await (supabase as any).rpc("be_pickup_parcel_capture_save", {
      p_payload: payload,
    });

    if (error) {
      console.error(error);
      setMessage(`Save failed for parcel ${parcel.line_no}: ${error.message}`);
      return false;
    }

    updateParcel(parcel.line_no, {
      photo_status: data?.photo_status || "photo_uploaded",
      saved: true,
    });

    setMessage(`Parcel ${parcel.line_no} saved successfully.`);
    return true;
  }

  async function saveAllParcels() {
    let okCount = 0;

    for (const parcel of parcels) {
      const ok = await saveParcel(parcel);
      if (ok) okCount += 1;
    }

    setMessage(`Saved ${okCount}/${parcels.length} parcel record(s).`);
  }

  function ensureQr(parcel: ParcelDraft) {
    if (parcel.temp_qr_code) return parcel.temp_qr_code;
    const pickupId = safeText(selectedPickup?.pickup_id || selectedPickup?.pickup_way_id, "");
    const code = tempQrCode(pickupId, parcel.line_no);
    updateParcel(parcel.line_no, { temp_qr_code: code });
    return code;
  }

  function printQrCards(parcelList: ParcelDraft[]) {
    if (!selectedPickup) return;

    const pickupId = safeText(selectedPickup.pickup_id || selectedPickup.pickup_way_id, "");
    const merchant = safeText(selectedPickup.merchant_name, "");
    const cards = parcelList
      .map((parcel) => {
        const code = ensureQr(parcel);
        return `
          <div class="card">
            <h2>${pickupId}</h2>
            <p><b>Merchant:</b> ${merchant}</p>
            <p><b>Parcel:</b> ${parcel.line_no}/${parcels.length}</p>
            <p><b>Waybill:</b> ${parcel.waybill_no}</p>
            <p><b>Delivery Way ID:</b> ${parcel.delivery_way_id}</p>
            <img src="${qrImageUrl(code)}" />
            <h3>${code}</h3>
          </div>
        `;
      })
      .join("");

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>Temporary QR Codes - ${pickupId}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
            .card { border: 2px solid #111827; border-radius: 16px; padding: 18px; page-break-inside: avoid; }
            h2 { margin: 0 0 8px; color: #1d4ed8; }
            h3 { margin: 12px 0 0; font-family: monospace; }
            p { margin: 4px 0; }
            img { width: 180px; height: 180px; margin-top: 12px; }
            @media print { .card { break-inside: avoid; } }
          </style>
        </head>
        <body>
          <div class="grid">${cards}</div>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);

    win.document.close();
  }

  const filteredPickups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pickups;
    return pickups.filter((row) => JSON.stringify(row || "").toLowerCase().includes(q));
  }, [pickups, search]);

  useEffect(() => {
    loadAssignedPickups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickupId = safeText(selectedPickup?.pickup_id || selectedPickup?.pickup_way_id, "");
  const savedCount = parcels.filter((p) => p.saved).length;

  return (
    <div className="min-h-screen bg-[#eefafa]">
      <header className="sticky top-0 z-20 border-b-4 border-slate-950 bg-white/95 px-4 py-4 shadow-sm">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-[0.35em] text-blue-600">BRITIUM EXPRESS</p>
            <h1 className="text-2xl font-black text-slate-950">Rider Pickup Verification</h1>
          </div>
          <button
            onClick={loadAssignedPickups}
            disabled={loading}
            className="rounded-2xl bg-rose-500 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] space-y-5 px-4 py-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pickup ID / merchant"
              className="rounded-2xl border border-slate-300 px-5 py-4 text-base font-bold outline-none focus:border-blue-600"
            />
            <button
              onClick={loadAssignedPickups}
              className="rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white"
            >
              Search
            </button>
          </div>
          <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm font-black text-blue-900">{message}</div>
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black uppercase tracking-widest text-slate-700">Assigned Pickups</h2>
              <span className="rounded-full bg-rose-500 px-3 py-1 text-xs font-black text-white">
                {filteredPickups.length}
              </span>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              {filteredPickups.map((row) => {
                const id = safeText(row.pickup_id || row.pickup_way_id);
                const active = id === pickupId;

                return (
                  <button
                    key={row.id || id}
                    onClick={() => selectPickup(row)}
                    className={`w-full rounded-2xl border p-4 text-left ${
                      active ? "border-rose-500 bg-rose-50" : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <p className="font-mono text-base font-black text-rose-500">{id}</p>
                    <p className="mt-2 text-base font-black">{safeText(row.merchant_name)}</p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-500">
                      {safeText(row.pickup_address)}
                    </p>
                    <p className="mt-2 text-sm font-bold text-slate-500">
                      {safeText(row.parcel_count, "1")} parcels
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="space-y-4">
            {selectedPickup && (
              <>
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="font-mono text-xl font-black text-rose-500">{pickupId}</p>
                  <h2 className="mt-2 text-2xl font-black">{safeText(selectedPickup.merchant_name)}</h2>
                  <p className="mt-2 font-semibold text-slate-600">{safeText(selectedPickup.sender_phone)}</p>
                  <p className="mt-2 text-base font-semibold text-slate-700">{safeText(selectedPickup.pickup_address)}</p>

                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <p className="text-sm font-black uppercase tracking-widest text-slate-600">Batch Info</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <span>Parcels</span><b>{parcels.length}</b>
                      <span>Saved</span><b>{savedCount}/{parcels.length}</b>
                      <span>Rider</span><b>{safeText(selectedPickup.assigned_rider_name || selectedPickup.assigned_rider_code)}</b>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <button onClick={saveAllParcels} className="rounded-2xl bg-blue-700 px-5 py-4 font-black text-white">
                      Save All Parcel Records
                    </button>
                    <button onClick={() => printQrCards(parcels)} className="rounded-2xl bg-slate-950 px-5 py-4 font-black text-white">
                      Print All Temporary QR Codes
                    </button>
                  </div>
                </div>

                {parcels.map((parcel) => (
                  <article key={parcel.line_no} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-black uppercase tracking-widest text-slate-600">
                          Parcel {parcel.line_no}/{parcels.length}
                        </p>
                        <p className="mt-1 font-mono text-lg font-black">{parcel.waybill_no}</p>
                        <p className="mt-1 font-mono text-sm font-bold text-slate-500">{parcel.delivery_way_id}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            ensureQr(parcel);
                            setMessage(`Temporary QR generated for parcel ${parcel.line_no}.`);
                          }}
                          className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white"
                        >
                          Generate Temporary QR
                        </button>
                        <button
                          onClick={() => printQrCards([parcel])}
                          className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
                        >
                          Print This QR
                        </button>
                        <button
                          onClick={() => saveParcel(parcel)}
                          className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white"
                        >
                          Save This Parcel
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_240px]">
                      <div className="space-y-4">
                        <label className="block">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-600">Weight (KG)</span>
                          <input
                            value={parcel.parcel_weight}
                            onChange={(e) => updateParcel(parcel.line_no, { parcel_weight: e.target.value })}
                            inputMode="decimal"
                            placeholder="0.0"
                            className="mt-2 w-full rounded-2xl border border-slate-300 px-5 py-4 text-right text-lg font-black outline-none focus:border-blue-600"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-600">Parcel Remarks</span>
                          <textarea
                            value={parcel.remarks}
                            onChange={(e) => updateParcel(parcel.line_no, { remarks: e.target.value })}
                            placeholder="Fragile / special handling note..."
                            className="mt-2 min-h-[90px] w-full rounded-2xl border border-slate-300 px-5 py-4 font-semibold outline-none focus:border-blue-600"
                          />
                        </label>
                      </div>

                      <div className="space-y-3">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-600">Cargo Photo</p>

                        {parcel.cargo_photo_data_url || parcel.cargo_photo_url ? (
                          <img
                            src={parcel.cargo_photo_data_url || parcel.cargo_photo_url}
                            alt={`Cargo parcel ${parcel.line_no}`}
                            className="h-40 w-full rounded-2xl border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-40 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-center text-sm font-black text-slate-500">
                            No cargo photo yet
                          </div>
                        )}

                        <input
                          ref={(el) => {
                            fileRefs.current[parcel.line_no] = el;
                          }}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => onPhotoSelected(parcel.line_no, e.target.files?.[0])}
                        />

                        <button
                          onClick={() => fileRefs.current[parcel.line_no]?.click()}
                          className="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-4 font-black text-slate-700"
                        >
                          Capture / Upload Cargo Photo
                        </button>

                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-black uppercase text-slate-500">Temporary QR</p>
                          <img
                            src={qrImageUrl(parcel.temp_qr_code)}
                            alt={parcel.temp_qr_code}
                            className="mt-2 h-28 w-28 rounded-xl bg-white p-2"
                          />
                          <p className="mt-2 break-all font-mono text-xs font-black">{parcel.temp_qr_code}</p>
                        </div>

                        <div className={`rounded-xl px-4 py-3 text-sm font-black ${parcel.saved ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                          {parcel.saved ? "Saved" : "Not Saved"}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
