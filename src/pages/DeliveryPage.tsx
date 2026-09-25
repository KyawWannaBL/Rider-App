// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { supabase } from "../integrations/supabase/client";

const PAYMENT_METHODS = ["CASH", "PREPAID", "QR", "BANK_TRANSFER", "MOBILE_WALLET"];

function rows(data: any) {
  for (const k of ["jobs", "delivery_jobs", "assigned_pickups", "items"]) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  return [];
}

function dataUrlToBlob(dataUrl: string) {
  const [meta, body] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);/)?.[1] || "image/png";
  const bytes = atob(body || "");
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) array[i] = bytes.charCodeAt(i);
  return new Blob([array], { type: mime });
}

function safePart(value: unknown) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80);
}

export default function DeliveryPage() {
  const [pickups, setPickups] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    receiver_name: "",
    receiver_phone: "",
    remarks: "",
    proof_photo_data_url: "",
    proof_photo_name: "",
    payment_method: "CASH",
    transaction_reference: "",
    cod_collected: "",
    failed_reason: "",
  });
  const [msg, setMsg] = useState("Loading delivery jobs...");
  const signatureRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  async function load() {
    const { data, error } = await supabase.rpc("be_rider_delivery_wayplan_jobs", { p_limit: 200 });
    if (error) return setMsg(error.message);
    const list = rows(data);
    setPickups(list);
    const first = list[0] || null;
    setSelected(first);
    setForm((current) => ({
      ...current,
      receiver_name: first?.receiver_name || first?.recipient_name || "",
      receiver_phone: first?.receiver_phone || first?.recipient_phone || "",
      cod_collected: String(first?.cod_amount ?? ""),
    }));
    setMsg(`Loaded ${list.length} assigned Wayplan delivery job(s).`);
  }

  function selectJob(job: any) {
    setSelected(job);
    setForm((current) => ({
      ...current,
      receiver_name: job?.receiver_name || job?.recipient_name || "",
      receiver_phone: job?.receiver_phone || job?.recipient_phone || "",
      cod_collected: String(job?.cod_amount ?? ""),
      transaction_reference: "",
      failed_reason: "",
      proof_photo_data_url: "",
      proof_photo_name: "",
    }));
    clearSignature();
  }

  function photo(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({
      ...f,
      proof_photo_data_url: String(reader.result || ""),
      proof_photo_name: file.name,
    }));
    reader.readAsDataURL(file);
  }

  function point(event: any) {
    const canvas = signatureRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const source = event.touches?.[0] || event;
    return {
      x: (source.clientX - rect.left) * (canvas.width / rect.width),
      y: (source.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function startSignature(event: any) {
    const canvas = signatureRef.current;
    const p = point(event);
    if (!canvas || !p) return;
    drawingRef.current = true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    event.preventDefault?.();
  }

  function drawSignature(event: any) {
    if (!drawingRef.current) return;
    const canvas = signatureRef.current;
    const p = point(event);
    if (!canvas || !p) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    event.preventDefault?.();
  }

  function stopSignature() {
    drawingRef.current = false;
  }

  function clearSignature() {
    const canvas = signatureRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function currentGps(): Promise<{ gps_lat: number; gps_lng: number; accuracy?: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("GPS is not available on this device."));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          gps_lat: pos.coords.latitude,
          gps_lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
        (error) => reject(new Error(error.message || "Unable to read GPS position.")),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 },
      );
    });
  }

  async function uploadDataUrl(bucket: string, dataUrl: string, prefix: string) {
    const blob = dataUrlToBlob(dataUrl);
    const path = `${prefix}/${Date.now()}-${crypto.randomUUID()}.png`;
    const { error } = await supabase.storage.from(bucket).upload(path, blob, {
      contentType: blob.type || "image/png",
      upsert: false,
    });
    if (error) throw error;
    if (bucket === "rider-proofs") {
      return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    }
    return path;
  }

  async function action(actionName: string, extra: Record<string, any> = {}) {
    if (!selected) throw new Error("Select a Wayplan delivery first.");
    const payload = {
      action: actionName,
      wayplan_id: selected.wayplan_id,
      delivery_way_id: selected.delivery_way_id,
      ...extra,
    };
    const { data, error } = await supabase.rpc("be_rider_wayplan_action", { p_payload: payload });
    if (error) throw error;
    if (data?.ok === false) throw new Error(data?.message || data?.error || "Rider action failed.");
    return data;
  }

  async function run(label: string, fn: () => Promise<any>) {
    try {
      setBusy(true);
      setMsg(`${label}...`);
      await fn();
      setMsg(`${label} completed.`);
      await load();
    } catch (error: any) {
      setMsg(error?.message || `${label} failed.`);
    } finally {
      setBusy(false);
    }
  }

  async function startDelivery() {
    await run("Starting delivery", async () => action("start_delivery"));
  }

  async function arrivedAtCustomer() {
    await run("Confirming customer arrival", async () => {
      const gps = await currentGps();
      return action("arrived_at_customer", gps);
    });
  }

  async function confirmDelivered() {
    await run("Saving delivery proof", async () => {
      if (!form.receiver_name.trim()) throw new Error("Receiver name is required.");
      if (!form.proof_photo_data_url) throw new Error("Delivery proof photo is required.");

      const canvas = signatureRef.current;
      const signatureData = canvas?.toDataURL("image/png") || "";
      const blankCanvas = document.createElement("canvas");
      blankCanvas.width = canvas?.width || 720;
      blankCanvas.height = canvas?.height || 220;
      if (!signatureData || signatureData === blankCanvas.toDataURL("image/png")) {
        throw new Error("Customer electronic signature is required.");
      }

      const requiredCod = Number(selected?.cod_amount || 0);
      const collectedCod = Number(form.cod_collected || 0);
      if (requiredCod > 0 && collectedCod !== requiredCod) {
        throw new Error(`COD collected must equal required COD: ${requiredCod} Ks.`);
      }
      if (["QR", "BANK_TRANSFER", "MOBILE_WALLET"].includes(form.payment_method) && !form.transaction_reference.trim()) {
        throw new Error("Transaction reference is required for electronic payment.");
      }

      const gps = await currentGps();
      const base = `${safePart(selected.wayplan_id)}/${safePart(selected.delivery_way_id)}`;
      const [proofUrl, signaturePath] = await Promise.all([
        uploadDataUrl("rider-proofs", form.proof_photo_data_url, base),
        uploadDataUrl("ops-signatures", signatureData, base),
      ]);

      return action("deliver", {
        receiver_name: form.receiver_name.trim(),
        receiver_phone: form.receiver_phone.trim(),
        proof_url: proofUrl,
        signature_path: signaturePath,
        signature_payload: { capture: "canvas", captured_at: new Date().toISOString() },
        payment_method: form.payment_method,
        transaction_reference: form.transaction_reference.trim() || null,
        cod_collected: collectedCod,
        gps_lat: gps.gps_lat,
        gps_lng: gps.gps_lng,
        remark: form.remarks.trim() || null,
      });
    });
  }

  async function failedDelivery() {
    await run("Recording failed delivery", async () => {
      if (!form.failed_reason.trim()) throw new Error("Failed-delivery reason is required.");
      return action("delivery_failed", {
        failed_reason: form.failed_reason.trim(),
        reason: form.failed_reason.trim(),
        remark: form.remarks.trim() || form.failed_reason.trim(),
      });
    });
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="rounded-3xl bg-white p-5 shadow-sm border">
          <h1 className="text-3xl font-black">Delivery / Drop-Off Process</h1>
          <p className="font-semibold text-slate-600">Preferred Rider workflow with Wayplan assignment, geofence arrival, proof, signature, COD and payment confirmation.</p>
          <div className="mt-3 rounded-2xl bg-blue-50 p-3 font-bold text-blue-900">{msg}</div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[330px_1fr]">
          <aside className="rounded-3xl bg-white p-4 shadow-sm border space-y-3">
            {pickups.map((p) => (
              <button
                key={p.id || p.delivery_way_id}
                onClick={() => selectJob(p)}
                className={`w-full rounded-2xl border p-3 text-left hover:bg-slate-50 ${selected?.delivery_way_id === p.delivery_way_id ? "border-blue-600 bg-blue-50" : ""}`}
              >
                <b className="font-mono text-blue-700">{p.delivery_way_id || p.waybill_no}</b>
                <p className="font-black">{p.recipient_name || p.receiver_name || "-"}</p>
                <p className="text-sm text-slate-500">{p.address || p.township || "-"}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{p.stop_status || p.rider_status || "ASSIGNED"} · COD {Number(p.cod_amount || 0).toLocaleString()} Ks</p>
              </button>
            ))}
          </aside>

          <section className="rounded-3xl bg-white p-5 shadow-sm border">
            <h2 className="text-xl font-black">{selected?.delivery_way_id || "No delivery selected"}</h2>
            {selected && <p className="mt-1 text-sm font-bold text-slate-500">Wayplan: {selected.wayplan_id} · Stop {selected.stop_sequence || "-"}</p>}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input className="rounded-2xl border p-3 font-bold" placeholder="Receiver name" value={form.receiver_name} onChange={(e) => setForm({ ...form, receiver_name: e.target.value })} />
              <input className="rounded-2xl border p-3 font-bold" placeholder="Receiver phone" value={form.receiver_phone} onChange={(e) => setForm({ ...form, receiver_phone: e.target.value })} />
              <textarea className="rounded-2xl border p-3 font-bold md:col-span-2" placeholder="Remarks / special issue" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="rounded-2xl border p-3">
                <span className="mb-2 block text-xs font-black uppercase text-slate-500">Delivery proof photo</span>
                <input type="file" accept="image/*" capture="environment" onChange={(e) => photo(e.target.files?.[0])} className="w-full" />
              </label>
              {form.proof_photo_data_url
                ? <img src={form.proof_photo_data_url} className="h-40 w-full rounded-2xl object-cover" />
                : <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed text-sm font-bold text-slate-400">Proof preview</div>}
            </div>

            <div className="mt-4 rounded-2xl border p-4">
              <div className="mb-2 flex items-center justify-between">
                <b>Customer Electronic Signature</b>
                <button type="button" onClick={clearSignature} className="rounded-xl border px-3 py-1 text-xs font-black">Clear</button>
              </div>
              <canvas
                ref={signatureRef}
                width={720}
                height={220}
                className="h-36 w-full touch-none rounded-xl border bg-white"
                onMouseDown={startSignature}
                onMouseMove={drawSignature}
                onMouseUp={stopSignature}
                onMouseLeave={stopSignature}
                onTouchStart={startSignature}
                onTouchMove={drawSignature}
                onTouchEnd={stopSignature}
              />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm font-black">
                Payment method
                <select className="mt-1 w-full rounded-2xl border p-3" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                  {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method.replaceAll("_", " ")}</option>)}
                </select>
              </label>
              <label className="text-sm font-black">
                COD collected
                <input type="number" className="mt-1 w-full rounded-2xl border p-3" value={form.cod_collected} onChange={(e) => setForm({ ...form, cod_collected: e.target.value })} />
              </label>
              {["QR", "BANK_TRANSFER", "MOBILE_WALLET"].includes(form.payment_method) && (
                <label className="text-sm font-black md:col-span-2">
                  Transaction reference
                  <input className="mt-1 w-full rounded-2xl border p-3" value={form.transaction_reference} onChange={(e) => setForm({ ...form, transaction_reference: e.target.value })} />
                </label>
              )}
              <label className="text-sm font-black md:col-span-2">
                Failed reason
                <input className="mt-1 w-full rounded-2xl border p-3" placeholder="e.g. CUSTOMER_UNREACHABLE" value={form.failed_reason} onChange={(e) => setForm({ ...form, failed_reason: e.target.value })} />
              </label>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <button disabled={busy || !selected} onClick={startDelivery} className="rounded-2xl bg-blue-700 p-3 font-black text-white disabled:opacity-50">Start Delivery</button>
              <button disabled={busy || !selected} onClick={arrivedAtCustomer} className="rounded-2xl bg-indigo-700 p-3 font-black text-white disabled:opacity-50">Arrived at Customer</button>
              <button disabled={busy || !selected} onClick={confirmDelivered} className="rounded-2xl bg-emerald-600 p-3 font-black text-white disabled:opacity-50">Delivered + Proof</button>
              <button disabled={busy || !selected} onClick={failedDelivery} className="rounded-2xl bg-rose-600 p-3 font-black text-white disabled:opacity-50">Failed Delivery</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
