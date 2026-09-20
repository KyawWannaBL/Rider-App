// @ts-nocheck
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../integrations/supabase/client";

export default function SupportPage(){
 const [form,setForm]=useState({pickup_id:"",ticket_type:"delivery_issue",priority:"normal",subject:"",message:""});
 const [tickets,setTickets]=useState<any[]>([]);
 const [msg,setMsg]=useState("Loading Enterprise support tickets...");
 const [loading,setLoading]=useState(false);

 async function load(){
  setLoading(true);
  const {data,error}=await (supabase as any).rpc("be_rider_support_snapshot",{p_limit:100});
  if(error){setMsg(error.message);setLoading(false);return;}
  setTickets(Array.isArray(data?.tickets)?data.tickets:[]);
  setMsg("Support synchronized with Enterprise CS/Operations queue.");
  setLoading(false);
 }

 async function save(){
  if(!form.message.trim())return setMsg("Support message is required.");
  setLoading(true);
  const {data,error}=await (supabase as any).rpc("be_rider_support_ticket_save",{p_payload:form});
  if(error){setMsg(error.message);setLoading(false);return;}
  setMsg(`Support submitted to Enterprise CS/Operations${data?.cs_ticket_no?` as ${data.cs_ticket_no}`:""}.`);
  setForm({...form,subject:"",message:""});
  await load();
 }

 useEffect(()=>{load();},[]);

 return <div className="min-h-screen bg-slate-50 p-4 sm:p-6"><div className="mx-auto max-w-5xl space-y-5">
  <section className="rounded-3xl border bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-4"><div><h1 className="text-3xl font-black">Rider Support</h1><p className="mt-2 font-semibold text-slate-600">Rider issues are synchronized directly into Enterprise Customer Service / Operations.</p></div><button onClick={load} disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/>Refresh</button></div><div className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-900">{msg}</div></section>
  <section className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
   <div className="rounded-3xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Open Support Ticket</h2><div className="mt-5 grid gap-3"><input className="rounded-2xl border p-3 font-bold" placeholder="Pickup / Delivery ID" value={form.pickup_id} onChange={e=>setForm({...form,pickup_id:e.target.value})}/><select className="rounded-2xl border p-3 font-bold" value={form.ticket_type} onChange={e=>setForm({...form,ticket_type:e.target.value})}><option value="delivery_issue">Delivery Issue</option><option value="emergency">Emergency</option><option value="cod_issue">COD Issue</option><option value="pickup_issue">Pickup Issue</option><option value="app_error">App Error</option></select><select className="rounded-2xl border p-3 font-bold" value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select><input className="rounded-2xl border p-3 font-bold" placeholder="Subject" value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}/><textarea className="min-h-[140px] rounded-2xl border p-3 font-bold" placeholder="Message" value={form.message} onChange={e=>setForm({...form,message:e.target.value})}/></div><button onClick={save} disabled={loading||!form.message.trim()} className="mt-5 w-full rounded-2xl bg-blue-700 p-4 font-black text-white disabled:opacity-50">Submit to Enterprise Operations</button></div>
   <div className="rounded-3xl border bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xl font-black">My Support History</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{tickets.length} tickets</span></div><div className="mt-4 space-y-3">{tickets.length===0?<p className="rounded-2xl bg-slate-50 p-6 text-center font-bold text-slate-500">No support tickets yet.</p>:tickets.map(t=><div key={t.id} className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-black">{t.subject||t.ticket_type||"Support ticket"}</p><p className="mt-1 text-sm text-slate-600">{t.message||"-"}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{t.status||"OPEN"}</span></div><p className="mt-2 text-xs font-bold text-slate-500">{t.pickup_id||""} {t.created_at?new Date(t.created_at).toLocaleString():""}</p></div>)}</div></div>
  </section>
 </div></div>;
}
