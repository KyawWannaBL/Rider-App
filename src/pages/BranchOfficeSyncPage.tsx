import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { loadRiderBranchSnapshot } from "@/lib/branchOfficeSyncApi";

export default function BranchOfficeSyncPage() {
  const [data,setData]=useState<any>(null);
  const [message,setMessage]=useState("Loading authenticated branch assignment...");
  const [loading,setLoading]=useState(false);

  async function load(){
    setLoading(true);
    try{
      setMessage("Synchronizing with Enterprise Branch Office...");
      const result=await loadRiderBranchSnapshot();
      setData(result);
      setMessage("Branch assignment synchronized from Enterprise.");
    }catch(error:any){
      setMessage(`Branch sync failed: ${error.message}`);
    }finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);

  const branch=data?.branch||{};
  const assignment=data?.assignment||{};
  const identity=data?.identity||{};
  const pickups=Array.isArray(data?.pickups)?data.pickups:[];

  return <main className="min-h-screen bg-slate-50 p-4 sm:p-6"><div className="mx-auto max-w-6xl space-y-5">
   <section className="rounded-3xl border bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.3em] text-blue-600">Britium Rider App</p><h1 className="mt-2 text-3xl font-black">Branch Office Sync</h1><p className="mt-2 font-bold text-slate-600">{identity.display_name||identity.worker_code||"Rider"} · {identity.worker_code||"-"}</p></div><button onClick={load} disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-blue-700 px-4 text-sm font-black text-white"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/>Sync</button></div><div className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-900">{message}</div></section>
   <section className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Assigned Branch</h2><div className="mt-3 grid gap-3 md:grid-cols-4"><Card label="Branch Code" value={branch.branch_code||assignment.branch_code||data?.branch_code}/><Card label="Branch Name" value={branch.branch_name}/><Card label="City / Region" value={[branch.city,branch.region_name||branch.region].filter(Boolean).join(" / ")}/><Card label="Status" value={branch.status||assignment.status}/></div>{branch.address&&<p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">{branch.address}</p>}</section>
   <section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xl font-black">Assigned Pickups</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{pickups.length}</span></div><div className="mt-3 space-y-3">{pickups.map((p:any)=><div key={p.id||p.pickup_id||p.pickup_way_id} className="rounded-2xl border p-4"><p className="font-mono font-black text-blue-700">{p.pickup_id||p.pickup_way_id||p.waybill_no}</p><p className="mt-1 font-bold">{p.merchant_name||p.merchant_code||"-"}</p><p className="mt-1 text-sm text-slate-600">{p.pickup_address||p.township||"-"} · {p.mobile_status||p.status||"ASSIGNED"}</p></div>)}{pickups.length===0&&<p className="rounded-2xl bg-slate-50 p-5 text-slate-500">No branch pickups currently assigned to this authenticated worker.</p>}</div></section>
  </div></main>;
}

function Card({label,value}:{label:string;value:any}){return <div className="rounded-2xl border p-4"><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-1 text-lg font-black">{value||"-"}</p></div>}
