// @ts-nocheck
import { useState } from "react";
import { supabase } from "../integrations/supabase/client";

export default function AvailabilityPage() {
  const [form, setForm] = useState({
    is_online: false,
    shift_date: "",
    shift_start: "",
    shift_end: "",
    vehicle_type: "Motorbike",
    vehicle_plate: "",
    preferred_language: "English",
  });
  const [msg, setMsg] = useState("");

  async function save() {
    const { error } = await supabase.rpc("be_rider_availability_save", {
      p_payload: form,
    });

    setMsg(error ? error.message : "Availability and schedule saved.");
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-3xl rounded-3xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-black">Availability & Schedule</h1>
        <p className="font-semibold text-slate-600">
          Online/offline status, shift booking, vehicle details, and preferred language.
        </p>

        <label className="mt-5 flex items-center gap-3 rounded-2xl border p-4 font-black">
          <input
            type="checkbox"
            checked={form.is_online}
            onChange={(e) => setForm({ ...form, is_online: e.target.checked })}
          />
          Online / Available for Orders
        </label>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="date" className="rounded-2xl border p-3 font-bold" value={form.shift_date} onChange={(e) => setForm({ ...form, shift_date: e.target.value })} />
          <input type="time" className="rounded-2xl border p-3 font-bold" value={form.shift_start} onChange={(e) => setForm({ ...form, shift_start: e.target.value })} />
          <input type="time" className="rounded-2xl border p-3 font-bold" value={form.shift_end} onChange={(e) => setForm({ ...form, shift_end: e.target.value })} />
          <input className="rounded-2xl border p-3 font-bold" placeholder="Vehicle plate" value={form.vehicle_plate} onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value })} />
          <select className="rounded-2xl border p-3 font-bold" value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}>
            <option>Motorbike</option>
            <option>Car</option>
            <option>Van</option>
            <option>Truck</option>
          </select>
          <select className="rounded-2xl border p-3 font-bold" value={form.preferred_language} onChange={(e) => setForm({ ...form, preferred_language: e.target.value })}>
            <option>English</option>
            <option>Myanmar</option>
            <option>Chinese</option>
          </select>
        </div>

        {msg && <div className="mt-4 rounded-2xl bg-blue-50 p-3 font-bold text-blue-900">{msg}</div>}

        <button onClick={save} className="mt-5 w-full rounded-2xl bg-blue-700 p-4 font-black text-white">
          Save Availability
        </button>
      </div>
    </div>
  );
}
