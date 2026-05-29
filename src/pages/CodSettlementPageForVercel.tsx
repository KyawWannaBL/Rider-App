// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";

function rows(data: any) {
  for (const key of ["assigned_pickups", "delivery_jobs", "jobs", "items"]) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

export default function CodSettlementPage() {
  const [pickups, setPickups] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [message, setMessage] = useState("Loading COD jobs...");
  const [form, setForm] = useState({
    cod_expected: "",
    cod_collected: "",
    cod_handover_amount: "",
    handed_over_to: "Finance / Supervisor",
    proof_photo_data_url: "",
    proof_photo_name: "",
  });

  async function load() {
    const { data, error } = await supabase.rpc("be_mobile_go_live_snapshot", {
      p_payload: { p_limit: 200 },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    const list = rows(data);
    setPickups(list);
    setSelected(list[0] || null);
    setMessage(`Loaded ${list.length} COD job(s).`);
  }

  function selectPhoto(file?: File) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({
        ...current,
        proof_photo_data_url: String(reader.result || ""),
        proof_photo_name: file.name,
      }));
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    if (!selected) {
      setMessage("Select a pickup first.");
      return;
    }

    const { error } = await supabase.rpc("be_rider_cod_handover_save", {
      p_payload: {
        pickup_id: selected.pickup_id || selected.pickup_way_id,
        ...form,
      },
    });

    setMessage(error ? error.message : "COD handover saved.");
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-black">COD Settlement</h1>
          <p className="font-semibold text-slate-600">
            Track COD expected, collected, handed over, and proof photo.
          </p>
          <div className="mt-3 rounded-2xl bg-blue-50 p-3 font-bold text-blue-900">
            {message}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[330px_1fr]">
          <aside className="space-y-3 rounded-3xl border bg-white p-4 shadow-sm">
            {pickups.map((pickup) => (
              <button
                key={pickup.id || pickup.pickup_id}
                onClick={() => {
                  setSelected(pickup);
                  setForm((current) => ({
                    ...current,
                    cod_expected: String(pickup.cod_amount || pickup.cod_expected || 0),
                    cod_collected: String(pickup.cod_amount || pickup.cod_collected || 0),
                  }));
                }}
                className="w-full rounded-2xl border p-3 text-left hover:bg-slate-50"
              >
                <b className="font-mono text-blue-700">
                  {pickup.pickup_id || pickup.pickup_way_id}
                </b>
                <p className="font-black">{pickup.merchant_name || "-"}</p>
                <p className="text-sm text-slate-500">
                  COD: {Number(pickup.cod_amount || 0).toLocaleString()} MMK
                </p>
              </button>
            ))}
          </aside>

          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">
              {selected?.pickup_id || "No pickup selected"}
            </h2>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                className="rounded-2xl border p-3 font-bold"
                placeholder="COD expected"
                value={form.cod_expected}
                onChange={(e) => setForm({ ...form, cod_expected: e.target.value })}
              />
              <input
                className="rounded-2xl border p-3 font-bold"
                placeholder="COD collected"
                value={form.cod_collected}
                onChange={(e) => setForm({ ...form, cod_collected: e.target.value })}
              />
              <input
                className="rounded-2xl border p-3 font-bold"
                placeholder="COD handover amount"
                value={form.cod_handover_amount}
                onChange={(e) => setForm({ ...form, cod_handover_amount: e.target.value })}
              />
              <input
                className="rounded-2xl border p-3 font-bold"
                placeholder="Handed over to"
                value={form.handed_over_to}
                onChange={(e) => setForm({ ...form, handed_over_to: e.target.value })}
              />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => selectPhoto(e.target.files?.[0])}
                className="rounded-2xl border p-3 md:col-span-2"
              />
            </div>

            {form.proof_photo_data_url && (
              <img
                src={form.proof_photo_data_url}
                className="mt-4 h-44 rounded-2xl object-cover"
              />
            )}

            <button
              onClick={save}
              className="mt-5 w-full rounded-2xl bg-blue-700 p-4 font-black text-white"
            >
              Submit COD Handover
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
