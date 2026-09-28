// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, RefreshCw, Smartphone, UploadCloud } from "lucide-react";
import { supabase } from "../integrations/supabase/client";
import { useAppState } from "../hooks/useAppState";

function money(v:any){ return Number(v||0).toLocaleString()+" MMK"; }

export default function CodSettlementPage(){
  const { language } = useAppState();
  const tx=(en:string,my:string)=>language==="my"?my:en;
  const [jobs,setJobs]=useState<any[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [message,setMessage]=useState(tx("Loading delivered COD records...","ပို့ဆောင်ပြီး COD မှတ်တမ်းများကို ဖွင့်နေသည်..."));
  const [loading,setLoading]=useState(false);
  const [proof,setProof]=useState({name:"",data_url:""});
  const [note,setNote]=useState("");
  const [search,setSearch]=useState("");

  async function load(){
    setLoading(true);
    const {data,error}=await (supabase as any).rpc("be_field_team_cod_handover_queue_v1",{p_limit:300});
    if(error){
      setMessage(error.message);
      setLoading(false);
      return;
    }
    if(data?.ok===false){
      setMessage(data?.error||data?.code||tx("Unable to load COD handover queue.","COD လွှဲပြောင်းစာရင်းကို ဖွင့်၍မရပါ။"));
      setLoading(false);
      return;
    }
    const rows=Array.isArray(data?.jobs)?data.jobs:[];
    setJobs(rows);
    setSelectedId((current)=>current && rows.some((r:any)=>r.delivery_way_id===current)?current:(rows[0]?.delivery_way_id||""));
    setMessage(tx(
      `Synchronized ${rows.length} delivered COD record(s). ${Number(data?.pending_count||0)} pending Finance handover.`,
      `ပို့ဆောင်ပြီး COD မှတ်တမ်း ${rows.length} ခု ချိတ်ဆက်ပြီးပါပြီ။ Finance လွှဲပြောင်းရန် ${Number(data?.pending_count||0)} ခု စောင့်နေပါသည်။`
    ));
    setLoading(false);
  }

  useEffect(()=>{ void load(); },[]);

  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase();
    if(!q)return jobs;
    return jobs.filter((r:any)=>[
      r.delivery_way_id,r.waybill_no,r.recipient_name,r.recipient_phone,r.township,
      r.vehicle_code,r.rider_name,r.driver_name,r.helper_name,r.cod_settlement_status
    ].filter(Boolean).join(" ").toLowerCase().includes(q));
  },[jobs,search]);

  const selected=jobs.find((r:any)=>r.delivery_way_id===selectedId)||null;
  const status=String(selected?.cod_settlement_status||"PENDING_HANDOVER").toUpperCase();
  const cleared=["CLEARED","SETTLED","FINANCE_SETTLED"].includes(status);
  const submitted=["SUBMITTED_TO_FINANCE","PENDING_FINANCE"].includes(status);

  function selectFile(file?:File){
    if(!file)return;
    if(file.size>6*1024*1024){
      setMessage(tx("Proof photo must be 6 MB or less.","သက်သေဓာတ်ပုံသည် 6 MB ထက်မကျော်ရပါ။"));
      return;
    }
    const reader=new FileReader();
    reader.onload=()=>setProof({name:file.name,data_url:String(reader.result||"")});
    reader.readAsDataURL(file);
  }

  async function submit(){
    if(!selected?.delivery_way_id)return;
    if(cleared){
      setMessage(tx("This COD settlement is already cleared.","ဤ COD စာရင်းရှင်းတမ်းကို Cleared ပြုလုပ်ပြီးပါပြီ။"));
      return;
    }
    setLoading(true);
    const {data,error}=await (supabase as any).rpc("be_field_team_cod_handover_submit_v1",{
      p_delivery_way_id:selected.delivery_way_id,
      p_proof_photo_name:proof.name||null,
      p_proof_photo_data_url:proof.data_url||null,
      p_note:note.trim()||null,
    });
    if(error || data?.ok===false){
      setMessage(error?.message||data?.error||data?.code||tx("COD handover failed.","COD လွှဲပြောင်းမှု မအောင်မြင်ပါ။"));
      setLoading(false);
      return;
    }
    setMessage(tx(
      `${selected.delivery_way_id}: COD handover submitted to Finance. Reference ${data.settlement_reference||"-"}.`,
      `${selected.delivery_way_id}: COD ကို Finance သို့ လွှဲပြောင်းတင်သွင်းပြီးပါပြီ။ Reference ${data.settlement_reference||"-"}။`
    ));
    setProof({name:"",data_url:""});
    setNote("");
    await load();
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black tracking-[0.3em] text-blue-600">BRITIUM EXPRESS</p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">{tx("COD Handover & Settlement","COD ငွေလွှဲပြောင်း / စာရင်းရှင်းခြင်း")}</h1>
              <p className="mt-2 font-semibold text-slate-600">{tx(
                "Only completed deliveries are shown. Expected and collected COD values are read-only and synchronized from Data Entry and Delivery.",
                "ပို့ဆောင်ပြီး Way များကိုသာ ပြသပါသည်။ ရရှိရမည့် COD နှင့် ကောက်ခံပြီး COD တန်ဖိုးများကို Data Entry နှင့် Delivery မှ အလိုအလျောက်ချိတ်ဆက်ထားပြီး ပြင်ဆင်၍မရပါ။"
              )}</p>
            </div>
            <button onClick={()=>void load()} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`} /> {tx("Synchronize","ချိတ်ဆက်ပြန်ယူရန်")}
            </button>
          </div>
          <div className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-900">{message}</div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder={tx("Search Way ID / recipient / status","Way ID / လက်ခံသူ / Status ရှာရန်")} className="mb-3 h-11 w-full rounded-2xl border border-slate-200 px-4 font-semibold outline-none focus:border-blue-500"/>
            <div className="max-h-[720px] space-y-3 overflow-y-auto">
              {filtered.length===0 && <div className="rounded-2xl bg-slate-50 p-6 text-center font-bold text-slate-500">{tx("No delivered COD records.","ပို့ဆောင်ပြီး COD မှတ်တမ်း မရှိပါ။")}</div>}
              {filtered.map((r:any)=>{
                const active=r.delivery_way_id===selectedId;
                const s=String(r.cod_settlement_status||"PENDING_HANDOVER").toUpperCase();
                return <button key={r.delivery_way_id} onClick={()=>setSelectedId(r.delivery_way_id)} className={`w-full rounded-2xl border p-4 text-left transition ${active?"border-blue-500 bg-blue-50":"border-slate-200 bg-white hover:bg-slate-50"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-mono text-sm font-black text-blue-700">{r.delivery_way_id}</p><p className="mt-1 font-black text-slate-950">{r.recipient_name||"-"}</p></div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black">{s}</span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-600">{money(r.authoritative_cod_collected||r.cod_collected)}</p>
                  <p className="mt-1 text-xs text-slate-500">{r.township||"-"} · {r.payment_mode||"CASH"}</p>
                </button>
              })}
            </div>
          </aside>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            {!selected ? <div className="p-10 text-center font-bold text-slate-500">{tx("Select a delivered Way.","ပို့ဆောင်ပြီး Way တစ်ခုရွေးပါ။")}</div> : <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><p className="font-mono text-sm font-black text-blue-700">{selected.delivery_way_id}</p><h2 className="mt-1 text-2xl font-black text-slate-950">{selected.recipient_name||"-"}</h2><p className="text-sm font-semibold text-slate-500">{selected.address||selected.township||"-"}</p></div>
                <span className={`rounded-full px-3 py-2 text-xs font-black ${cleared?"bg-emerald-100 text-emerald-800":submitted?"bg-blue-100 text-blue-800":"bg-amber-100 text-amber-800"}`}>{status}</span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">{tx("Expected COD","ရရှိရမည့် COD")}</p><p className="mt-2 text-xl font-black">{money(selected.authoritative_cod_expected||selected.calculated_cod_amount||selected.cod_amount)}</p></div>
                <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">{tx("Collected COD","ကောက်ခံပြီး COD")}</p><p className="mt-2 text-xl font-black">{money(selected.authoritative_cod_collected||selected.cod_collected)}</p></div>
                <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">{tx("Payment Channel","ငွေပေးချေမှုနည်းလမ်း")}</p><p className="mt-2 flex items-center gap-2 text-lg font-black">{String(selected.payment_mode||"CASH").toUpperCase()==="CASH"?<Banknote className="h-5 w-5"/>:<Smartphone className="h-5 w-5"/>}{selected.payment_mode||"CASH"}</p></div>
                <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">{tx("Vehicle / Wayplan","ယာဉ် / Wayplan")}</p><p className="mt-2 text-sm font-black">{selected.vehicle_code||selected.vehicle_name||"-"}</p><p className="text-xs font-bold text-slate-500">{selected.wayplan_id||"-"}</p></div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border p-4"><p className="text-xs font-black text-slate-500">Rider</p><p className="mt-1 font-black">{selected.rider_name||selected.rider_code||"-"}</p></div>
                <div className="rounded-2xl border p-4"><p className="text-xs font-black text-slate-500">Driver</p><p className="mt-1 font-black">{selected.driver_name||selected.driver_code||"-"}</p></div>
                <div className="rounded-2xl border p-4"><p className="text-xs font-black text-slate-500">Helper</p><p className="mt-1 font-black">{selected.helper_name||selected.helper_code||"-"}</p></div>
              </div>

              {!cleared && <>
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-4">
                  <label className="flex cursor-pointer items-center gap-3 font-black text-slate-700"><UploadCloud className="h-5 w-5"/>{tx("Attach handover proof photo (optional)","ငွေလွှဲပြောင်းသက်သေဓာတ်ပုံ ထည့်ရန် (မလိုအပ်လျှင်ကျော်နိုင်)")}</label>
                  <input type="file" accept="image/*" capture="environment" onChange={(e)=>selectFile(e.target.files?.[0])} className="mt-3 w-full rounded-xl border p-3"/>
                  {proof.name && <p className="mt-2 text-sm font-bold text-blue-700">{proof.name}</p>}
                  {proof.data_url && <img src={proof.data_url} className="mt-3 h-44 rounded-2xl object-cover"/>}
                </div>
                <textarea value={note} onChange={(e)=>setNote(e.target.value)} placeholder={tx("Handover note (optional)","လွှဲပြောင်းမှတ်ချက် (မလိုအပ်လျှင်ကျော်နိုင်)")} className="mt-4 min-h-[100px] w-full rounded-2xl border border-slate-200 p-4 font-semibold outline-none focus:border-blue-500"/>
                <button onClick={()=>void submit()} disabled={loading || submitted || !selected.eligible_to_handover} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 font-black text-white disabled:opacity-50">
                  {submitted?<><CheckCircle2 className="h-5 w-5"/>{tx("Submitted to Finance","Finance သို့တင်သွင်းပြီး")}</>:tx("Submit COD Handover to Finance","COD ကို Finance သို့ လွှဲပြောင်းတင်သွင်းမည်")}
                </button>
              </>}
              {cleared && <div className="mt-5 flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 font-black text-emerald-800"><CheckCircle2 className="h-5 w-5"/>{tx("Finance settlement cleared.","Finance စာရင်းရှင်းတမ်း Cleared ဖြစ်ပြီးပါပြီ။")}</div>}
            </>}
          </section>
        </div>
      </div>
    </div>
  );
}
