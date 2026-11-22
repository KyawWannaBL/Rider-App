import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowRight, Bell, CalendarDays, CheckCircle2,
  ClipboardList, Globe2, LogOut, MessageSquare, RefreshCw, Search,
  Send, ShieldCheck, Truck, Users, WalletCards
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAppState } from "../hooks/useAppState";
import { supabase } from "../integrations/supabase/client";

type Worker = {
  worker_code?: string; display_name?: string; workforce_role?: string;
  branch_code?: string; auth_user_id?: string | null; email?: string;
  active?: boolean; updated_at?: string | null;
};
type Job = {
  wayplan_id?: string; delivery_way_id?: string; pickup_id?: string;
  rider_code?: string; driver_code?: string; helper_code?: string;
  stop_status?: string; rider_status?: string; wayplan_status?: string;
  dispatched_at?: string; delivered_at?: string;
  cod_amount?: number; cod_collected?: number; failed_reason?: string;
  has_proof?: boolean;
};
type Settlement = {
  wayplan_id?: string; work_date?: string; rider_code?: string;
  driver_code?: string; helper_code?: string; total_ways?: number;
  delivered_ways?: number; failed_ways?: number; remaining_ways?: number;
  expected_cod?: number; actual_collected?: number; variance_amount?: number;
  status?: string; cleared_at?: string | null;
};
type Snapshot = {
  ok?: boolean; scope?: string; generated_at?: string;
  workforce?: Worker[]; jobs?: Job[]; settlements?: Settlement[];
  limitations?: string;
};
type Tab = "overview" | "staff" | "ways" | "finance" | "messages";

