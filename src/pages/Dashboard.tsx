// @ts-nocheck
import { useEffect, useState } from "react";
import { Bell, Building2, Package, RefreshCw, Truck, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";

function money(value:any){ return Number(value||0).toLocaleString()+" MMK"; }

export default function Dashboard() {
  const [data,setData]=useState<any>({counts:{},wallet:{},pickups:[],deliveries:[],notifications:[],identity:{},branch:{}});
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("Loading Enterprise Portal status...");

  async function load(){
    setLoading(true);
    const {data:result,error}=await (supabase as any).rpc("be_rider_dashboard_snapshot");
    if(error){ setMessage(error.message); setLoading(false); return; }
    setData(result||{});
    setMessage("Enterprise Portal synchronized.");
    setLoading(false);
  }
  useEffect(()=>{load();},[]);

  const counts=data.counts||{};
  const wallet=data.wallet||{};
  const cards=[
    ["Assigned Pickups",counts.pickups||counts.pickup_jobs||0,Truck],
    ["Delivery Jobs",counts.deliveries||counts.delivery_jobs||0,Package],
    ["Unread / Active Notifications",counts.notifications||0,Bell],
    ["COD Balance",money(wallet.cod_balance||0),WalletCards],
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black tracking-[0.35em] text-blue-600">BRITIUM EXPRESS</p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">Rider Dashboard</h1>
              <p className="mt-2 font-semibold text-slate-600">
                Live assignments, delivery work, notifications, COD and branch information synchronized with Enterprise Portal.
              </p>
              <p className="mt-2 text-sm font-bold text-slate-500">
                {data.identity?.display_name||data.identity?.worker_code||"Rider"} · {data.identity?.worker_code||"-"} · {data.identity?.branch_code||"No branch"}
              </p>
            </div>
            <button onClick={load} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`} /> Sync Enterprise
            </button>
          </div>
          <div className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-900">{message}</div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(([label,value,Icon]:any)=>(
            <div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p><Icon className="h-5 w-5 text-blue-700"/></div>
              <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Link to="/jobs" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:bg-blue-50">
            <h2 className="text-xl font-black text-slate-950">Pickup Verification</h2>
            <p className="mt-2 font-semibold text-slate-600">Open Enterprise-assigned pickups, capture proof, weight, and submit parcels for review.</p>
          </Link>
          <Link to="/delivery" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:bg-blue-50">
            <h2 className="text-xl font-black text-slate-950">Delivery / Drop-Off</h2>
            <p className="mt-2 font-semibold text-slate-600">Open Enterprise Wayplan stops and complete strict delivery verification.</p>
          </Link>
          <Link to="/cod-settlement" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:bg-blue-50">
            <h2 className="text-xl font-black text-slate-950">COD Settlement</h2>
            <p className="mt-2 font-semibold text-slate-600">Submit delivered COD to Finance using authoritative Enterprise values.</p>
          </Link>
          <Link to="/branch-sync" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:bg-blue-50">
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-950"><Building2 className="h-5 w-5"/> Branch Sync</h2>
            <p className="mt-2 font-semibold text-slate-600">View your authenticated branch assignment and branch pickup workload.</p>
          </Link>
        </section>
      </div>
    </div>
  );
}
