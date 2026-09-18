// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../integrations/supabase/client";

const PAYMENT_METHODS = ["CASH", "PREPAID", "QR", "BANK_TRANSFER", "MOBILE_WALLET"];

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
  const [pickups, setPickups] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState("");
  const [signaturePreview, setSignaturePreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    receiver_name: "",
    receiver_phone: "",
    remarks: "",
    payment_method: "CASH",
    transaction_reference: "",
    cod_collected: "",
    failed_reason: "CUSTOMER_UNREACHABLE",
    signature_name: "",
  });
  const [msg, setMsg] = useState("Loading delivery jobs...");

  const requiredCod = Number(selected?.cod_amount || 0);
  const status = String(selected?.stop_status || selected?.rider_status || "").toUpperCase();
  const electronicPayment = ["QR", "BANK_TRANSFER", "MOBILE_WALLET"].includes(form.payment_method);
  const canDeliver = status === "ARRIVED_AT_CUSTOMER";

  function resetProofs() {
    setProofFile(null);
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
      failed_reason: "CUSTOMER_UNREACHABLE",
    }));
  }

  async function load(preferredDeliveryWayId?: string) {
    setMsg("Loading assigned Wayplan deliveries...");
    const { data, error } = await (supabase as any).rpc("be_rider_delivery_wayplan_jobs", {
      p_rider_code: null,
      p_limit: 200,
    });
    if (error) return setMsg(error.message);

    const list = jobsFromResponse(data);
    setPickups(list);
    const next =
      list.find((job: any) => job.delivery_way_id === preferredDeliveryWayId) ||
      list.find((job: any) => !["DELIVERED", "FAILED_DELIVERY", "RETURN_TO_WAREHOUSE"].includes(String(job.stop_status || "").toUpperCase())) ||
      list[0] ||
      null;
    if (next) selectJob(next);
    else setSelected(null);
    setMsg(`Loaded ${list.length} assigned delivery stop(s).`);
  }

  function choosePhoto(file?: File) {
    if (!file) return;
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
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
    const result = await supabase.storage.from(bucket).upload(path, file, {
      upsert: false,
      contentType: file.type || "image/jpeg",
    });
    if (result.error) throw result.error;
    if (bucket === "rider-proofs") {
      return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    }
    return path;
  }

  async function act(action: string, extra: any = {}) {
    if (!selected) return setMsg("Select a delivery stop first.");
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
    if (!selected) return setMsg("Select a delivery stop first.");
    if (!canDeliver) return setMsg("Record Arrived at Customer before confirming delivery.");
    if (!form.receiver_name.trim()) return setMsg("Receiver name is required.");
    if (!proofFile) return setMsg("Delivery proof photo is required.");
    if (!signatureFile && !form.signature_name.trim()) return setMsg("Customer electronic signature is required.");
    if (requiredCod > 0 && Number(form.cod_collected || 0) !== requiredCod) {
      return setMsg(`COD collected must equal required COD: ${requiredCod.toLocaleString()} Ks.`);
    }
    if (electronicPayment && !form.transaction_reference.trim()) {
      return setMsg("Transaction reference is required for electronic payment.");
    }

    setBusy(true);
    try {
      const prefix = `${selected.wayplan_id}/${selected.delivery_way_id}`;
      const proof_url = await upload("rider-proofs", proofFile, prefix);
      const signature_path = signatureFile
        ? await upload("ops-signatures", signatureFile, prefix)
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

  async function sendGps() {
    if (!selected) return setMsg("Select a delivery stop first.");
    const gps = await currentGps();
    if (!gps.gps_lat) return setMsg("GPS unavailable or permission denied.");
    setMsg(`Current GPS: ${gps.gps_lat.toFixed(6)}, ${gps.gps_lng.toFixed(6)}. It will be attached to delivery proof.`);
  }

  const activeCount = useMemo(
    () => pickups.filter((job) => !["DELIVERED", "FAILED_DELIVERY", "RETURN_TO_WAREHOUSE"].includes(String(job.stop_status || "").toUpperCase())).length,
    [pickups],
  );

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="rounded-3xl bg-white p-5 shadow-sm border">
          <h1 className="text-3xl font-black">Delivery / Drop-Off Process</h1>
          <p className="font-semibold text-slate-600">Assigned Wayplan stops, arrival, delivery proof, signature, COD/payment confirmation and failed delivery.</p>
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
                  <input className="rounded-2xl border p-3 font-bold" placeholder="Receiver name" value={form.receiver_name} onChange={(e) => setForm({ ...form, receiver_name: e.target.value })} />
                  <input className="rounded-2xl border p-3 font-bold" placeholder="Receiver phone" value={form.receiver_phone} onChange={(e) => setForm({ ...form, receiver_phone: e.target.value })} />
                  <textarea className="rounded-2xl border p-3 font-bold md:col-span-2" placeholder="Remarks / special issue" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="rounded-2xl border p-3 font-bold">
                    Delivery proof photo
                    <input type="file" accept="image/*" capture="environment" onChange={(e) => choosePhoto(e.target.files?.[0])} className="mt-2 block w-full text-sm" />
                    {proofPreview && <img src={proofPreview} className="mt-3 h-40 w-full rounded-2xl object-cover" />}
                  </label>
                  <label className="rounded-2xl border p-3 font-bold">
                    Customer Electronic Signature
                    <input type="file" accept="image/*" onChange={(e) => chooseSignature(e.target.files?.[0])} className="mt-2 block w-full text-sm" />
                    <input
                      className="mt-3 w-full rounded-xl border p-3"
                      placeholder="Or type signed customer name"
                      value={form.signature_name}
                      onChange={(e) => setForm({ ...form, signature_name: e.target.value })}
                    />
                    {signaturePreview && <img src={signaturePreview} className="mt-3 h-40 w-full rounded-2xl object-contain" />}
                  </label>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="font-bold">
                    Payment method
                    <select className="mt-1 w-full rounded-2xl border p-3" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                      {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method.replaceAll("_", " ")}</option>)}
                    </select>
                  </label>
                  <label className="font-bold">
                    COD collected
                    <input className="mt-1 w-full rounded-2xl border p-3" inputMode="decimal" value={form.cod_collected} onChange={(e) => setForm({ ...form, cod_collected: e.target.value })} />
                  </label>
                  {electronicPayment && (
                    <label className="font-bold md:col-span-2">
                      Transaction reference
                      <input className="mt-1 w-full rounded-2xl border p-3" value={form.transaction_reference} onChange={(e) => setForm({ ...form, transaction_reference: e.target.value })} />
                    </label>
                  )}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <button disabled={busy} onClick={() => act("accept")} className="rounded-2xl bg-slate-900 p-3 font-black text-white disabled:opacity-50">Accept</button>
                  <button disabled={busy} onClick={() => act("start_delivery")} className="rounded-2xl bg-blue-700 p-3 font-black text-white disabled:opacity-50">Start Delivery</button>
                  <button disabled={busy} onClick={() => act("arrived")} className="rounded-2xl bg-indigo-700 p-3 font-black text-white disabled:opacity-50">Arrived at Customer</button>
                  <button disabled={busy || !canDeliver} onClick={deliver} className="rounded-2xl bg-emerald-600 p-3 font-black text-white disabled:opacity-50">Delivered</button>
                  <select className="rounded-2xl border p-3 font-bold" value={form.failed_reason} onChange={(e) => setForm({ ...form, failed_reason: e.target.value })}>
                    <option value="CUSTOMER_UNREACHABLE">Customer unreachable</option>
                    <option value="CUSTOMER_REFUSED">Customer refused</option>
                    <option value="ADDRESS_NOT_FOUND">Address not found</option>
                    <option value="RESCHEDULE_REQUESTED">Reschedule requested</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <button disabled={busy} onClick={() => act("failed", { failed_reason: form.failed_reason, remark: form.remarks || null })} className="rounded-2xl bg-rose-600 p-3 font-black text-white disabled:opacity-50">Failed Delivery</button>
                  <button disabled={busy} onClick={() => act("return", { failed_reason: form.failed_reason, remark: form.remarks || null })} className="rounded-2xl bg-orange-600 p-3 font-black text-white disabled:opacity-50">Return to Warehouse</button>
                  <button disabled={busy} onClick={sendGps} className="rounded-2xl border p-3 font-black md:col-span-2 disabled:opacity-50">Check Current GPS</button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
