import { useEffect, useState } from "react";
import { loadRiderBranchSnapshot } from "@/lib/branchOfficeSyncApi";

export default function BranchOfficeSyncPage() {
  const [riderCode, setRiderCode] = useState("RID001");
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState("Loading branch sync...");

  async function load() {
    try {
      setMessage("Synchronizing with Branch Office...");
      const result = await loadRiderBranchSnapshot(riderCode);
      setData(result);
      setMessage("Branch sync loaded.");
    } catch (error: any) {
      setMessage(`Branch sync failed: ${error.message}`);
    }
  }

  useEffect(() => { void load(); }, []);

  const branch = data?.branch || data?.branch_profile || {};
  const assignment = data?.assignment || data?.rider_assignment || {};
  const pickups = Array.isArray(data?.pickups) ? data.pickups : [];

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-600">Britium Rider App</p>
        <h1 className="mt-2 text-3xl font-black">Branch Office Sync</h1>
        <p className="mt-2 font-bold text-slate-600">{message}</p>
        <div className="mt-4 flex gap-2">
          <input value={riderCode} onChange={(e) => setRiderCode(e.target.value)} className="h-12 flex-1 rounded-2xl border px-4 font-bold" placeholder="Rider code" />
          <button onClick={load} className="rounded-2xl bg-blue-700 px-5 font-black text-white">Sync</button>
        </div>
      </section>

      <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">Assigned Branch</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Card label="Branch Code" value={branch.branch_code || assignment.branch_code} />
          <Card label="Branch Name" value={branch.branch_name} />
          <Card label="Status" value={branch.status || assignment.status} />
        </div>
      </section>

      <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">Assigned Pickups</h2>
        <div className="mt-3 space-y-3">
          {pickups.map((p: any) => (
            <div key={p.id || p.pickup_id || p.pickup_way_id} className="rounded-2xl border p-4">
              <p className="font-black text-blue-700">{p.pickup_id || p.pickup_way_id || p.waybill_no}</p>
              <p className="font-bold">{p.merchant_name}</p>
              <p className="text-sm text-slate-600">{p.pickup_township || p.delivery_township} · {p.status}</p>
            </div>
          ))}
          {pickups.length === 0 && <p className="rounded-2xl border p-4 text-slate-500">No branch pickups assigned.</p>}
        </div>
      </section>
    </main>
  );
}

function Card({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border p-4">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black">{value || "-"}</p>
    </div>
  );
}