function localDay(date: Date) {
  const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0");
  return [y,m,String(date.getDate()).padStart(2,"0")].join("-");
}
function money(value: unknown) {
  return Number(value || 0).toLocaleString("en-US") + " MMK";
}
function isFinished(job: Job) {
  return ["DELIVERED","SUCCESS","COMPLETED","SETTLED"].includes(String(job.stop_status || job.rider_status || "").toUpperCase())
    || Boolean(job.delivered_at);
}
function isFailed(job: Job) {
  return ["FAILED","RTO","RETURNED","CANCELLED","CANCELED"].includes(String(job.stop_status || job.rider_status || "").toUpperCase());
}
function staffJobs(worker: Worker, jobs: Job[]) {
  const code=String(worker.worker_code||"").toUpperCase();
  return code ? jobs.filter(j=>[j.rider_code,j.driver_code,j.helper_code].some(c=>String(c||"").toUpperCase()===code)) : [];
}
function isDelayed(job: Job) {
  if(isFinished(job)||isFailed(job)||!job.dispatched_at)return false;
  const t=Date.parse(job.dispatched_at);
  return Number.isFinite(t) && Date.now()-t>24*60*60*1000;
}
const tabs: Array<{key:Tab,en:string,my:string,icon:typeof Users}> = [
  {key:"overview",en:"Overview",my:"အကျဉ်းချုပ်",icon:Activity},
  {key:"staff",en:"Workforce",my:"ဝန်ထမ်းများ",icon:Users},
  {key:"ways",en:"All assignments",my:"တာဝန်များ",icon:ClipboardList},
  {key:"finance",en:"Finance",my:"ငွေစာရင်း",icon:WalletCards},
  {key:"messages",en:"Messages",my:"စာပို့ရန်",icon:MessageSquare},
];
const box="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const button="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export default function RiderAdminPage() {
  const navigate=useNavigate();
  const {signOut,profile}=useAuth();
  const {language,toggleLanguage}=useAppState();
  const tx=(en:string,my:string)=>language==="my"?my:en;
  const [tab,setTab]=useState<Tab>("overview");
  const [start,setStart]=useState(()=>{const d=new Date();d.setDate(d.getDate()-14);return localDay(d);});
  const [end,setEnd]=useState(()=>localDay(new Date()));
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [query,setQuery]=useState("");
  const [workerFilter,setWorkerFilter]=useState("");
  const [targetId,setTargetId]=useState("");
  const [broadcast,setBroadcast]=useState(false);
  const [broadcastConfirmed,setBroadcastConfirmed]=useState(false);
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [sending,setSending]=useState(false);
  const [sentNotice,setSentNotice]=useState("");

  async function refresh(){
    if(!start||!end||start>end){setError(tx("Select a valid date range.","ရက်စွဲအပိုင်းအခြား မှန်ကန်စွာရွေးပါ။"));return;}
    setLoading(true);setError("");
    try{
      const {data,error:rpcError}=await (supabase as any).rpc("be_rider_admin_control_snapshot_v1",{p_from:start,p_to:end});
      if(rpcError)throw rpcError;
      if(data?.ok!==true||data?.scope!=="RIDER_ADMIN_VERIFIED")throw new Error(data?.error||"Admin access could not be verified.");
      setSnapshot(data);
    }catch(err:any){
      setSnapshot(null);
      setError(err?.message||"Rider Admin data is unavailable. Verify that the approved admin RPCs are deployed.");
    }finally{setLoading(false);}
  }
  useEffect(()=>{void refresh();},[]);

  const workers=Array.isArray(snapshot?.workforce)?snapshot.workforce:[];
  const jobs=Array.isArray(snapshot?.jobs)?snapshot.jobs:[];
  const settlements=Array.isArray(snapshot?.settlements)?snapshot.settlements:[];
  const visibleWorkers=workers.filter(w=>[w.worker_code,w.display_name,w.branch_code,w.email,w.workforce_role].some(x=>String(x||"").toLowerCase().includes(query.toLowerCase())));
  const filteredJobs=jobs.filter(j=>{
    const includesWorker=!workerFilter||[j.rider_code,j.driver_code,j.helper_code].some(c=>String(c||"").toUpperCase()===workerFilter.toUpperCase());
    return includesWorker&&[j.delivery_way_id,j.pickup_id,j.wayplan_id,j.rider_code,j.driver_code,j.helper_code,j.stop_status,j.rider_status].some(x=>String(x||"").toLowerCase().includes(query.toLowerCase()));
  });
  const outstanding=jobs.filter(j=>!isFinished(j)&&!isFailed(j));
  const delayed=outstanding.filter(isDelayed);
  const financeAlerts=settlements.filter(s=>Math.abs(Number(s.variance_amount||0))>0||(!s.cleared_at&&Number(s.remaining_ways||0)>0));
  const staffAlerts=workers.filter(w=>w.active&&!w.auth_user_id);
  const summary=useMemo(()=>({
    staff:workers.filter(w=>w.active).length,
    assigned:jobs.length,
    completed:jobs.filter(isFinished).length,
    remaining:outstanding.length,
    messages:financeAlerts.length
  }),[workers,jobs,financeAlerts.length,outstanding.length]);

  async function send(){
    setSentNotice("");
    if(!broadcast&&!targetId){setSentNotice(tx("Select a staff member.","ဝန်ထမ်းရွေးချယ်ပါ။"));return;}
    if(broadcast&&!broadcastConfirmed){setSentNotice(tx("Confirm the all-staff broadcast first.","ဝန်ထမ်းအားလုံးသို့ ပေးပို့ရန် အတည်ပြုပါ။"));return;}
    if(title.trim().length<4||body.trim().length<5){setSentNotice(tx("Enter a subject and a complete message.","ခေါင်းစဉ်နှင့် စာသားထည့်ပါ။"));return;}
    setSending(true);
    try{
      const {data,error:rpcError}=await (supabase as any).rpc("be_rider_admin_send_message_v1",{
        p_target_user_id:broadcast?null:targetId,
        p_title:title.trim(),p_message:body.trim(),p_broadcast:broadcast
      });
      if(rpcError)throw rpcError;
      if(data?.ok!==true)throw new Error(data?.error||"Notification was not sent.");
      setSentNotice(tx("Message sent to ","စာပို့ပြီးပါပြီ — ")+String(data.sent||0)+tx(" staff account(s)."," ဦး"));
      setBody("");setTitle("");setBroadcast(false);setBroadcastConfirmed(false);
    }catch(err:any){setSentNotice(err?.message||"Could not send message.");}
    finally{setSending(false);}
  }
  async function logout(){await signOut();navigate("/login",{replace:true});}
  return <div className="min-h-[100dvh] bg-[#f4f7fb] pb-14 text-slate-950">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#0c1832] font-black text-white">B</div>
          <div><p className="text-[10px] font-bold tracking-[0.25em] text-blue-700">BRITIUM EXPRESS</p>
          <h1 className="text-lg font-bold">{tx("Rider Operations Control","Rider လုပ်ငန်း စီမံခန့်ခွဲမှု")}</h1></div>
          <span className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-800">{tx("ADMIN","စီမံခန့်ခွဲသူ")}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleLanguage} className={button+" border border-slate-200 bg-white text-slate-700"}><Globe2 className="h-4 w-4"/>{language==="my"?"English":"မြန်မာ"}</button>
          <button type="button" onClick={()=>void logout()} className={button+" border border-slate-200 bg-white text-rose-700"}><LogOut className="h-4 w-4"/>{tx("Sign out","ထွက်ရန်")}</button>
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <section className="rounded-3xl bg-gradient-to-br from-[#0b1730] via-[#132b4a] to-[#153d60] p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">{tx("Workforce command center","ဝန်ထမ်းလုပ်ငန်း ထိန်းချုပ်ရေး")}</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{tx("All field operations, one view.","ဝန်ထမ်းအားလုံး၏ လုပ်ငန်းအခြေအနေ")}</h2>
            <p className="mt-2 text-sm text-slate-300">{profile?.identity?.display_name||"Rider Administrator"} · {tx("All branches · Authorized admin only","ဌာနခွဲအားလုံး · အခွင့်အာဏာရှိသူသာ")}</p>
          </div>
          <button type="button" onClick={()=>void refresh()} disabled={loading} className={button+" bg-amber-300 text-slate-950 hover:bg-amber-200"}><RefreshCw className={\`h-4 w-4 \${loading?"animate-spin":""}\`}/>{tx("Refresh live data","အချက်အလက် ပြန်လည်စစ်ဆေး")}</button>
        </div>
      </section>
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="min-w-[135px] flex-1 text-xs font-semibold text-slate-600">{tx("From","မှ")}<input type="date" value={start} onChange={e=>setStart(e.target.value)} className="mt-1 block h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950"/></label>
        <label className="min-w-[135px] flex-1 text-xs font-semibold text-slate-600">{tx("To","အထိ")}<input type="date" min={start} value={end} onChange={e=>setEnd(e.target.value)} className="mt-1 block h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950"/></label>
        <button type="button" onClick={()=>void refresh()} disabled={loading||start>end} className={button+" bg-blue-700 text-white"}><CalendarDays className="h-4 w-4"/>{tx("Apply dates","ရက်စွဲအသုံးပြုရန်")}</button>
      </div>
      {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800"><AlertTriangle className="mr-2 inline h-4 w-4"/>{error}<button type="button" className="ml-3 underline" onClick={()=>void refresh()}>{tx("Retry","ထပ်စမ်းရန်")}</button></div>}
      {snapshot&&<>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {([
            [tx("Active staff","လုပ်ဆောင်နေသောဝန်ထမ်း"),summary.staff,Users],
            [tx("Assigned ways","တာဝန်ပေးထားသော Way"),summary.assigned,ClipboardList],
            [tx("Completed ways","ပြီးစီးသော Way"),summary.completed,CheckCircle2],
            [tx("Outstanding ways","ကျန်ရှိသော Way"),summary.remaining,Truck],
            [tx("Settlement alerts","ငွေစာရင်းသတိပေးချက်"),summary.messages,WalletCards]
          ] as const).map(([label,value,Icon])=><div key={label} className={box}><Icon className="h-5 w-5 text-blue-700"/><p className="mt-3 text-3xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs font-semibold text-slate-600">{label}</p></div>)}
        </div>
        <nav role="tablist" aria-label={tx("Admin sections","စီမံခန့်ခွဲမှု ကဏ္ဍများ")} className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2">
          {tabs.map(({key,en,my,icon:Icon})=><button key={key} type="button" role="tab" aria-selected={tab===key} onClick={()=>{setTab(key);setQuery("")}} className={\`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold \${tab===key?"bg-blue-700 text-white":"text-slate-600 hover:bg-slate-100"}\`}><Icon className="h-4 w-4"/>{tx(en,my)}</button>)}
        </nav>
        {tab==="overview"&&<div className="grid gap-4 md:grid-cols-2">
          <div className={box}><h3 className="text-lg font-bold">{tx("Work needing attention","စောင့်ကြည့်ရန် လုပ်ငန်းများ")}</h3>
            <p className="mt-1 text-sm text-slate-500">{tx("Exceptions based on dispatch and delivery evidence.","ပို့ဆောင်မှုမှတ်တမ်းအပေါ်အခြေခံသော သတိပေးချက်များ")}</p>
            <div className="mt-4 space-y-3">
              {[
                [tx("Dispatched over 24 hours without an outcome","၂၄ နာရီအတွင်း အခြေအနေမပြောင်းသော Way"),delayed.length,"ways"],
                [tx("Active staff without linked login","Login မချိတ်ထားသော ဝန်ထမ်း"),staffAlerts.length,"staff"],
                [tx("Settlement variance / uncleared work","ငွေကွာဟမှု သို့မဟုတ် မရှင်းသေးသောအလုပ်"),financeAlerts.length,"finance"]
              ].map(([label,count,key])=><button type="button" key={key} onClick={()=>setTab(key==="staff"?"staff":key==="finance"?"finance":"ways")} className="flex min-h-14 w-full items-center justify-between rounded-xl bg-slate-50 px-4 text-left"><span className="text-sm font-semibold text-slate-700">{label}</span><span className="rounded-lg bg-white px-3 py-1 font-bold">{count}</span></button>)}
            </div>
          </div>
          <div className={box}><h3 className="text-lg font-bold">{tx("Control-room actions","စီမံခန့်ခွဲမှုလုပ်ဆောင်ချက်")}</h3>
            <p className="mt-1 text-sm text-slate-500">{tx("Review assignments and contact staff without leaving this workspace.","တာဝန်များစစ်ဆေးပြီး ဝန်ထမ်းထံတိုက်ရိုက်ဆက်သွယ်ရန်")}</p>
            <div className="mt-4 grid gap-2">
              {[["staff",tx("Review workforce progress","ဝန်ထမ်းတိုးတက်မှုစစ်ဆေးရန်"),Users],["ways",tx("Inspect all assigned ways","Way အားလုံးကြည့်ရန်"),ClipboardList],["finance",tx("Review settlements","ငွေစာရင်းစစ်ဆေးရန်"),WalletCards],["messages",tx("Send staff message","ဝန်ထမ်းထံ စာပို့ရန်"),MessageSquare]].map(([key,label,Icon]:any)=><button key={key} type="button" onClick={()=>setTab(key)} className="flex min-h-12 items-center justify-between rounded-xl border border-slate-200 px-4 text-left text-sm font-semibold hover:bg-blue-50"><span className="flex items-center gap-3"><Icon className="h-4 w-4 text-blue-700"/>{label}</span><ArrowRight className="h-4 w-4"/></button>)}
            </div>
          </div>
        </div>}
        {["staff","ways"].includes(tab)&&<label className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4"><Search className="h-5 w-5 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder={tx("Search staff, waybill, branch or status","ဝန်ထမ်း၊ Waybill၊ ဌာနခွဲ သို့မဟုတ် အခြေအနေ ရှာရန်")}/></label>}
        {tab==="staff"&&<div className="space-y-3">
          {visibleWorkers.map((w,i)=>{
            const assigned=staffJobs(w,jobs);
            const done=assigned.filter(isFinished).length;
            const flagged=assigned.filter(isDelayed).length;
            const pct=assigned.length?Math.round(done/assigned.length*100):0;
            return <article key={w.auth_user_id||w.worker_code||i} className={box}>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-bold">{w.display_name||w.worker_code||"-"}</h3><p className="mt-1 text-xs text-slate-500">{w.worker_code||"-"} · {w.workforce_role||"-"} · {w.branch_code||tx("No branch","ဌာနခွဲမရှိ")}</p></div>
                <div className="flex flex-wrap items-center gap-2">
                  {!w.auth_user_id&&<span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">{tx("Unmapped","မချိတ်ထား")}</span>}
                  <button type="button" disabled={!w.auth_user_id} onClick={()=>{setTargetId(String(w.auth_user_id));setBroadcast(false);setTab("messages")}} className={button+" bg-blue-50 text-blue-800"}><MessageSquare className="h-4 w-4"/>{tx("Message","စာပို့ရန်")}</button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs font-semibold text-slate-600"><span>{tx("Ways","Way")}: {assigned.length}</span><span>{tx("Completed","ပြီးစီး")}: {done}</span><span>{tx("Delayed","နှောင့်နှေး")}: {flagged}</span><span>{pct}%</span></div>
              <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{width:pct+"%"}}/></div>
            </article>;
          })}
          {visibleWorkers.length===0&&<p className={box}>{tx("No matching staff records.","ကိုက်ညီသော ဝန်ထမ်းမရှိပါ။")}</p>}
        </div>}
        {tab==="ways"&&<section className={box}>
          <div className="flex flex-wrap items-end justify-between gap-2"><h3 className="text-lg font-bold">{tx("Wayplan assignments","Wayplan တာဝန်များ")} · {filteredJobs.length}</h3>
            <label className="text-xs font-semibold text-slate-600">{tx("Staff filter","ဝန်ထမ်းရွေးရန်")}
              <select value={workerFilter} onChange={e=>setWorkerFilter(e.target.value)} className="ml-2 h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                <option value="">{tx("All staff","အားလုံး")}</option>
                {workers.map((w,i)=><option key={w.worker_code||i} value={w.worker_code}>{w.display_name||w.worker_code}</option>)}
              </select></label></div>
          <div className="mt-4 overflow-x-auto"><table className="min-w-[860px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Way ID</th><th className="p-3">Wayplan</th><th className="p-3">{tx("Team","အဖွဲ့")}</th><th className="p-3">{tx("Status","အခြေအနေ")}</th><th className="p-3">{tx("Proof","ဓာတ်ပုံ")}</th><th className="p-3">COD</th></tr></thead><tbody>
            {filteredJobs.map((j,i)=><tr key={(j.delivery_way_id||"")+"-"+i} className="border-b border-slate-100 last:border-0"><td className="p-3 font-mono font-semibold">{j.delivery_way_id||j.pickup_id||"-"}</td><td className="p-3">{j.wayplan_id||"-"}</td><td className="p-3 text-xs">{[j.rider_code,j.driver_code,j.helper_code].filter(Boolean).join(" / ")||"-"}</td><td className="p-3"><span className={\`rounded-lg px-2 py-1 text-xs font-semibold \${isFinished(j)?"bg-emerald-50 text-emerald-800":isFailed(j)?"bg-rose-50 text-rose-800":"bg-amber-50 text-amber-800"}\`}>{j.stop_status||j.rider_status||j.wayplan_status||"-"}</span></td><td className="p-3">{j.has_proof?tx("Yes","ရှိ"):tx("No","မရှိ")}</td><td className="p-3 tabular-nums">{money(j.cod_collected??j.cod_amount)}</td></tr>)}
          </tbody></table></div>
          {!filteredJobs.length&&<p className="p-5 text-center text-sm text-slate-500">{tx("No matching ways in this date range.","ဤရက်စွဲတွင် ကိုက်ညီသော Way မရှိပါ။")}</p>}
        </section>}
        {tab==="finance"&&<section className={box}><h3 className="text-lg font-bold">{tx("Field settlement reconciliation","လုပ်ငန်းခွင် ငွေစာရင်းနှိုင်းယှဉ်မှု")}</h3><p className="mt-1 text-sm text-slate-500">{tx("Read-only monitoring. Clearing and approval remain with authorized Finance workflows.","ဤနေရာတွင် ကြည့်ရှုရန်သာ။ အတည်ပြု/ရှင်းလင်းခြင်းကို Finance မှသာ ဆောင်ရွက်ပါ။")}</p>
          <div className="mt-4 overflow-x-auto"><table className="min-w-[800px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">{tx("Date","ရက်စွဲ")}</th><th className="p-3">Wayplan</th><th className="p-3">{tx("Staff","ဝန်ထမ်း")}</th><th className="p-3">{tx("Expected","မျှော်မှန်း")}</th><th className="p-3">{tx("Collected","ကောက်ခံ")}</th><th className="p-3">{tx("Variance","ကွာဟမှု")}</th><th className="p-3">{tx("Status","အခြေအနေ")}</th></tr></thead><tbody>
            {settlements.map((f,i)=><tr key={(f.wayplan_id||"")+i} className="border-b border-slate-100"><td className="p-3">{f.work_date||"-"}</td><td className="p-3 font-mono font-semibold">{f.wayplan_id}</td><td className="p-3 text-xs">{[f.rider_code,f.driver_code,f.helper_code].filter(Boolean).join(" / ")||"-"}</td><td className="p-3">{money(f.expected_cod)}</td><td className="p-3">{money(f.actual_collected)}</td><td className={\`p-3 font-semibold \${Math.abs(Number(f.variance_amount||0))>0?"text-rose-700":""}\`}>{money(f.variance_amount)}</td><td className="p-3">{f.status||"-"}</td></tr>)}
          </tbody></table></div>{settlements.length===0&&<p className="mt-4 text-sm text-slate-500">{tx("No settlement rows within selected period.","ရွေးထားသည့်ကာလတွင် ငွေစာရင်းမရှိပါ။")}</p>}
        </section>}
        {tab==="messages"&&<section className={box}><h3 className="text-lg font-bold">{tx("Send staff notification","ဝန်ထမ်းထံ အသိပေးစာပို့ရန်")}</h3>
          <p className="mt-1 text-sm text-slate-500">{tx("Messages are sent through the authorized Enterprise notification system.","Enterprise အသိပေးချက်စနစ်ဖြင့်သာ ပို့ပါသည်။")}</p>
          <div className="mt-4 grid max-w-2xl gap-4">
            <label className="text-sm font-semibold">{tx("Recipient","လက်ခံသူ")}<select disabled={broadcast} value={targetId} onChange={e=>setTargetId(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100"><option value="">{tx("Select a rider, driver or helper","ဝန်ထမ်းရွေးပါ")}</option>{workers.filter(w=>w.auth_user_id&&w.active).map((w,i)=><option key={w.auth_user_id||i} value={w.auth_user_id||""}>{w.display_name} · {w.worker_code} · {w.branch_code||"-"}</option>)}</select></label>
            <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={broadcast} onChange={e=>{setBroadcast(e.target.checked);setBroadcastConfirmed(false)}} className="h-5 w-5"/>{tx("Send to all active field staff","ဝန်ထမ်းအားလုံးသို့ ပို့ရန်")}</label>
            {broadcast&&<label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><input type="checkbox" checked={broadcastConfirmed} onChange={e=>setBroadcastConfirmed(e.target.checked)} className="mt-1 h-5 w-5"/>{tx("I confirm this will notify every active mapped rider, driver and helper.","ဝန်ထမ်းအားလုံးထံ အသိပေးစာပို့မည်ကို အတည်ပြုပါသည်။")}</label>}
            <label className="text-sm font-semibold">{tx("Subject","ခေါင်းစဉ်")}<input maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" placeholder={tx("Shift notice, assignment follow-up, or operational reminder","တာဝန်သတိပေးချက်")}/></label>
            <label className="text-sm font-semibold">{tx("Message","စာသား")}<textarea rows={5} maxLength={2000} value={body} onChange={e=>setBody(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 p-3 text-sm" placeholder={tx("Write instructions clearly, including deadline if applicable.","ညွှန်ကြားချက်နှင့် လိုအပ်သည့် ရက်ချိန်းရေးပါ။")}/></label>
            <button type="button" disabled={sending||(!broadcast&&!targetId)||(broadcast&&!broadcastConfirmed)||title.trim().length<4||body.trim().length<5} onClick={()=>void send()} className={button+" w-fit bg-blue-700 text-white"}><Send className="h-4 w-4"/>{sending?tx("Sending...","ပို့နေသည်..."):tx("Send notification","အသိပေးစာ ပို့ရန်")}</button>
            {sentNotice&&<p role="status" className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-900">{sentNotice}</p>}
          </div>
        </section>}
        <p className="text-xs text-slate-500">{tx("Operational usage exceptions are inferred from job progress; they are not login-time records. Results are limited by the admin reporting API.","အသုံးပြုမှုအခြေအနေကို လုပ်ငန်းတိုးတက်မှုမှ ခန့်မှန်းပြသပြီး Login မှတ်တမ်းမဟုတ်ပါ။")}</p>
      </>}
    </main>
  </div>;
}
