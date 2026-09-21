// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { useAppState } from "../hooks/useAppState";

const PAYMENT_METHODS = ["CASH", "PREPAID", "QR", "BANK_TRANSFER", "MOBILE_WALLET"];
const PROOF_MAX_BYTES = 950 * 1024;
const UPLOAD_TIMEOUT_MS = 120_000;
const FALLBACK_FAILED_REASONS = [
  ["PHONE_OFF", "ဖုန်းစက်ပိတ်ထားသည်။ / Phone switched off"],
  ["PHONE_OUT_OF_COVERAGE", "ဖုန်းဆက်သွယ်မှုဧရိယာပြင်ပသို့ရောက်ရှိနေသည်။ / Outside coverage"],
  ["NO_ANSWER", "ဖုန်းမကိုင်ပါ။ / Customer did not answer"],
  ["CUSTOMER_NOT_AVAILABLE", "Customer not available"],
  ["CUSTOMER_REFUSED", "Customer refused"],
  ["WRONG_ADDRESS", "Wrong address"],
  ["COD_NOT_READY", "COD not ready"],
  ["NO_ACCESS_TO_BUILDING", "No access to building"],
  ["PARCEL_DAMAGED", "Parcel damaged"],
  ["WEATHER_TRAFFIC_ISSUE", "Weather / traffic issue"],
  ["CUSTOMER_REQUESTED_RESCHEDULE", "Delivery date postponed / changed by customer"],
  ["OTHER", "Other"],
];

async function compressImage(file: File, maxBytes = 950 * 1024): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Select an image file.");
  if (file.size <= maxBytes && file.size <= PROOF_MAX_BYTES) return file;
  const worker = new Worker(new URL("../workers/proofCompressionWorker.ts", import.meta.url), { type: "module" });
  try {
    const buffer = await file.arrayBuffer();
    return await new Promise<File>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("Photo compression timed out.")), 30_000);
      worker.onmessage = (event) => {
        window.clearTimeout(timer);
        if (!event.data?.ok) return reject(new Error(event.data?.error || "Photo compression failed."));
        resolve(new File([event.data.buffer], event.data.name || "proof.jpg", { type: event.data.type || "image/jpeg" }));
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

async function withTimeout<T>(promise: Promise<T>, ms = UPLOAD_TIMEOUT_MS): Promise<T> {
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error("Upload timed out. Check the mobile network and retry.")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    window.clearTimeout(timer);
  }
}

function jobsFromResponse(data: any) {
  if (Array.isArray(data?.jobs)) return data.jobs;
  if (Array.isArray(data)) return data;
  return [];
}

function safeName(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

async function currentGps() {
  if (!navigator.geolocation) return {};
  return await new Promise<any>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ gps_lat: pos.coords.latitude, gps_lng: pos.coords.longitude }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 },
    );
  });
}

