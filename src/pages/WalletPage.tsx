// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";

export default function WalletPage() {
  const [snapshot, setSnapshot] = useState<any>({ totals: {}, ledger: [] });
  const [msg, setMsg] = useState("Loading rider wallet...");

  async function load() {
    const { data, error } = await supabase.rpc("be_rider_wallet_snapshot", { p_payload: {} });
    if (error) return setMsg(error.message);
    setSnapshot(data || { totals: {}, ledger: [] });
    setMsg("Wallet loaded.");
  }

  useEffect(() => { load(); }, []);

  const t = snapshot.totals || {};
  const ledger = Array.isArray(snapshot.ledger) ? snapshot.ledger : [];

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="rounded-3xl bg-white p-5 shadow-sm border">
          <h1 className="text-3xl font-black">Rider Wallet</h1>
          <p className="font-semibold text-slate-600">COD balance, handed-over amount, completed jobs, and wallet ledger.</p>
          <div className="mt-3 rounded-2xl bg-blue-50 p-3 font-bold text-blue-900">{msg}</div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          {[
            ["COD Collected", t.cod_collected],
            ["COD Handed Over", t.cod_handed_over],
            ["COD Balance", t.cod_balance],
            ["Completed Jobs", t.completed_jobs],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl bg-white p-5 shadow-sm border">
              <p className="text-sm font-black uppercase text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-black">{Number(value || 0).toLocaleString()}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm border">
          <h2 className="text-xl font-black">Wallet Ledger</h2>
          <div className="mt-4 space-y-2">
            {ledger.map((r: any) => (
              <div key={r.id} className="rounded-2xl border p-4">
                <div className="flex justify-between gap-3">
                  <b>{r.ledger_type}</b>
                  <b>{Number(r.amount || 0).toLocaleString()} MMK</b>
                </div>
                <p className="text-sm text-slate-500">{r.pickup_id} · {r.created_at}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
