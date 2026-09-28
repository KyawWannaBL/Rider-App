// @ts-nocheck
// Compatibility contract: be_rider_history_snapshot. Runtime history uses be_field_team_history_snapshot_v1.
import { useEffect, useMemo, useState } from "react";
import { FileCheck2, HelpCircle, RefreshCw, WalletCards } from "lucide-react";
import { supabase } from "../integrations/supabase/client";
import { useAppState } from "../hooks/useAppState";

function badge(status:any){
  const s=String(status||"UNKNOWN").toUpperCase();
  if(["DELIVERED","COMPLETED","APPROVED","VERIFIED","SETTLED","CLEARED","FINANCE_SETTLED","RESOLVED","CLOSED"].includes(s)) return "bg-emerald-100 text-emerald-800";
  if(["FAILED_DELIVERY","DELIVERY_FAILED","REJECTED","RTO","RETURN_TO_WAREHOUSE"].includes(s)) return "bg-rose-100 text-rose-800";
  return "bg-amber-100 text-amber-800";
}
function money(v:any){return Number(v||0).toLocaleString()+" MMK";}

export default function History() {
  const { language } = useAppState();
  const tx = (en:string,my:string) => language === "my" ? my : en;
  const [data,setData]=useState<any>({pickups:[],deliveries:[],cod_settlements:[],documents:[],support_tickets:[],counts:{}});
  const [msg,setMsg]=useState(tx("Loading Rider history...","Rider မှတ်တမ်းကို ဖွင့်နေသည်..."));
  const [loading,setLoading]=useState(false);
  const [tab,setTab]=useState("delivery");
  const [search,setSearch]=useState("");

  async function load(){
    setLoading(true);
    const {data:result,error}=await (supabase as any).rpc("be_field_team_history_snapshot_v1",{p_limit:300});
    if(error){setMsg(error.message);setLoading(false);return;}
    if(result?.ok===false){setMsg(result?.error||"Unable to load history.");setLoading(false);return;}
    setData(result||{});
    setMsg(tx("History synchronized with Enterprise operational, Finance, Document and Support records.","မှတ်တမ်းကို Enterprise Operations, Finance, Document နှင့် Support records များနှင့် ချိတ်ဆက်ပြီးပါပြီ။"));
    setLoading(false);
  }

  useEffect(()=>{void load();},[]);

  const pickups=Array.isArray(data.pickups)?data.pickups:[];
  const deliveries=Array.isArray(data.deliveries)?data.deliveries:[];
  const cod=Array.isArray(data.cod_settlements)?data.cod_settlements:[];
  const documents=Array.isArray(data.documents)?data.documents:[];
  const support=Array.isArray(data.support_tickets)?data.support_tickets:[];
  const counts=data.counts||{};

  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase();
    const rows=tab==="pickup"?pickups:tab==="delivery"?deliveries:tab==="cod"?cod:tab==="documents"?documents:support;
    if(!q)return rows;
    return rows.filter((r:any)=>JSON.stringify(r).toLowerCase().includes(q));
  },[search,tab,pickups,deliveries,cod,documents,support]);

  const tabs=[
    ["pickup",tx("Pickup","Pickup"),counts.pickups||pickups.length],
    ["delivery",tx("Delivery","ပို့ဆောင်မှု"),counts.deliveries||deliveries.length],
    ["cod",tx("COD Settlement","COD စာရင်းရှင်း"),counts.cod_settlements||cod.length],
    ["documents",tx("Documents","စာရွက်စာတမ်း"),counts.documents||documents.length],
    ["support",tx("Support","အကူအညီ"),counts.support_tickets||support.length],
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black tracking-[0.35em] text-blue-600">BRITIUM EXPRESS</p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">{tx("Activity History","မှတ်တမ်း")}</h1>
              <p className="mt-2 font-semibold text-slate-600">{tx("One synchronized record of your completed pickup, delivery, COD, document and support activity.","Pickup, Delivery, COD, စာရွက်စာတမ်းနှင့် အကူအညီဆိုင်ရာ ပြီးစီးမှတ်တမ်းများကို တစ်နေရာတည်းတွင် ချိတ်ဆက်ပြသပါသည်။")}</p>
            </div>
            <button onClick={()=>void load()} disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/> {tx("Refresh","ပြန်ဖွင့်ရန်")}</button>
          </div>
          <div className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-900">{msg}</div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {tabs.map(([id,label,count]:any)=><button key={id} onClick={()=>setTab(id)} className={`rounded-2xl px-4 py-3 text-sm font-black ${tab===id?"bg-blue-700 text-white":"border border-slate-200 bg-white text-slate-700"}`}>{label} <span className="ml-1 opacity-75">{Number(count||0)}</span></button>)}
          </div>
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder={tx("Search this history...","ဤမှတ်တမ်းတွင် ရှာရန်...")} className="mt-4 h-11 w-full rounded-2xl border border-slate-200 px-4 font-semibold outline-none focus:border-blue-500"/>
        </section>

        <section className="space-y-3">
          {filtered.length===0 && <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center font-bold text-slate-500">{tx("No records found.","မှတ်တမ်းမတွေ့ပါ။")}</div>}

          {tab==="pickup" && filtered.map((r:any)=><div key={r.pickup_id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex justify-between gap-3"><div><b className="font-mono text-blue-700">{r.pickup_id}</b><p className="mt-1 font-black">{r.parcel_count} {tx("parcels","ပါဆယ်")} · {r.reviewed_count} {tx("reviewed","စစ်ဆေးပြီး")}</p></div><span className={`h-fit rounded-full px-3 py-1 text-xs font-black ${badge(r.reviewed_count>=r.parcel_count?"VERIFIED":"PENDING")}`}>{r.reviewed_count>=r.parcel_count?"VERIFIED":"PENDING"}</span></div><p className="mt-2 text-xs font-bold text-slate-500">{r.completed_at?new Date(r.completed_at).toLocaleString():"-"}</p></div>)}

          {tab==="delivery" && filtered.map((r:any)=><div key={r.delivery_way_id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><b className="font-mono text-blue-700">{r.delivery_way_id}</b><p className="mt-1 font-black">{r.recipient_name||"-"}</p><p className="text-sm font-semibold text-slate-600">{r.township||r.address||"-"}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${badge(r.stop_status||r.rider_status)}`}>{r.stop_status||r.rider_status||"-"}</span></div><div className="mt-3 flex flex-wrap gap-4 text-sm font-bold text-slate-600"><span>COD {money(r.cod_collected||r.cod_amount)}</span>{r.failed_reason&&<span>{tx("Reason","အကြောင်းပြချက်")}: {r.failed_reason}</span>}</div><p className="mt-2 text-xs font-bold text-slate-500">{r.completed_at?new Date(r.completed_at).toLocaleString():"-"}</p></div>)}

          {tab==="cod" && filtered.map((r:any)=><div key={r.id||r.delivery_way_id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><WalletCards className="mt-1 h-5 w-5 text-blue-700"/><div><b className="font-mono text-blue-700">{r.delivery_way_id}</b><p className="mt-1 font-black">{r.recipient_name||"-"}</p></div></div><span className={`rounded-full px-3 py-1 text-xs font-black ${badge(r.settlement_status)}`}>{r.settlement_status||"PENDING"}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm font-bold"><span>{tx("Expected","ရရှိရမည့်")}: {money(r.cod_expected)}</span><span>{tx("Collected","ကောက်ခံပြီး")}: {money(r.cod_collected)}</span><span>{tx("Reference","Reference")}: {r.settlement_reference||"-"}</span></div><p className="mt-2 text-xs font-bold text-slate-500">{r.updated_at?new Date(r.updated_at).toLocaleString():"-"}</p></div>)}

          {tab==="documents" && filtered.map((r:any)=><div key={r.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><FileCheck2 className="mt-1 h-5 w-5 text-blue-700"/><div><p className="font-black">{String(r.document_type||"document").replaceAll("_"," ")}</p><p className="text-sm font-semibold text-slate-600">{r.file_name||"-"}</p></div></div><span className={`rounded-full px-3 py-1 text-xs font-black ${badge(r.verification_status)}`}>{r.verification_status||"PENDING"}</span></div><p className="mt-2 text-xs font-bold text-slate-500">{r.created_at?new Date(r.created_at).toLocaleString():"-"}</p></div>)}

          {tab==="support" && filtered.map((r:any)=><div key={r.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><HelpCircle className="mt-1 h-5 w-5 text-blue-700"/><div><p className="font-black">{r.subject||r.ticket_type||"Support"}</p><p className="text-sm font-semibold text-slate-600">{r.message||"-"}</p><p className="mt-1 text-xs font-bold text-blue-700">{r.cs_ticket_no||""}</p></div></div><span className={`rounded-full px-3 py-1 text-xs font-black ${badge(r.enterprise_status||r.status)}`}>{r.enterprise_status||r.status||"OPEN"}</span></div><p className="mt-2 text-xs font-bold text-slate-500">{r.created_at?new Date(r.created_at).toLocaleString():"-"}</p></div>)}
        </section>
      </div>
    </div>
  );
}