export default function DeliveryPage() {
  const { language } = useAppState();
  const tx = (en:string,my:string) => language === "my" ? my : en;
  const [pickups, setPickups] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [approvedProofFile, setApprovedProofFile] = useState<File | null>(null);
  const [proofState, setProofState] = useState<"idle" | "compressing" | "ready" | "approved">("idle");
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState("");
  const [signaturePreview, setSignaturePreview] = useState("");
  const [busy, setBusy] = useState(false);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [form, setForm] = useState({
    receiver_name: "",
    receiver_phone: "",
    remarks: "",
    payment_method: "CASH",
    transaction_reference: "",
    cod_collected: "",
    failed_reason: "NO_ANSWER",
    signature_name: "",
    reschedule_date: "",
  });
  const [failureReasons, setFailureReasons] = useState<any[]>(FALLBACK_FAILED_REASONS);
  const [msg, setMsg] = useState(language === "my" ? "ပို့ဆောင်ရေးအလုပ်များကို ဖွင့်နေသည်..." : "Loading delivery jobs...");

  const requiredCod = Number(selected?.cod_amount || 0);
  const status = String(selected?.stop_status || selected?.rider_status || "").toUpperCase();
  const electronicPayment = ["QR", "BANK_TRANSFER", "MOBILE_WALLET"].includes(form.payment_method);
  const canDeliver = status === "ARRIVED_AT_CUSTOMER";

  function resetProofs() {
    setProofFile(null);
    setApprovedProofFile(null);
    setProofState("idle");
    setSignatureFile(null);
    setProofPreview("");
    setSignaturePreview("");
  }

  function selectJob(job: any) {
    setSelected(job);
    resetProofs();
    setForm((current) => ({
      ...current,
      receiver_name: job.receiver_name || job.recipient_name || "",
      receiver_phone: job.receiver_phone || job.recipient_phone || "",
      cod_collected: String(job.cod_collected ?? job.cod_amount ?? ""),
      transaction_reference: "",
      remarks: "",
      signature_name: "",
      failed_reason: "NO_ANSWER",
    }));
  }

  async function load(preferredDeliveryWayId?: string) {
    setMsg(tx("Loading assigned Wayplan deliveries...","တာဝန်ပေးထားသော Wayplan ပို့ဆောင်မှုများကို ဖွင့်နေသည်..."));
    const [jobsResult, reasonResult] = await Promise.all([
      (supabase as any).rpc("be_rider_delivery_wayplan_jobs", {
        p_rider_code: null,
        p_limit: 200,
      }),
      (supabase as any).rpc("be_field_delivery_failure_reasons_v92"),
    ]);
    if (jobsResult.error) return setMsg(jobsResult.error.message);

    const enterpriseReasons = Array.isArray(reasonResult.data?.reasons) ? reasonResult.data.reasons : [];
    if (!reasonResult.error && enterpriseReasons.length) {
      setFailureReasons(
        enterpriseReasons.map((r: any) => [
          r.code,
          [r.name_mm, r.name_en].filter(Boolean).join(" / ") || r.code,
        ])
      );
    }

    const list = jobsFromResponse(jobsResult.data);
    setPickups(list);
    const next =
      list.find((job: any) => job.delivery_way_id === preferredDeliveryWayId) ||
      list.find((job: any) => !["DELIVERED", "FAILED_DELIVERY", "RETURN_TO_WAREHOUSE"].includes(String(job.stop_status || "").toUpperCase())) ||
      list[0] ||
      null;
    if (next) selectJob(next);
    else setSelected(null);
    setMsg(tx(`Loaded ${list.length} assigned delivery stop(s).`,`တာဝန်ပေးထားသော ပို့ဆောင်မှတ်တိုင် ${list.length} ခု ဖွင့်ပြီးပါပြီ။`));
  }

  async function choosePhoto(file?: File) {
    if (!file) return;
    setProofState("compressing");
    setApprovedProofFile(null);
    try {
      const compressed = await compressImage(file, 950 * 1024);
      if (compressed.size > PROOF_MAX_BYTES) throw new Error("Proof photo remains larger than 950 KB after compression.");
      setProofFile(compressed);
      setProofPreview(URL.createObjectURL(compressed));
      setProofState("ready");
      setMsg(`Proof compressed to ${Math.ceil(compressed.size / 1024)} KB. Review it, then press “{tx("Approve photo & upload","ဓာတ်ပုံအတည်ပြုပြီး Upload တင်ရန်")}”.`);
    } catch (error: any) {
      setProofFile(null);
      setProofPreview("");
      setProofState("idle");
      setMsg(error?.message || "Unable to prepare proof photo.");
    }
  }

  function approveProofPhoto() {
    if (!proofFile) return setMsg("Capture a proof photo first.");
    setApprovedProofFile(proofFile);
    setProofState("approved");
    setMsg("Delivery proof approved. It will upload only when delivery is confirmed.");
  }

  function canvasPoint(event: any) {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const point = event.touches?.[0] || event;
    return { x: (point.clientX - rect.left) * (canvas.width / rect.width), y: (point.clientY - rect.top) * (canvas.height / rect.height) };
  }

  function startSignature(event: any) {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    event.preventDefault();
    drawingRef.current = true;
    const p = canvasPoint(event);
    const ctx = canvas.getContext("2d");
    ctx?.beginPath();
    ctx?.moveTo(p.x, p.y);
  }

  function drawSignature(event: any) {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !drawingRef.current) return;
    event.preventDefault();
    const p = canvasPoint(event);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function stopSignature(event?: any) {
    event?.preventDefault?.();
    drawingRef.current = false;
  }

  function clearSignatureCanvas() {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function signatureCanvasFile() {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hasInk = false;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] > 0) { hasInk = true; break; }
    }
    if (!hasInk) return null;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return blob ? new File([blob], "customer-signature.png", { type: "image/png" }) : null;
  }

  function chooseSignature(file?: File) {
    if (!file) return;
    setSignatureFile(file);
    setSignaturePreview(URL.createObjectURL(file));
  }

  async function upload(bucket: "rider-proofs" | "ops-signatures", file: File, prefix: string) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user?.id) throw new Error("Sign in before uploading proof.");
    const path = `${auth.user.id}/${prefix}/${safeName(file)}`;
    const result = await withTimeout(supabase.storage.from(bucket).upload(path, file, {
      upsert: false,
      contentType: file.type || "image/jpeg",
    }) as any, UPLOAD_TIMEOUT_MS);
    if (result.error) throw result.error;
    if (bucket === "rider-proofs") {
      return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    }
    return path;
  }

  async function act(action: string, extra: any = {}) {
    if (!selected) return setMsg(tx("Select a delivery stop first.","ပို့ဆောင်မည့် Way ကို အရင်ရွေးပါ။"));
    setBusy(true);
    try {
      const payload = {
        wayplan_id: selected.wayplan_id,
        delivery_way_id: selected.delivery_way_id,
        action,
        ...extra,
      };
      const { data, error } = await (supabase as any).rpc("be_rider_wayplan_action", { p_payload: payload });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data?.error || "Rider action failed.");
      setMsg(`${selected.delivery_way_id}: ${data?.status || action} saved.`);
      await load(selected.delivery_way_id);
    } catch (error: any) {
      setMsg(error?.message || "Unable to save Rider action.");
    } finally {
      setBusy(false);
    }
  }

  async function deliver() {
    if (!selected) return setMsg(tx("Select a delivery stop first.","ပို့ဆောင်မည့် Way ကို အရင်ရွေးပါ။"));
    if (!canDeliver) return setMsg(tx("Record Arrived at Customer before confirming delivery.","ပို့ဆောင်ပြီးအတည်ပြုမီ Customer နေရာသို့ ရောက်ရှိကြောင်း အရင်မှတ်တမ်းတင်ပါ။"));
    if (!form.receiver_name.trim()) return setMsg(tx("Receiver name is required.","လက်ခံသူအမည် ဖြည့်ရန်လိုအပ်ပါသည်။"));
    if (!approvedProofFile) return setMsg(tx("Capture, review and approve the delivery proof photo first.","ပို့ဆောင်မှုဓာတ်ပုံကို ရိုက်ယူ၊ စစ်ဆေးပြီး အတည်ပြုပါ။"));
    const drawnSignature = await signatureCanvasFile();
    if (!signatureFile && !drawnSignature && !form.signature_name.trim()) return setMsg(tx("Customer electronic signature is required.","Customer အီလက်ထရွန်နစ်လက်မှတ် လိုအပ်ပါသည်။"));
    if (requiredCod > 0 && Number(form.cod_collected || 0) !== requiredCod) {
      return setMsg(tx(`COD collected must equal required COD: ${requiredCod.toLocaleString()} Ks.`,`ကောက်ခံပြီး COD သည် ရရှိရမည့် COD ${requiredCod.toLocaleString()} Ks နှင့် တူညီရပါမည်။`));
    }
    if (electronicPayment && !form.transaction_reference.trim()) {
      return setMsg(tx("Transaction reference is required for electronic payment.","အီလက်ထရွန်နစ်ငွေပေးချေမှုအတွက် ငွေလွှဲအမှတ် လိုအပ်ပါသည်။"));
    }

    setBusy(true);
    try {
      const prefix = `${selected.wayplan_id}/${selected.delivery_way_id}`;
      const proof_url = await upload("rider-proofs", approvedProofFile, prefix);
      const finalSignatureFile = signatureFile || drawnSignature;
      const signature_path = finalSignatureFile
        ? await upload("ops-signatures", finalSignatureFile, prefix)
        : null;
      const gps = await currentGps();
      const signature_payload = form.signature_name.trim()
        ? {
            method: "CUSTOMER_TYPED_ACKNOWLEDGEMENT",
            signed_name: form.signature_name.trim(),
            signed_at: new Date().toISOString(),
          }
        : {};

      const { data, error } = await (supabase as any).rpc("be_rider_wayplan_action", {
        p_payload: {
          wayplan_id: selected.wayplan_id,
          delivery_way_id: selected.delivery_way_id,
          action: "deliver",
          receiver_name: form.receiver_name.trim(),
          receiver_phone: form.receiver_phone.trim() || null,
          proof_url,
          signature_path,
          signature_payload,
          payment_method: form.payment_method,
          transaction_reference: form.transaction_reference.trim() || null,
          cod_collected: Number(form.cod_collected || 0),
          remark: form.remarks.trim() || null,
          ...gps,
        },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data?.error || "Delivery confirmation failed.");

      setMsg(`${selected.delivery_way_id}: delivery confirmed with proof, payment and signature.`);
      resetProofs();
      await load(selected.delivery_way_id);
    } catch (error: any) {
      setMsg(error?.message || "Delivery confirmation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function arriveAtCustomer() {
    if (!selected) return setMsg(tx("Select a delivery stop first.","ပို့ဆောင်မည့် Way ကို အရင်ရွေးပါ။"));
    const gps = await currentGps();
    if (!gps.gps_lat || !gps.gps_lng) return setMsg(tx("GPS permission is required to record arrival.","ရောက်ရှိမှုမှတ်တမ်းတင်ရန် GPS ခွင့်ပြုချက် လိုအပ်ပါသည်။"));
    await act("arrived", gps);
  }

  async function failDelivery() {
    if (!selected) return setMsg(tx("Select a delivery stop first.","ပို့ဆောင်မည့် Way ကို အရင်ရွေးပါ။"));
    if (form.failed_reason === "CUSTOMER_REQUESTED_RESCHEDULE") {
      if (!form.reschedule_date) return setMsg(tx("Choose the customer’s dedicated delivery date.","Customer သတ်မှတ်ထားသော ပို့ဆောင်ရက်ကို ရွေးပါ။"));
      const today = new Date();
      const selectedDate = new Date(`${form.reschedule_date}T00:00:00`);
      if (selectedDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
        return setMsg(tx("Dedicated delivery date cannot be in the past.","သတ်မှတ်ပို့ဆောင်ရက်သည် ယခင်ရက် မဖြစ်ရပါ။"));
      }
      setBusy(true);
      try {
        const { data, error } = await (supabase as any).rpc("be_set_delivery_reschedule_v71", {
          p_way_id: selected.delivery_way_id,
          p_delivery_date: form.reschedule_date,
          p_reason_code: "CUSTOMER_REQUESTED_RESCHEDULE",
          p_actor_email: null,
          p_note: form.remarks.trim() || null,
        });
        if (error) throw error;
        if (data?.ok === false) throw new Error(data?.error || "Unable to reschedule delivery.");
        setMsg(`${selected.delivery_way_id}: rescheduled for ${form.reschedule_date}. It is held from Wayplan assignment until that date.`);
        await load(selected.delivery_way_id);
      } catch (error: any) {
        setMsg(error?.message || "Unable to reschedule delivery.");
      } finally {
        setBusy(false);
      }
      return;
    }
    const gps = await currentGps();
    if (!selected) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("be_rider_wayplan_action", {
        p_payload: {
          wayplan_id: selected.wayplan_id,
          delivery_way_id: selected.delivery_way_id,
          action: "failed",
          failed_reason: form.failed_reason,
          remark: form.remarks || null,
          ...gps,
        },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data?.error || "Failed delivery submission failed.");
      setMsg(`${selected.delivery_way_id}: failed delivery saved. Enterprise synchronized Warehouse return queue, Customer Service follow-up, Finance exception review, Operations exception board and RTO tracking where applicable.`);
      await load(selected.delivery_way_id);
    } catch (error: any) {
      setMsg(error?.message || "Failed delivery submission failed.");
    } finally {
      setBusy(false);
    }
  }

  async function sendGps() {
    if (!selected) return setMsg(tx("Select a delivery stop first.","ပို့ဆောင်မည့် Way ကို အရင်ရွေးပါ။"));
    const gps = await currentGps();
    if (!gps.gps_lat) return setMsg(tx("GPS unavailable or permission denied.","GPS မရရှိနိုင်ပါ သို့မဟုတ် ခွင့်ပြုချက် မပေးထားပါ။"));
    setMsg(`Current GPS: ${gps.gps_lat.toFixed(6)}, ${gps.gps_lng.toFixed(6)}. It will be attached to delivery proof.`);
  }

  const activeCount = useMemo(
    () => pickups.filter((job) => !["DELIVERED", "FAILED_DELIVERY", "RETURN_TO_WAREHOUSE"].includes(String(job.stop_status || "").toUpperCase())).length,
    [pickups],
  );

  useEffect(() => {
    const hashQuery = window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "";
    const preferred = new URLSearchParams(hashQuery).get("deliveryWayId") || undefined;
    load(preferred);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="rounded-3xl bg-white p-5 shadow-sm border">
          <h1 className="text-3xl font-black">{tx("Delivery / Drop-Off Process","ပို့ဆောင် / ပစ္စည်းချ လုပ်ငန်းစဉ်")}</h1>
          <p className="font-semibold text-slate-600">{tx("Assigned Wayplan stops, arrival, delivery proof, signature, COD/payment confirmation and failed delivery.","တာဝန်ပေးထားသော Wayplan မှတ်တိုင်များ၊ ရောက်ရှိမှု၊ ပို့ဆောင်သက်သေ၊ လက်မှတ်၊ COD/ငွေပေးချေမှု အတည်ပြုခြင်းနှင့် ပို့ဆောင်မအောင်မြင်မှုတို့ကို စီမံပါ။")}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
            <span className="rounded-full bg-slate-900 px-3 py-1 text-white">{pickups.length} assigned</span>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-900">{activeCount} active</span>
          </div>
          <div className="mt-3 rounded-2xl bg-blue-50 p-3 font-bold text-blue-900">{msg}</div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[330px_1fr]">
          <aside className="rounded-3xl bg-white p-4 shadow-sm border space-y-3 max-h-[78vh] overflow-y-auto">
            {pickups.map((p) => {
              const current = p.delivery_way_id === selected?.delivery_way_id;
              return (
                <button
                  key={p.id || `${p.wayplan_id}-${p.delivery_way_id}`}
                  onClick={() => selectJob(p)}
                  className={`w-full rounded-2xl border p-3 text-left hover:bg-slate-50 ${current ? "border-blue-600 bg-blue-50" : "border-slate-200"}`}
                >
                  <b className="font-mono text-blue-700">{p.delivery_way_id || p.waybill_no}</b>
                  <p className="font-black">{p.recipient_name || p.receiver_name || "-"}</p>
                  <p className="text-sm text-slate-500">{p.address || p.township || "-"}</p>
                  <div className="mt-2 flex items-center justify-between text-xs font-bold">
                    <span>{String(p.stop_status || p.rider_status || "PENDING").replaceAll("_", " ")}</span>
                    <span>{Number(p.cod_amount || 0).toLocaleString()} Ks</span>
                  </div>
                </button>
              );
            })}
          </aside>

          <section className="rounded-3xl bg-white p-5 shadow-sm border">
            <h2 className="text-xl font-black">{selected?.delivery_way_id || "No delivery stop selected"}</h2>
            {selected && (
              <>
                <div className="mt-2 grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm md:grid-cols-2">
                  <div><b>Wayplan:</b> {selected.wayplan_id}</div>
                  <div><b>Status:</b> {status || "PENDING"}</div>
                  <div><b>Township:</b> {selected.township || "-"}</div>
                  <div><b>COD:</b> {requiredCod.toLocaleString()} Ks</div>
                  <div className="md:col-span-2"><b>Address:</b> {selected.address || "-"}</div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input className="rounded-2xl border p-3 font-bold" placeholder={tx("Receiver name","လက်ခံသူအမည်")} value={form.receiver_name} onChange={(e) => setForm({ ...form, receiver_name: e.target.value })} />
                  <input className="rounded-2xl border p-3 font-bold" placeholder={tx("Receiver phone","လက်ခံသူဖုန်း")} value={form.receiver_phone} onChange={(e) => setForm({ ...form, receiver_phone: e.target.value })} />
                  <textarea className="rounded-2xl border p-3 font-bold md:col-span-2" placeholder={tx("Remarks / special issue","မှတ်ချက် / အထူးပြဿနာ")} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="rounded-2xl border p-3 font-bold">
                    {tx("Delivery proof photo","ပို့ဆောင်မှု သက်သေဓာတ်ပုံ")}
                    <input type="file" accept="image/*" capture="environment" onChange={(e) => choosePhoto(e.target.files?.[0])} className="mt-2 block w-full text-sm" />
                    {proofPreview && <img src={proofPreview} className="mt-3 h-40 w-full rounded-2xl object-cover" />}
                    {proofState === "compressing" && <p className="mt-2 text-sm text-blue-700">{tx("Compressing photo…","ဓာတ်ပုံကို ချုံ့နေသည်…")}</p>}
                    {proofPreview && (
                      <button type="button" disabled={proofState === "approved"} onClick={approveProofPhoto} className="mt-3 w-full rounded-xl bg-emerald-600 p-3 text-white disabled:opacity-50">
                        {proofState === "approved" ? tx("Photo approved","ဓာတ်ပုံ အတည်ပြုပြီး") : tx("Approve photo & upload","ဓာတ်ပုံအတည်ပြုပြီး Upload တင်ရန်")}
                      </button>
                    )}
                  </label>
                  <label className="rounded-2xl border p-3 font-bold">
                    {tx("Customer Electronic Signature","Customer အီလက်ထရွန်နစ်လက်မှတ်")}
                    <input type="file" accept="image/*" onChange={(e) => chooseSignature(e.target.files?.[0])} className="mt-2 block w-full text-sm" />
                    <canvas
                      ref={signatureCanvasRef}
                      width={600}
                      height={180}
                      onMouseDown={startSignature}
                      onMouseMove={drawSignature}
                      onMouseUp={stopSignature}
                      onMouseLeave={stopSignature}
                      onTouchStart={startSignature}
                      onTouchMove={drawSignature}
                      onTouchEnd={stopSignature}
                      className="mt-3 h-32 w-full touch-none rounded-xl border bg-white"
                    />
                    <button type="button" onClick={clearSignatureCanvas} className="mt-2 rounded-lg border px-3 py-2 text-xs">{tx("Clear drawn signature","ရေးထားသောလက်မှတ် ဖျက်ရန်")}</button>
                    <input
                      className="mt-3 w-full rounded-xl border p-3"
                      placeholder={tx("Or type signed customer name","သို့မဟုတ် လက်မှတ်ထိုးသူအမည် ရိုက်ထည့်ပါ")}
                      value={form.signature_name}
                      onChange={(e) => setForm({ ...form, signature_name: e.target.value })}
                    />
                    {signaturePreview && <img src={signaturePreview} className="mt-3 h-40 w-full rounded-2xl object-contain" />}
                  </label>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="font-bold">
                    {tx("Payment method","ငွေပေးချေမှုနည်းလမ်း")}
                    <select className="mt-1 w-full rounded-2xl border p-3" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                      {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method.replaceAll("_", " ")}</option>)}
                    </select>
                  </label>
                  <label className="font-bold">
                    {tx("COD collected","ကောက်ခံပြီး COD")}
                    <input className="mt-1 w-full rounded-2xl border p-3" inputMode="decimal" value={form.cod_collected} onChange={(e) => setForm({ ...form, cod_collected: e.target.value })} />
                  </label>
                  {electronicPayment && (
                    <label className="font-bold md:col-span-2">
                      {tx("Transaction reference","ငွေလွှဲအမှတ်")}
                      <input className="mt-1 w-full rounded-2xl border p-3" value={form.transaction_reference} onChange={(e) => setForm({ ...form, transaction_reference: e.target.value })} />
                    </label>
                  )}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <button disabled={busy} onClick={() => act("accept")} className="rounded-2xl bg-slate-900 p-3 font-black text-white disabled:opacity-50">{tx("Accept","လက်ခံရန်")}</button>
                  <button disabled={busy} onClick={() => act("start_delivery")} className="rounded-2xl bg-blue-700 p-3 font-black text-white disabled:opacity-50">{tx("Start Delivery","ပို့ဆောင်မှု စတင်ရန်")}</button>
                  <button disabled={busy} onClick={arriveAtCustomer} className="rounded-2xl bg-indigo-700 p-3 font-black text-white disabled:opacity-50">{tx("Arrived at Customer","Customer နေရာသို့ ရောက်ရှိပြီ")}</button>
                  <button disabled={busy || !canDeliver} onClick={deliver} className="rounded-2xl bg-emerald-600 p-3 font-black text-white disabled:opacity-50">{tx("Delivered","ပို့ဆောင်ပြီး")}</button>
                  <select className="rounded-2xl border p-3 font-bold" value={form.failed_reason} onChange={(e) => setForm({ ...form, failed_reason: e.target.value })}>
                    {failureReasons.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                  </select>
                  {form.failed_reason === "CUSTOMER_REQUESTED_RESCHEDULE" && (
                    <label className="rounded-2xl border p-3 font-bold">
                      {tx("Dedicated delivery date","သတ်မှတ်ပို့ဆောင်ရက်")}
                      <input type="date" className="mt-1 w-full rounded-xl border p-2" value={form.reschedule_date} onChange={(e) => setForm({ ...form, reschedule_date: e.target.value })} />
                    </label>
                  )}
                  <button disabled={busy} onClick={failDelivery} className="rounded-2xl bg-rose-600 p-3 font-black text-white disabled:opacity-50">{tx("Failed Delivery","ပို့ဆောင်မအောင်မြင်")}</button>
                  <button disabled={busy} onClick={() => act("return", { failed_reason: form.failed_reason, remark: form.remarks || null })} className="rounded-2xl bg-orange-600 p-3 font-black text-white disabled:opacity-50">{tx("Return to Warehouse","Warehouse သို့ ပြန်ပို့ရန်")}</button>
                  <button disabled={busy} onClick={sendGps} className="rounded-2xl border p-3 font-black md:col-span-2 disabled:opacity-50">{tx("Check Current GPS","လက်ရှိ GPS စစ်ရန်")}</button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
