// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { useAppState } from "../hooks/useAppState";

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
  cargo_photo_file?: File;
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
  const safeLine = Math.max(1, Math.min(Number(lineNo || 1), 500));
  return `${prefix}${baseFromPickup(pickupId)}-${String(safeLine).padStart(3, "0")}`;
}

function tempQrCode(pickupId: string, lineNo: number) {
  return `TQR-${String(pickupId || "").toUpperCase()}-${String(lineNo).padStart(3, "0")}`;
}

function qrImageUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(value)}`;
}

async function compressPickupPhoto(file: File, maxBytes = 950 * 1024): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Select an image file.");
  if (file.size <= maxBytes) return file;

  const worker = new Worker(new URL("../workers/proofCompressionWorker.ts", import.meta.url), { type: "module" });
  try {
    const buffer = await file.arrayBuffer();
    return await new Promise<File>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("Photo compression timed out.")), 30_000);
      worker.onmessage = (event) => {
        window.clearTimeout(timer);
        if (!event.data?.ok) return reject(new Error(event.data?.error || "Photo compression failed."));
        resolve(new File([event.data.buffer], event.data.name || "pickup-proof.jpg", { type: event.data.type || "image/jpeg" }));
      };
      worker.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("Photo compression failed."));
      };
      worker.postMessage({ buffer, type: file.type, name: file.name, maxBytes, maxWidth: 1280, maxHeight: 720 }, [buffer]);
    });
  } finally {
    worker.terminate();
  }
}

function buildParcels(pickup: PickupRow): ParcelDraft[] {
  const pickupId = safeText(pickup.pickup_id || pickup.pickup_way_id, "");
  const count = Math.max(1, Math.min(Number(pickup.parcel_count || pickup.expected_parcels || 1), 500));

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
  const { language } = useAppState();
  const tx = (en:string,my:string) => language === "my" ? my : en;
  const params = useParams();
  const [pickups, setPickups] = useState<PickupRow[]>([]);
  const [selectedPickup, setSelectedPickup] = useState<PickupRow | null>(null);
  const [parcels, setParcels] = useState<ParcelDraft[]>([]);
  const [search, setSearch] = useState(params.pickupId || "");
  const [message, setMessage] = useState(language === "my" ? "တာဝန်ပေးထားသော Pickup များကို ဖွင့်နေသည်..." : "Loading assigned pickups...");
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [savingLine, setSavingLine] = useState<number | null>(null);
  const [parcelPage, setParcelPage] = useState(1);
  const pageSize = 20;
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  async function loadAssignedPickups() {
    setLoading(true);
    setMessage(tx("Loading Enterprise Pickup Requests...","Enterprise Pickup Request များကို ဖွင့်နေသည်..."));

    const { data, error } = await (supabase as any).rpc("be_field_pickup_request_options_v95", {
      p_limit: 300,
    });

    if (error) {
      console.error(error);
      setMessage(tx(`Failed to load Pickup Requests: ${error.message}`,`Pickup Request များကို ဖွင့်မရပါ: ${error.message}`));
      setLoading(false);
      return;
    }

    const rows = Array.isArray(data?.requests) ? data.requests : [];
    setPickups(rows);

    const requested = params.pickupId || search;
    const requestedRow = rows.find((row) => row.pickup_id === requested || row.pickup_way_id === requested);
    const first =
      (requestedRow?.can_open_workspace ? requestedRow : null) ||
      rows.find((row) => row.assigned_to_me && row.can_open_workspace) ||
      null;

    if (first) {
      await selectPickup(first);
    } else {
      setSelectedPickup(null);
      setParcels([]);
    }

    const assignedCount = Number(data?.counts?.assigned_to_me || 0);
    const waitingCount = Number(data?.counts?.waiting_assignment || 0);
    setMessage(
      tx(
        `Loaded ${rows.length} Enterprise Pickup Request(s): ${assignedCount} assigned to you, ${waitingCount} waiting assignment.`,
        `Enterprise Pickup Request ${rows.length} ခု ဖွင့်ပြီးပါပြီ။ သင့်ထံတာဝန်ပေးထားသည် ${assignedCount} ခု၊ တာဝန်ပေးရန်စောင့်နေသည် ${waitingCount} ခု။`
      )
    );
    setLoading(false);
  }

  async function selectPickup(row: PickupRow) {
    setSelectedPickup(row);

    const pickupId = safeText(row.pickup_id || row.pickup_way_id, "");

    setParcelPage(1);

    if (!row.can_open_workspace) {
      setParcels([]);
      const scope = String(row.assignment_scope || "");
      setMessage(
        scope === "WAITING_ASSIGNMENT"
          ? tx("This Pickup Request is visible but is waiting for Operations/Supervisor assignment. No parcel action is available yet.","ဤ Pickup Request ကို မြင်နိုင်သော်လည်း Operations/Supervisor မှ တာဝန်ပေးရန် စောင့်နေပါသည်။ Parcel လုပ်ဆောင်ချက်များ မရနိုင်သေးပါ။")
          : tx("This Pickup Request belongs to another field worker. Select one assigned to you.","ဤ Pickup Request ကို အခြား field worker တစ်ဦးထံ တာဝန်ပေးထားပါသည်။ သင့်ထံတာဝန်ပေးထားသော Pickup ကို ရွေးပါ။")
      );
      return;
    }

    if (!row.can_capture) {
      setParcels(buildParcels(row));
      setMessage(
        tx(
          `Pickup selected. Next action: ${String(row.next_action || "REFRESH").replaceAll("_"," ")}.`,
          `Pickup ရွေးပြီးပါပြီ။ နောက်လုပ်ဆောင်ရန်: ${String(row.next_action || "REFRESH").replaceAll("_"," ")}။`
        )
      );
      return;
    }

    const { data, error } = await (supabase as any).rpc("be_pickup_parcel_capture_snapshot", {
      p_pickup_id: pickupId,
    });
    if (error) {
      console.error(error);
      setMessage(error.message);
      setParcels(buildParcels(row));
      return;
    }

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

  async function performPickupAction(action: string) {
    if (!selectedPickup) return;
    const pickupId = safeText(selectedPickup.pickup_id || selectedPickup.pickup_way_id, "");
    setActionBusy(action);
    try {
      const { data, error } = await (supabase as any).rpc("be_field_team_pickup_action", {
        p_payload: { pickup_id: pickupId, action },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data?.error || "Pickup action failed.");

      setMessage(
        tx(
          `${pickupId}: ${String(action).replaceAll("_"," ")} completed successfully.`,
          `${pickupId}: ${String(action).replaceAll("_"," ")} လုပ်ဆောင်မှု အောင်မြင်ပါသည်။`
        )
      );

      await loadAssignedPickups();
      const { data: refreshed } = await (supabase as any).rpc("be_field_pickup_request_options_v95", { p_limit: 300 });
      const current = (Array.isArray(refreshed?.requests) ? refreshed.requests : []).find(
        (row:any) => String(row.pickup_id || row.pickup_way_id) === pickupId
      );
      if (current) await selectPickup(current);
    } catch (error:any) {
      console.error(error);
      setMessage(error?.message || tx("Pickup action failed.","Pickup လုပ်ဆောင်မှု မအောင်မြင်ပါ။"));
    } finally {
      setActionBusy("");
    }
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

    setMessage(tx(`Preparing cargo photo for parcel ${lineNo}...`,`Parcel ${lineNo} အတွက် ကုန်ပစ္စည်းဓာတ်ပုံကို ပြင်ဆင်နေသည်...`));
    try {
      const compressed = await compressPickupPhoto(file);
      const reader = new FileReader();
      reader.onload = () => {
        updateParcel(lineNo, {
          cargo_photo_data_url: String(reader.result || ""),
          cargo_photo_file: compressed,
          cargo_photo_url: "",
          cargo_photo_name: compressed.name,
          photo_status: "photo_ready_for_upload",
        });
        setMessage(tx(`Cargo photo ready for parcel ${lineNo}. It will upload to Enterprise proof storage when saved.`,`Parcel ${lineNo} အတွက် ကုန်ပစ္စည်းဓာတ်ပုံ အဆင်သင့်ဖြစ်ပါပြီ။ သိမ်းဆည်းချိန်တွင် Enterprise သက်သေသိုလှောင်မှုသို့ တင်ပါမည်။`));
      };
      reader.readAsDataURL(compressed);
    } catch (error: any) {
      setMessage(error?.message || `Unable to prepare parcel ${lineNo} photo.`);
    }
  }

  async function ensurePhotoUploaded(parcel: ParcelDraft, pickupId: string) {
    if (parcel.cargo_photo_url) return parcel.cargo_photo_url;
    if (!parcel.cargo_photo_file) throw new Error(`Parcel ${parcel.line_no} requires an approved cargo photo.`);

    const extension = parcel.cargo_photo_file.name.split(".").pop() || "jpg";
    const path = `pickup/${pickupId}/${parcel.delivery_way_id}/${Date.now()}-${parcel.line_no}.${extension}`;
    const { error } = await supabase.storage.from("rider-proofs").upload(path, parcel.cargo_photo_file, {
      upsert: false,
      contentType: parcel.cargo_photo_file.type || "image/jpeg",
    });
    if (error) throw error;

    const { data } = supabase.storage.from("rider-proofs").getPublicUrl(path);
    const url = data?.publicUrl;
    if (!url) throw new Error("Unable to create Rider proof URL.");

    updateParcel(parcel.line_no, {
      cargo_photo_url: url,
      cargo_photo_file: undefined,
      photo_status: "photo_uploaded",
    });
    return url;
  }

  async function saveParcel(parcel: ParcelDraft) {
    if (!selectedPickup) return false;
    if (!selectedPickup.can_capture) {
      setMessage(tx("Arrive at pickup before saving parcel verification.","Parcel စစ်ဆေးမှု သိမ်းဆည်းမီ Pickup နေရာသို့ ရောက်ရှိကြောင်း အရင်မှတ်တမ်းတင်ပါ။"));
      return false;
    }
    const weight = Number(parcel.parcel_weight || 0);
    if (!Number.isFinite(weight) || weight <= 0) {
      setMessage(tx(`Parcel ${parcel.line_no}: enter actual weight greater than 0.`,`Parcel ${parcel.line_no}: အလေးချိန် 0 ထက်ကြီးသောတန်ဖိုး ထည့်ပါ။`));
      return false;
    }
    if (!parcel.cargo_photo_file && !parcel.cargo_photo_url) {
      setMessage(tx(`Parcel ${parcel.line_no}: capture or upload a cargo photo first.`,`Parcel ${parcel.line_no}: ကုန်ပစ္စည်းဓာတ်ပုံကို အရင်ရိုက်ယူ သို့မဟုတ် Upload တင်ပါ။`));
      return false;
    }

    setSavingLine(parcel.line_no);
    const pickupId = safeText(selectedPickup.pickup_id || selectedPickup.pickup_way_id, "");

    let durablePhotoUrl = parcel.cargo_photo_url || "";
    try {
      durablePhotoUrl = await ensurePhotoUploaded(parcel, pickupId);
    } catch (error: any) {
      setMessage(error?.message || `Photo upload failed for parcel ${parcel.line_no}.`);
      setSavingLine(null);
      return false;
    }

    const payload = {
      pickup_id: pickupId,
      pickup_way_id: selectedPickup.pickup_way_id || pickupId,
      line_no: parcel.line_no,
      row_no: parcel.line_no,
      waybill_no: parcel.waybill_no,
      delivery_way_id: parcel.delivery_way_id,
      parcel_weight: parcel.parcel_weight || 0,
      remarks: parcel.remarks || "",
      cargo_photo_url: durablePhotoUrl,
      cargo_photo_data_url: null,
      cargo_photo_name: parcel.cargo_photo_name || null,
      temp_qr_code: parcel.temp_qr_code,
    };

    const { data, error } = await (supabase as any).rpc("be_pickup_parcel_capture_save", {
      p_payload: payload,
    });

    if (error) {
      console.error(error);
      setMessage(`Save failed for parcel ${parcel.line_no}: ${error.message}`);
      setSavingLine(null);
      return false;
    }

    updateParcel(parcel.line_no, {
      photo_status: data?.photo_status || "photo_uploaded",
      saved: true,
    });

    setMessage(tx(`Parcel ${parcel.line_no} saved successfully.`,`Parcel ${parcel.line_no} ကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။`));
    setSavingLine(null);
    return true;
  }

  async function submitPickupVerification() {
    if (!selectedPickup) return;
    const pickupId = safeText(selectedPickup.pickup_id || selectedPickup.pickup_way_id, "");
    const validSaved = parcels.filter((p) => p.saved);
    if (validSaved.length === 0) {
      setMessage(tx("Save at least one parcel with weight and photo before submitting verification.","Verification မတင်မီ အလေးချိန်နှင့် ဓာတ်ပုံပါ Parcel အနည်းဆုံးတစ်ခု သိမ်းဆည်းပါ။"));
      return;
    }
    setActionBusy("verify");
    try {
      const { data, error } = await (supabase as any).rpc("be_field_team_pickup_action", {
        p_payload: { pickup_id: pickupId, action: "verify" },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data?.error || "Verification submit failed.");
      setMessage(data?.message || tx("Pickup verification submitted.","Pickup verification တင်သွင်းပြီးပါပြီ။"));
      await loadAssignedPickups();
    } catch (error:any) {
      setMessage(error?.message || tx("Verification submit failed.","Verification တင်သွင်းမှု မအောင်မြင်ပါ။"));
    } finally {
      setActionBusy("");
    }
  }

  async function saveAllParcels() {
    const readyParcels = parcels.filter((parcel) => {
      const weight = Number(parcel.parcel_weight || 0);
      const hasPhoto = Boolean(parcel.cargo_photo_file || parcel.cargo_photo_url || parcel.cargo_photo_data_url);
      return Number.isFinite(weight) && weight > 0 && hasPhoto;
    });

    if (readyParcels.length === 0) {
      setMessage(tx(
        "No parcel is ready to save yet. Enter weight and capture/upload a cargo photo first.",
        "သိမ်းရန် အဆင်သင့်ဖြစ်သော Parcel မရှိသေးပါ။ အလေးချိန်ထည့်ပြီး ကုန်ပစ္စည်းဓာတ်ပုံကို ရိုက်ယူ/Upload တင်ပါ။"
      ));
      return;
    }

    let okCount = 0;
    for (const parcel of readyParcels) {
      const ok = await saveParcel(parcel);
      if (ok) okCount += 1;
    }

    setMessage(tx(
      `Saved ${okCount}/${readyParcels.length} ready parcel record(s).`,
      `သိမ်းရန်အဆင်သင့် Parcel ${okCount}/${readyParcels.length} ကို သိမ်းဆည်းပြီးပါပြီ။`
    ));
  }

  async function uploadAllPhotosForReview() {
    const withPhotos = parcels.filter((parcel) => parcel.cargo_photo_data_url || parcel.cargo_photo_url);
    if (withPhotos.length === 0) {
      setMessage(tx("Capture at least one cargo photo before using Upload All.","Upload All မလုပ်မီ ကုန်ပစ္စည်းဓာတ်ပုံ အနည်းဆုံးတစ်ပုံ ရိုက်ယူပါ။"));
      return;
    }
    let okCount = 0;
    for (const parcel of withPhotos) {
      const ok = await saveParcel(parcel);
      if (ok) okCount += 1;
    }
    setMessage(tx(`Upload All completed: ${okCount}/${withPhotos.length} photo parcel(s) sent for review.`,`Upload All ပြီးပါပြီ။ ဓာတ်ပုံပါ Parcel ${okCount}/${withPhotos.length} ကို စစ်ဆေးရန် ပို့ပြီးပါပြီ။`));
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
  const readyToSaveCount = parcels.filter((parcel) => {
    const weight = Number(parcel.parcel_weight || 0);
    const hasPhoto = Boolean(parcel.cargo_photo_file || parcel.cargo_photo_url || parcel.cargo_photo_data_url);
    return Number.isFinite(weight) && weight > 0 && hasPhoto && !parcel.saved;
  }).length;
  const nextAction = String(selectedPickup?.next_action || "");
  const canCapture = Boolean(selectedPickup?.can_capture);
  const parcelPageCount = Math.max(1, Math.ceil(parcels.length / pageSize));
  const pagedParcels = parcels.slice((parcelPage - 1) * pageSize, parcelPage * pageSize);

  return (
    <div className="min-h-screen bg-[#eefafa]">
      <header className="sticky top-0 z-20 border-b-4 border-slate-950 bg-white/95 px-4 py-4 shadow-sm">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-[0.35em] text-blue-600">BRITIUM EXPRESS</p>
            <h1 className="text-2xl font-black text-slate-950">{tx("Rider Pickup Verification","Rider Pickup စစ်ဆေးအတည်ပြုခြင်း")}</h1>
          </div>
          <button
            onClick={loadAssignedPickups}
            disabled={loading}
            className="rounded-2xl bg-rose-500 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {loading ? tx("Loading...","ဖွင့်နေသည်...") : tx("Refresh","ပြန်ဖွင့်ရန်")}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] space-y-5 px-4 py-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="mb-4 block">
            <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-600">
              {tx("Enterprise Pickup Request","Enterprise Pickup Request")}
            </span>
            <select
              value={pickupId}
              onChange={(e) => {
                const row = pickups.find((item) => String(item.pickup_id || item.pickup_way_id) === e.target.value);
                if (row) void selectPickup(row);
              }}
              className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-base font-black outline-none focus:border-blue-600"
            >
              <option value="">{tx("Select Pickup Request","Pickup Request ရွေးပါ")}</option>
              {pickups.map((row) => {
                const id = safeText(row.pickup_id || row.pickup_way_id, "");
                const scope = String(row.assignment_scope || "");
                const stateLabel =
                  scope === "ASSIGNED_TO_ME"
                    ? tx("Assigned to me","ကျွန်ုပ်ထံတာဝန်ပေးထားသည်")
                    : scope === "WAITING_ASSIGNMENT"
                      ? tx("Waiting assignment","တာဝန်ပေးရန်စောင့်နေသည်")
                      : tx("Assigned to other","အခြားသူထံတာဝန်ပေးထားသည်");
                return (
                  <option key={row.id || id} value={id} disabled={!row.can_open_workspace}>
                    {id} — {safeText(row.merchant_name || row.merchant_code)} — {safeText(row.parcel_count, "1")} — {stateLabel}
                  </option>
                );
              })}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tx("Search pickup ID / merchant","Pickup ID / ကုန်သည် ရှာရန်")}
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
              <h2 className="font-black uppercase tracking-widest text-slate-700">{tx("Assigned Pickups","တာဝန်ပေးထားသော Pickup များ")}</h2>
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
                      {safeText(row.parcel_count, "1")} {tx("parcels","Parcel")}
                    </p>
                    <p className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-black ${
                      row.assignment_scope === "ASSIGNED_TO_ME"
                        ? "bg-emerald-100 text-emerald-800"
                        : row.assignment_scope === "WAITING_ASSIGNMENT"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-200 text-slate-700"
                    }`}>
                      {row.assignment_scope === "ASSIGNED_TO_ME"
                        ? tx("Assigned to me","ကျွန်ုပ်ထံတာဝန်ပေးထားသည်")
                        : row.assignment_scope === "WAITING_ASSIGNMENT"
                          ? tx("Waiting assignment","တာဝန်ပေးရန်စောင့်နေသည်")
                          : tx("Assigned to other","အခြားသူထံတာဝန်ပေးထားသည်")}
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="space-y-4">
            {selectedPickup && (
              <>
                <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">{tx("Pickup Workflow","Pickup လုပ်ငန်းစဉ်")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["ASSIGN","ACCEPT","START","ARRIVE","VERIFY","COLLECT","WAREHOUSE"].map((step) => (
                      <span key={step} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-black text-slate-700">{step}</span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-700">
                    {tx("Current status","လက်ရှိအခြေအနေ")}: {safeText(selectedPickup.mobile_status || selectedPickup.role_assignment_status || selectedPickup.assignment_status)}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-700">
                    {tx("Next action","နောက်လုပ်ဆောင်ရန်")}: {safeText(selectedPickup.next_action).replaceAll("_"," ")}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {nextAction === "ACCEPT_ASSIGNMENT" && (
                      <button onClick={() => performPickupAction("accept")} disabled={!!actionBusy} className="rounded-2xl bg-emerald-600 px-5 py-3 font-black text-white disabled:opacity-50">
                        {actionBusy === "accept" ? tx("Accepting...","လက်ခံနေသည်...") : tx("Accept Assignment","တာဝန်လက်ခံရန်")}
                      </button>
                    )}
                    {nextAction === "START_PICKUP" && (
                      <button onClick={() => performPickupAction("start_pickup")} disabled={!!actionBusy} className="rounded-2xl bg-blue-700 px-5 py-3 font-black text-white disabled:opacity-50">
                        {tx("Start Pickup Trip","Pickup ခရီးစတင်ရန်")}
                      </button>
                    )}
                    {nextAction === "ARRIVE_AT_PICKUP" && (
                      <button onClick={() => performPickupAction("arrived_at_pickup")} disabled={!!actionBusy} className="rounded-2xl bg-indigo-700 px-5 py-3 font-black text-white disabled:opacity-50">
                        {tx("Arrived at Pickup","Pickup နေရာသို့ ရောက်ရှိပြီ")}
                      </button>
                    )}
                    {nextAction === "CAPTURE_AND_VERIFY" && (
                      <button onClick={submitPickupVerification} disabled={!!actionBusy || savedCount === 0} className="rounded-2xl bg-violet-700 px-5 py-3 font-black text-white disabled:opacity-40">
                        {tx("Submit Verification","Verification တင်သွင်းရန်")}
                      </button>
                    )}
                    {nextAction === "COLLECT_PICKUP" && (
                      <button onClick={() => performPickupAction("collect_pickup")} disabled={!!actionBusy} className="rounded-2xl bg-emerald-700 px-5 py-3 font-black text-white disabled:opacity-50">
                        {tx("Confirm Pickup Collected","Pickup ကောက်ယူပြီး အတည်ပြုရန်")}
                      </button>
                    )}
                    {nextAction === "HANDOFF_TO_WAREHOUSE" && (
                      <button onClick={() => performPickupAction("handoff_to_warehouse")} disabled={!!actionBusy} className="rounded-2xl bg-slate-900 px-5 py-3 font-black text-white disabled:opacity-50">
                        {tx("Handoff to Warehouse","Warehouse သို့ လွှဲပြောင်းရန်")}
                      </button>
                    )}
                    {nextAction === "WAIT_FOR_TEAM_ACCEPTANCE" && (
                      <div className="rounded-2xl bg-amber-100 px-4 py-3 text-sm font-black text-amber-900">
                        {tx("Waiting for the rest of the assigned field team to accept.","တာဝန်ပေးထားသော အခြား field team များ လက်ခံရန် စောင့်နေပါသည်။")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="font-mono text-xl font-black text-rose-500">{pickupId}</p>
                  <h2 className="mt-2 text-2xl font-black">{safeText(selectedPickup.merchant_name)}</h2>
                  <p className="mt-2 font-semibold text-slate-600">{safeText(selectedPickup.sender_phone)}</p>
                  <p className="mt-2 text-base font-semibold text-slate-700">{safeText(selectedPickup.pickup_address)}</p>

                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <p className="text-sm font-black uppercase tracking-widest text-slate-600">{tx("Batch Info","Batch အချက်အလက်")}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <span>{tx("Parcels","Parcel များ")}</span><b>{parcels.length}</b>
                      <span>{tx("Saved","သိမ်းပြီး")}</span><b>{savedCount}/{parcels.length}</b>
                      <span>{tx("Rider","Rider")}</span><b>{safeText(selectedPickup.assigned_rider_name || selectedPickup.assigned_rider_code)}</b>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-3">
                    <p className="mb-2 text-sm font-black text-blue-950">
                      {tx(
                        `${readyToSaveCount} parcel(s) ready to save · ${savedCount}/${parcels.length} saved`,
                        `သိမ်းရန်အဆင်သင့် ${readyToSaveCount} Parcel · သိမ်းပြီး ${savedCount}/${parcels.length}`
                      )}
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <button disabled={!canCapture || !!actionBusy || readyToSaveCount === 0} onClick={saveAllParcels} className="rounded-2xl bg-blue-700 px-5 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                      {tx("Save All Ready Parcels","အဆင်သင့် Parcel အားလုံး သိမ်းရန်")}
                    </button>
                    <button disabled={!canCapture || !!actionBusy} onClick={uploadAllPhotosForReview} className="rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                      {tx("Upload All Photos for Review","ဓာတ်ပုံအားလုံး စစ်ဆေးရန် တင်ရန်")}
                    </button>
                    <button onClick={() => printQrCards(parcels)} className="rounded-2xl bg-slate-950 px-5 py-4 font-black text-white">
                      {tx("Print All Temporary QR Codes","ယာယီ QR Code အားလုံး ပုံနှိပ်ရန်")}
                    </button>
                    </div>
                  </div>
                </div>

                {pagedParcels.map((parcel) => (
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
                          {tx("Generate Temporary QR","ယာယီ QR ထုတ်ရန်")}
                        </button>
                        <button
                          onClick={() => printQrCards([parcel])}
                          className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
                        >
                          Print This QR
                        </button>
                        <button
                          disabled={!canCapture || savingLine === parcel.line_no}
                          onClick={() => saveParcel(parcel)}
                          className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {savingLine === parcel.line_no ? tx("Saving...","သိမ်းနေသည်...") : tx("Save This Parcel","ဤ Parcel ကို သိမ်းရန်")}
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
                          disabled={!canCapture}
                          onClick={() => fileRefs.current[parcel.line_no]?.click()}
                          className="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-4 font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
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
                          {parcel.saved ? tx("Saved","သိမ်းပြီး") : tx("Not Saved","မသိမ်းရသေး")}
                        </div>

                        {!parcel.saved && (
                          <button
                            type="button"
                            disabled={!canCapture || savingLine === parcel.line_no}
                            onClick={() => saveParcel(parcel)}
                            className="w-full rounded-2xl bg-blue-700 px-4 py-4 font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {savingLine === parcel.line_no
                              ? tx("Saving Photo & Parcel...","ဓာတ်ပုံနှင့် Parcel ကို သိမ်းနေသည်...")
                              : tx("Save Photo & Parcel","ဓာတ်ပုံနှင့် Parcel ကို သိမ်းရန်")}
                          </button>
                        )}

                        {!parcel.saved && (
                          <p className="text-xs font-bold leading-5 text-slate-500">
                            {tx(
                              "Enter weight, capture/upload the cargo photo, then press Save Photo & Parcel.",
                              "အလေးချိန်ထည့်ပါ၊ ကုန်ပစ္စည်းဓာတ်ပုံ ရိုက်ယူ/Upload တင်ပါ၊ ပြီးနောက် ဓာတ်ပုံနှင့် Parcel ကို သိမ်းရန် ကိုနှိပ်ပါ။"
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                ))}

                {parcels.length > pageSize && (
                  <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <button
                      type="button"
                      disabled={parcelPage <= 1}
                      onClick={() => setParcelPage((p) => Math.max(1,p-1))}
                      className="rounded-xl border border-slate-300 px-4 py-2 font-black disabled:opacity-40"
                    >
                      {tx("Previous","နောက်သို့")}
                    </button>
                    <span className="text-sm font-black text-slate-700">
                      {tx("Page","စာမျက်နှာ")} {parcelPage}/{parcelPageCount} · {parcels.length} {tx("parcels","Parcel")}
                    </span>
                    <button
                      type="button"
                      disabled={parcelPage >= parcelPageCount}
                      onClick={() => setParcelPage((p) => Math.min(parcelPageCount,p+1))}
                      className="rounded-xl border border-slate-300 px-4 py-2 font-black disabled:opacity-40"
                    >
                      {tx("Next","ရှေ့သို့")}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
