// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";

function rows(data: any) {
  for (const k of ["assigned_pickups", "delivery_jobs", "jobs", "items"]) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  return [];
}

export default function DeliveryPage() {
  const [pickups, setPickups] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ receiver_name: "", receiver_phone: "", dropoff_location: "Warehouse / Branch", remarks: "", proof_photo_data_url: "", proof_photo_name: "" });
  const [msg, setMsg] = useState("Loading delivery jobs...");

  async function load() {
    const { data, error } = await supabase.rpc("be_mobile_go_live_snapshot", { p_payload: { p_limit: 200 } });
    if (error) return setMsg(error.message);
    const list = rows(data);
    setPickups(list);
    setSelected(list[0] || null);
    setMsg(`Loaded ${list.length} delivery job(s).`);
  }

  function photo(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, proof_photo_data_url: String(reader.result || ""), proof_photo_name: file.name }));
    reader.readAsDataURL(file);
  }

  async function save(action_type: string) {
    if (!selected) return setMsg("Select a pickup first.");
    const { error } = await supabase.rpc("be_rider_delivery_dropoff_save", {
      p_payload: { pickup_id: selected.pickup_id || selected.pickup_way_id, action_type, ...form }
    });
    setMsg(error ? error.message : `Saved delivery status: ${action_type}`);
    if (!error) await load();
  }

  async function sendGps() {
    if (!navigator.geolocation || !selected) return setMsg("GPS unavailable or no pickup selected.");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { error } = await supabase.rpc("be_rider_location_heartbeat_save", {
        p_payload: {
          pickup_id: selected.pickup_id || selected.pickup_way_id,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          status: "active"
        }
      });
      setMsg(error ? error.message : "Live location sent.");
    });
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="rounded-3xl bg-white p-5 shadow-sm border">
          <h1 className="text-3xl font-black">Delivery / Drop-Off Process</h1>
          <p className="font-semibold text-slate-600">Arrived, picked up, drop-off, delivered, proof photo, GPS heartbeat.</p>
          <div className="mt-3 rounded-2xl bg-blue-50 p-3 font-bold text-blue-900">{msg}</div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[330px_1fr]">
          <aside className="rounded-3xl bg-white p-4 shadow-sm border space-y-3">
            {pickups.map((p) => (
              <button key={p.id || p.pickup_id} onClick={() => setSelected(p)} className="w-full rounded-2xl border p-3 text-left hover:bg-slate-50">
                <b className="font-mono text-blue-700">{p.pickup_id || p.pickup_way_id}</b>
                <p className="font-black">{p.merchant_name || "-"}</p>
                <p className="text-sm text-slate-500">{p.pickup_address || "-"}</p>
              </button>
            ))}
          </aside>

          <section className="rounded-3xl bg-white p-5 shadow-sm border">
            <h2 className="text-xl font-black">{selected?.pickup_id || "No pickup selected"}</h2>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input className="rounded-2xl border p-3 font-bold" placeholder="Receiver name" value={form.receiver_name} onChange={(e) => setForm({ ...form, receiver_name: e.target.value })} />
              <input className="rounded-2xl border p-3 font-bold" placeholder="Receiver phone" value={form.receiver_phone} onChange={(e) => setForm({ ...form, receiver_phone: e.target.value })} />
              <input className="rounded-2xl border p-3 font-bold md:col-span-2" placeholder="Drop-off location" value={form.dropoff_location} onChange={(e) => setForm({ ...form, dropoff_location: e.target.value })} />
              <textarea className="rounded-2xl border p-3 font-bold md:col-span-2" placeholder="Remarks / special issue" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input type="file" accept="image/*" capture="environment" onChange={(e) => photo(e.target.files?.[0])} className="rounded-2xl border p-3" />
              {form.proof_photo_data_url && <img src={form.proof_photo_data_url} className="h-40 rounded-2xl object-cover" />}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <button onClick={() => save("arrived_pickup")} className="rounded-2xl bg-slate-900 p-3 font-black text-white">Arrived at Pickup</button>
              <button onClick={() => save("picked_up")} className="rounded-2xl bg-blue-700 p-3 font-black text-white">Picked Up</button>
              <button onClick={() => save("arrived_dropoff")} className="rounded-2xl bg-indigo-700 p-3 font-black text-white">Arrived at Drop-off</button>
              <button onClick={() => save("dropped_off")} className="rounded-2xl bg-orange-600 p-3 font-black text-white">Drop Off</button>
              <button onClick={() => save("delivered")} className="rounded-2xl bg-emerald-600 p-3 font-black text-white">Delivered</button>
              <button onClick={() => save("failed_delivery")} className="rounded-2xl bg-rose-600 p-3 font-black text-white">Failed Delivery</button>
              <button onClick={sendGps} className="rounded-2xl border p-3 font-black md:col-span-3">Send Live Location</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
