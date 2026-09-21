// @ts-nocheck
import { useEffect, useState } from "react";
import { RefreshCw, WalletCards } from "lucide-react";
import { supabase } from "../integrations/supabase/client";
import { useAppState } from "../hooks/useAppState";

function money(value: any) {
  return Number(value || 0).toLocaleString();
}

export default function WalletPage() {
  const { language } = useAppState();
  const tx = (en:string,my:string) => language === "my" ? my : en;
  const [snapshot, setSnapshot] = useState<any>({ totals: {}, ledger: [], identity: {} });
  const [msg, setMsg] = useState(language === "my" ? "Rider ငွေစာရင်းကို ဖွင့်နေသည်..." : "Loading Rider wallet...");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setMsg(tx("Loading Rider wallet...","Rider ငွေစာရင်းကို ဖွင့်နေသည်..."));
    const { data, error } = await (supabase as any).rpc("be_rider_wallet_snapshot", { p_payload: {} });
    if (error) {
      setMsg(`Unable to load Rider wallet: ${error.message}`);
      setLoading(false);
      return;
    }
    setSnapshot(data || { totals: {}, ledger: [], identity: {} });
    setMsg(tx("Wallet synchronized with Finance COD settlement records.","ငွေစာရင်းကို Finance COD settlement မှတ်တမ်းများနှင့် ချိတ်ဆက်ပြီးပါပြီ။"));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const t = snapshot.totals || {};
  const ledger = Array.isArray(snapshot.ledger) ? snapshot.ledger : [];
  const identity = snapshot.identity || {};

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-600">BRITIUM EXPRESS</p>
              <h1 className="mt-2 flex items-center gap-3 text-3xl font-black text-slate-950">
                <WalletCards className="h-7 w-7 text-blue-700" />
                {tx("Rider Wallet","Rider ငွေစာရင်း")}
              </h1>
              <p className="mt-2 font-semibold text-slate-600">
                {tx("COD collection, handover balance, settlement status, and Rider ledger.","COD ကောက်ခံမှု၊ လွှဲပြောင်းလက်ကျန်၊ ငွေစာရင်းရှင်းမှုအခြေအနေနှင့် Rider စာရင်းကို ကြည့်ရှုပါ။")}
              </p>
              <p className="mt-2 text-sm font-bold text-slate-500">
                {identity.display_name || identity.worker_code || "Rider"} · {identity.worker_code || "-"} · {identity.branch_code || "Branch not set"}
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
          <div className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-900">{msg}</div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [tx("COD Collected","ကောက်ခံပြီး COD"), money(t.cod_collected) + " MMK"],
            [tx("COD Handed Over","လွှဲပြောင်းပြီး COD"), money(t.cod_handed_over) + " MMK"],
            [tx("COD Balance","COD လက်ကျန်"), money(t.cod_balance) + " MMK"],
            [tx("Completed Settlements","ပြီးဆုံးသော ငွေစာရင်းရှင်းမှု"), Number(t.completed_jobs || 0).toLocaleString()],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-slate-950">{tx("Wallet Ledger","ငွေစာရင်းမှတ်တမ်း")}</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{ledger.length} {tx("records","မှတ်တမ်း")}</span>
          </div>

          {ledger.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="font-black text-slate-700">{tx("No Rider COD ledger entries yet.","Rider COD စာရင်းမှတ်တမ်း မရှိသေးပါ။")}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {tx("Delivered COD transactions will appear here after Finance settlement records are created.","ပို့ဆောင်ပြီး COD များကို Finance settlement မှတ်တမ်း ပြုလုပ်ပြီးနောက် ဤနေရာတွင် ပြပါမည်။")}
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {ledger.map((r: any) => (
                <div key={r.id || r.delivery_way_id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-mono text-sm font-black text-blue-700">{r.delivery_way_id || r.pickup_id || "-"}</p>
                      <p className="mt-1 text-sm font-bold text-slate-700">{String(r.ledger_type || "COD settlement").replaceAll("_", " ")}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-lg font-black text-slate-950">{money(r.amount)} MMK</p>
                      <span className="mt-1 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                        {r.status || "PENDING"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
