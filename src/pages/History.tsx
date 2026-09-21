// @ts-nocheck
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../integrations/supabase/client";
import { useAppState } from "../hooks/useAppState";

export default function History() {
  const { language } = useAppState();
  const tx = (en:string,my:string) => language === "my" ? my : en;
  const [data,setData]=useState<any>({pickups:[],deliveries:[],counts:{}});
  const [msg,setMsg]=useState(language === "my" ? "Rider မှတ်တမ်းကို ဖွင့်နေသည်..." : "Loading Rider history...");
  const [loading,setLoading]=useState(false);
  async function load(){
    setLoading(true);
    const {data:result,error}=await (supabase as any).rpc("be_rider_history_snapshot",{p_limit:200});
    if(error){setMsg(error.message);setLoading(false);return;}
    setData(result||{});
    setMsg(tx("History synchronized with Enterprise records.","မှတ်တမ်းကို Enterprise records နှင့် ချိတ်ဆက်ပြီးပါပြီ။"));
    setLoading(false);
  }
  useEffect(()=>{load();},[]);
  const pickups=Array.isArray(data.pickups)?data.pickups:[];
  const deliveries=Array.isArray(data.deliveries)?data.deliveries:[];
  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-xs font-black tracking-[0.35em] text-blue-600">BRITIUM EXPRESS</p><h1 className="mt-2 text-3xl font-black text-slate-950">{tx("Rider History","Rider မှတ်တမ်း")}</h1><p className="mt-2 font-semibold text-slate-600">{tx("Completed pickup proof and delivery history from Enterprise Portal.","Enterprise Portal မှ ပြီးဆုံးသော Pickup သက်သေနှင့် ပို့ဆောင်မှုမှတ်တမ်းများ။")}</p></div>
            <button onClick={load} disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/> {tx("Refresh","ပြန်ဖွင့်ရန်")}</button>
          </div>
          <div className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-900">{msg}</div>
        </section>
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-black">{tx("Pickup Verification History","Pickup စစ်ဆေးမှုမှတ်တမ်း")}</h2><div className="mt-4 space-y-3">{pickups.length===0?<p className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">{tx("No pickup history yet.","Pickup မှတ်တမ်း မရှိသေးပါ။")}</p>:pickups.map((r:any)=><div key={r.pickup_id} className="rounded-2xl border p-4"><b className="font-mono text-blue-700">{r.pickup_id}</b><p className="mt-1 text-sm font-bold">{r.parcel_count} parcels · {r.reviewed_count} reviewed</p><p className="mt-1 text-xs text-slate-500">{r.completed_at?new Date(r.completed_at).toLocaleString():"-"}</p></div>)}</div></div>
          <div className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-black">{tx("Delivery History","ပို့ဆောင်မှုမှတ်တမ်း")}</h2><div className="mt-4 space-y-3">{deliveries.length===0?<p className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">{tx("No completed delivery history yet.","ပြီးဆုံးသော ပို့ဆောင်မှုမှတ်တမ်း မရှိသေးပါ။")}</p>:deliveries.map((r:any)=><div key={r.delivery_way_id} className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-3"><b className="font-mono text-blue-700">{r.delivery_way_id}</b><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{r.stop_status||r.rider_status}</span></div><p className="mt-2 font-bold">{r.recipient_name||"-"}</p><p className="text-sm text-slate-600">{r.township||r.address||"-"}</p><p className="mt-1 text-xs text-slate-500">{r.completed_at?new Date(r.completed_at).toLocaleString():"-"}</p></div>)}</div></div>
        </section>
      </div>
    </div>
  );
}
