// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { useAppState } from "../hooks/useAppState";

function rows(data: any) {
  for (const key of ["assigned_pickups", "delivery_jobs", "jobs", "items"]) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

export default function CodSettlementPage() {
  const { language } = useAppState();
  const tx = (en:string,my:string) => language === "my" ? my : en;
  const [pickups, setPickups] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [message, setMessage] = useState(language === "my" ? "COD အလုပ်များကို ဖွင့်နေသည်..." : "Loading COD jobs...");
  const [form, setForm] = useState({
    cod_expected: "",
    cod_collected: "",
    cod_handover_amount: "",
    handed_over_to: "Finance / Supervisor",
    proof_photo_data_url: "",
    proof_photo_name: "",
  });

  async function load() {
    const { data, error } = await (supabase as any).rpc("be_rider_delivery_wayplan_jobs", {
      p_rider_code: null,
      p_limit: 200,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    const list = rows(data).filter((job: any) =>
      String(job.stop_status || job.rider_status || "").toUpperCase() === "DELIVERED" &&
      Number(job.cod_collected || 0) > 0
    );
    setPickups(list);
    setSelected(list[0] || null);
    setMessage(tx(`Loaded ${list.length} delivered COD job(s) awaiting Rider settlement review.`,`ငွေစာရင်းရှင်းရန် စောင့်နေသော ပို့ဆောင်ပြီး COD အလုပ် ${list.length} ခု ရှိပါသည်။`));
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
      setMessage(tx("Select a pickup first.","Pickup ကို အရင်ရွေးပါ။"));
      return;
    }

    const amount = Number(form.cod_handover_amount || form.cod_collected || selected.cod_collected || 0);
    if (!(amount > 0)) {
      setMessage(tx("COD handover amount must be greater than zero.","လွှဲပြောင်းမည့် COD ပမာဏသည် 0 ထက် ကြီးရပါမည်။"));
      return;
    }

    const { data: identity, error: identityError } = await (supabase as any).rpc("be_current_field_team_identity");
    if (identityError) {
      setMessage(identityError.message);
      return;
    }

    const { data, error } = await (supabase as any).rpc("be_rider_submit_cod_settlement", {
      p_pickup_id: selected.pickup_id || null,
      p_rider_email: identity?.email || null,
      p_cod_amount: amount,
      p_remark: `${form.handed_over_to || "Finance / Supervisor"}${form.proof_photo_name ? ` | proof: ${form.proof_photo_name}` : ""}`,
      p_pickup_way_id: selected.pickup_way_id || null,
      p_rider_code: identity?.worker_code || null,
      p_delivery_way_id: selected.delivery_way_id || null,
      p_waybill_no: selected.waybill_no || null,
      p_invoice_no: selected.invoice_no || null,
    });

    if (error || data?.ok === false) {
      setMessage(error?.message || data?.error || "COD settlement submission failed.");
      return;
    }
    setMessage(tx("COD settlement submitted to Finance.","COD ငွေစာရင်းကို Finance သို့ တင်သွင်းပြီးပါပြီ။"));
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-black">{tx("COD Settlement","COD ငွေစာရင်းရှင်းခြင်း")}</h1>
          <p className="font-semibold text-slate-600">
            {tx("Track COD expected, collected, handed over, and proof photo.","ရရှိရမည့် COD၊ ကောက်ခံပြီး COD၊ လွှဲပြောင်းပြီး COD နှင့် သက်သေဓာတ်ပုံကို စစ်ဆေးပါ။")}
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
                    cod_collected: String(pickup.cod_collected || pickup.cod_amount || 0),
                    cod_handover_amount: String(pickup.cod_collected || pickup.cod_amount || 0),
                  }));
                }}
                className="w-full rounded-2xl border p-3 text-left hover:bg-slate-50"
              >
                <b className="font-mono text-blue-700">
                  {pickup.pickup_id || pickup.pickup_way_id}
                </b>
                <p className="font-black">{pickup.merchant_name || "-"}</p>
                <p className="text-sm text-slate-500">
                  {tx("COD collected:","ကောက်ခံပြီး COD:")} {Number(pickup.cod_collected || pickup.cod_amount || 0).toLocaleString()} MMK
                </p>
              </button>
            ))}
          </aside>

          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">
              {selected?.pickup_id || tx("No pickup selected","Pickup မရွေးထားပါ")}
            </h2>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                className="rounded-2xl border p-3 font-bold"
                placeholder={tx("COD expected","ရရှိရမည့် COD")}
                value={form.cod_expected}
                onChange={(e) => setForm({ ...form, cod_expected: e.target.value })}
              />
              <input
                className="rounded-2xl border p-3 font-bold"
                placeholder={tx("COD collected","ကောက်ခံပြီး COD")}
                value={form.cod_collected}
                onChange={(e) => setForm({ ...form, cod_collected: e.target.value })}
              />
              <input
                className="rounded-2xl border p-3 font-bold"
                placeholder={tx("COD handover amount","လွှဲပြောင်းမည့် COD ပမာဏ")}
                value={form.cod_handover_amount}
                onChange={(e) => setForm({ ...form, cod_handover_amount: e.target.value })}
              />
              <input
                className="rounded-2xl border p-3 font-bold"
                placeholder={tx("Handed over to","လွှဲပြောင်းလက်ခံသူ")}
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
