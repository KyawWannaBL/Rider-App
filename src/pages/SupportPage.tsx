// @ts-nocheck
import { useEffect, useState } from "react";
import { LifeBuoy, RefreshCw, Send } from "lucide-react";
import { supabase } from "../integrations/supabase/client";
import { useAppState } from "../hooks/useAppState";

export default function SupportPage(){
  const { language } = useAppState();
  const tx=(en:string,my:string)=>language==="my"?my:en;
  const [form,setForm]=useState({pickup_id:"",ticket_type:"delivery_issue",priority:"normal",subject:"",message:""});
  const [tickets,setTickets]=useState<any[]>([]);
  const [identity,setIdentity]=useState<any>({});
  const [msg,setMsg]=useState(tx("Loading Enterprise support tickets...","Enterprise အကူအညီ Ticket များကို ဖွင့်နေသည်..."));
  const [loading,setLoading]=useState(false);

  async function load(){
    setLoading(true);
    const {data,error}=await (supabase as any).rpc("be_rider_support_snapshot",{p_limit:100});
    if(error){setMsg(error.message);setLoading(false);return;}
    setTickets(Array.isArray(data?.tickets)?data.tickets:[]);
    setIdentity(data?.identity||{});
    setMsg(tx("Support synchronized with Enterprise Customer Service / Operations.","အကူအညီတောင်းဆိုမှုကို Enterprise Customer Service / Operations နှင့် ချိတ်ဆက်ပြီးပါပြီ။"));
    setLoading(false);
  }

  async function save(){
    if(!form.message.trim())return setMsg(tx("Support message is required.","အကူအညီတောင်းဆိုသည့် အကြောင်းအရာ ဖြည့်ရန်လိုအပ်ပါသည်။"));
    setLoading(true);
    const {data,error}=await (supabase as any).rpc("be_rider_support_ticket_save",{p_payload:form});
    if(error || data?.ok===false){
      setMsg(error?.message||data?.error||tx("Unable to submit support ticket.","အကူအညီ Ticket တင်သွင်း၍မရပါ။"));
      setLoading(false);
      return;
    }
    setMsg(tx(
      `Support submitted to Enterprise CS/Operations${data?.cs_ticket_no?` as ${data.cs_ticket_no}`:""}.`,
      `Enterprise CS/Operations သို့ တင်သွင်းပြီးပါပြီ${data?.cs_ticket_no?` — ${data.cs_ticket_no}`:""}။`
    ));
    setForm({...form,subject:"",message:""});
    await load();
  }

  useEffect(()=>{void load();},[]);

  return <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black tracking-[0.3em] text-blue-600">BRITIUM EXPRESS</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">{tx("Help & Support","အကူအညီ")}</h1>
            <p className="mt-2 font-semibold text-slate-600">{tx("Raise delivery, COD, pickup, app or emergency issues directly to Enterprise Customer Service and Operations.","Delivery, COD, Pickup, App Error သို့မဟုတ် အရေးပေါ်ပြဿနာများကို Enterprise Customer Service နှင့် Operations သို့ တိုက်ရိုက်တင်ပြနိုင်ပါသည်။")}</p>
            <p className="mt-2 text-sm font-bold text-slate-500">{identity?.display_name||identity?.worker_code||"Field Team"} · {identity?.worker_code||"-"} · {String(identity?.role||"-").toUpperCase()}</p>
          </div>
          <button onClick={()=>void load()} disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/>{tx("Refresh","ပြန်ဖွင့်ရန်")}</button>
        </div>
        <div className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-900">{msg}</div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2"><LifeBuoy className="h-5 w-5 text-blue-700"/><h2 className="text-xl font-black">{tx("Open Support Ticket","အကူအညီ Ticket အသစ်")}</h2></div>
          <div className="mt-5 grid gap-3">
            <input className="rounded-2xl border border-slate-200 p-3 font-bold" placeholder={tx("Pickup / Delivery Way ID (optional)","Pickup / Delivery Way ID (မရှိလည်းရ)")} value={form.pickup_id} onChange={e=>setForm({...form,pickup_id:e.target.value})}/>
            <select className="rounded-2xl border border-slate-200 p-3 font-bold" value={form.ticket_type} onChange={e=>setForm({...form,ticket_type:e.target.value})}>
              <option value="delivery_issue">{tx("Delivery Issue","Delivery ပြဿနာ")}</option>
              <option value="cod_issue">{tx("COD Issue","COD ပြဿနာ")}</option>
              <option value="pickup_issue">{tx("Pickup Issue","Pickup ပြဿနာ")}</option>
              <option value="app_error">{tx("App Error","App Error")}</option>
              <option value="account_issue">{tx("Account / Login Issue","Account / Login ပြဿနာ")}</option>
              <option value="emergency">{tx("Emergency","အရေးပေါ်")}</option>
            </select>
            <select className="rounded-2xl border border-slate-200 p-3 font-bold" value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>
              <option value="normal">{tx("Normal","ပုံမှန်")}</option>
              <option value="high">{tx("High","အရေးကြီး")}</option>
              <option value="urgent">{tx("Urgent","အရေးပေါ်")}</option>
            </select>
            <input className="rounded-2xl border border-slate-200 p-3 font-bold" placeholder={tx("Subject","ခေါင်းစဉ်")} value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}/>
            <textarea className="min-h-[150px] rounded-2xl border border-slate-200 p-3 font-bold" placeholder={tx("Describe the issue clearly","ပြဿနာအကြောင်းကို ရှင်းလင်းစွာရေးပါ")} value={form.message} onChange={e=>setForm({...form,message:e.target.value})}/>
          </div>
          <button onClick={()=>void save()} disabled={loading||!form.message.trim()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 p-4 font-black text-white disabled:opacity-50"><Send className="h-5 w-5"/>{tx("Submit to Customer Service / Operations","Customer Service / Operations သို့ တင်သွင်းမည်")}</button>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">{tx("My Support History","အကူအညီတောင်းဆိုမှု မှတ်တမ်း")}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{tickets.length}</span></div>
          <div className="mt-4 space-y-3">
            {tickets.length===0?<p className="rounded-2xl bg-slate-50 p-6 text-center font-bold text-slate-500">{tx("No support tickets yet.","အကူအညီ Ticket မရှိသေးပါ။")}</p>:tickets.map(t=>{
              const status=String(t.status||"OPEN").toUpperCase();
              const cls=["RESOLVED","CLOSED"].includes(status)?"bg-emerald-100 text-emerald-800":status==="REJECTED"?"bg-rose-100 text-rose-800":"bg-amber-100 text-amber-800";
              return <div key={t.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-black">{t.subject||t.ticket_type||"Support ticket"}</p><p className="mt-1 text-sm font-semibold text-slate-600">{t.message||"-"}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${cls}`}>{status}</span></div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500"><span>{t.pickup_id||"-"}</span><span>·</span><span>{String(t.priority||"normal").toUpperCase()}</span><span>·</span><span>{t.created_at?new Date(t.created_at).toLocaleString():"-"}</span></div>
              </div>
            })}
          </div>
        </div>
      </section>
    </div>
  </div>;
}
