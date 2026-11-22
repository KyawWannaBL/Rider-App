import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Bell,
  Building2,
  CheckCircle2,
  Package,
  RefreshCw,
  Scale,
  Smartphone,
  Truck,
  WalletCards,
  XCircle,
  ArrowRight,
  ChevronRight,
  ClipboardList,
  Clock3,
  Headphones,
  MapPin,
  Search,
  ShieldAlert,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { useAppState } from "../hooks/useAppState";
import { riderFeedback } from "../lib/riderFeedback";
import { FinishAssignmentsButton } from "../components/shared/FinishAssignmentsButton";

function money(value:any){ return Number(value||0).toLocaleString()+" MMK"; }

export default function Dashboard() {
  const { language } = useAppState();
  const tx = (en:string,my:string) => language === "my" ? my : en;
  const [data,setData]=useState<any>({counts:{},wallet:{},pickups:[],deliveries:[],notifications:[],identity:{},branch:{}});
  const [daily,setDaily]=useState<any>({summary:{},payment_channels:{},failure_reasons:[],rows:[],identity:{}});
  const [loading,setLoading]=useState(false);
  const [settlements,setSettlements]=useState<any[]>([]);
  const [signerNames,setSignerNames]=useState<Record<string,string>>({});
  const [settlementBusy,setSettlementBusy]=useState("");
  const [workspaceTab,setWorkspaceTab]=useState<"overview"|"tasks"|"messages"|"finance">("overview");
  const [taskFilter,setTaskFilter]=useState<"all"|"pickup"|"delivery">("all");
  const [taskQuery,setTaskQuery]=useState("");
  const [expandedTask,setExpandedTask]=useState("");
  const [fieldJobs,setFieldJobs]=useState<any[]>([]);
  const [fieldNotices,setFieldNotices]=useState<any[]>([]);
  const [fieldSnapshotError,setFieldSnapshotError]=useState("");
  const [noticeBusy,setNoticeBusy]=useState("");

  const [message,setMessage]=useState(language === "my" ? "Enterprise Portal အခြေအနေကို ဖွင့်နေသည်..." : "Loading Enterprise Portal status...");

  async function load(){
    setLoading(true);
    try {
      const [portal,dailyResult,settlementResult]=await Promise.all([
        (supabase as any).rpc("be_rider_dashboard_snapshot"),
        (supabase as any).rpc("be_field_team_delivery_daily_dashboard_v172",{p_work_date:null}),
        (supabase as any).rpc("be_finance_field_settlement_center_v1",{p_work_date:null}),
      ]);
      const failures = [
        { result: portal, fallback: tx("Unable to load Enterprise Portal status.", "Enterprise Portal အခြေအနေကို ဖွင့်၍မရပါ။") },
        { result: dailyResult, fallback: tx("Unable to load today's delivery summary.", "ယနေ့ ပို့ဆောင်မှုအနှစ်ချုပ်ကို ဖွင့်၍မရပါ။") },
        { result: settlementResult, fallback: tx("Unable to load today's Finance settlement.", "ယနေ့ Finance Settlement ကို ဖွင့်၍မရပါ။") },
      ].filter(({ result }) => result.error || result.data?.ok === false);
      if(!portal.error && portal.data?.ok!==false) setData(portal.data||{});
      if(!dailyResult.error && dailyResult.data?.ok!==false) setDaily(dailyResult.data||{});
      if(!settlementResult.error && settlementResult.data?.ok!==false) setSettlements(Array.isArray(settlementResult.data?.rows)?settlementResult.data.rows:[]);
      try {
        const {data:fieldData,error:fieldError}=await (supabase as any).rpc("be_field_team_mobile_snapshot_v187",{p_payload:{limit:250,notification_limit:60}});
        if(fieldError||fieldData?.ok===false)throw fieldError||new Error(fieldData?.error||"Field tasks unavailable");
        setFieldJobs(Array.isArray(fieldData?.jobs)?fieldData.jobs:[]);
        setFieldNotices(Array.isArray(fieldData?.notifications)?fieldData.notifications:[]);
        setFieldSnapshotError("");
      }catch(fieldError:any){
        setFieldJobs([]);
        setFieldNotices([]);
        setFieldSnapshotError(fieldError?.message||tx("Rider tasks and notices could not be loaded.","Rider တာဝန်နှင့် အသိပေးချက်များ မရရှိပါ။"));
      }
      if(failures.length){
        setMessage(failures.map(({ result, fallback }) => result.error?.message || result.data?.error || result.data?.code || fallback).join(" · "));
      } else {
        riderFeedback("success");
        setMessage(tx("Enterprise Portal and today's field settlement are synchronized.","Enterprise Portal နှင့် ယနေ့ Field Settlement အချက်အလက်များ ချိတ်ဆက်ပြီးပါပြီ။"));
      }
    } catch(error:any) {
      setMessage(error?.message || tx("Unable to synchronize Enterprise Portal. Please retry.", "Enterprise Portal နှင့် ချိတ်ဆက်၍မရပါ။ ထပ်မံကြိုးစားပါ။"));
      riderFeedback("error");
    } finally {
      setLoading(false);
    }
  }
  async function signSettlement(row:any){
    const signedName=(signerNames[row.wayplan_id]||"").trim();
    if(!signedName){
      setMessage(tx("Type your full name before signing the Finance settlement.","Finance Settlement လက်မှတ်ထိုးမီ သင့်အမည်အပြည့်အစုံ ရိုက်ထည့်ပါ။"));
      return;
    }
    setSettlementBusy(row.wayplan_id);
    const {data,error}=await (supabase as any).rpc("be_finance_field_settlement_sign_v1",{
      p_work_date:daily.work_date||null,
      p_wayplan_id:row.wayplan_id,
      p_signed_name:signedName,
      p_note:"Field-team end-of-day electronic signature",
    });
    if(error || data?.ok===false){
      setMessage(error?.message || data?.code || "Settlement signature failed.");
    } else {
      setMessage(tx(
        row.wayplan_id+": electronic settlement signature recorded. Finance will clear after all assigned persons sign and collections reconcile.",
        row.wayplan_id+": အီလက်ထရွန်နစ် Settlement လက်မှတ် မှတ်တမ်းတင်ပြီးပါပြီ။ သက်ဆိုင်သူအားလုံး လက်မှတ်ထိုးပြီး ငွေစာရင်းညီပါက Finance မှ Cleared ပြုလုပ်ပါမည်။"
      ));
      await load();
    }
    setSettlementBusy("");
  }

  useEffect(()=>{load();},[]);

  const counts=data.counts||{};
  const wallet=data.wallet||{};
  const summary=daily.summary||{};
  const channels=daily.payment_channels||{};
  const failureReasons=Array.isArray(daily.failure_reasons)?daily.failure_reasons:[];
  const rows=Array.isArray(daily.rows)?daily.rows:[];
  const reconciliation=String(summary.cash_reconciliation_status||"MATCH").toUpperCase();
  const reconciliationClass=reconciliation==="MATCH"
    ?"border-emerald-200 bg-emerald-50 text-emerald-900"
    :reconciliation==="SHORT"
      ?"border-rose-200 bg-rose-50 text-rose-900"
      :"border-amber-200 bg-amber-50 text-amber-900";

  const mobileBanking = Number(channels.QR||0)+Number(channels.BANK_TRANSFER||0)+Number(channels.MOBILE_WALLET||0);
  const completedRows=useMemo(()=>rows.filter((r:any)=>["SUCCESS","FAILED"].includes(String(r.result||"").toUpperCase())),[rows]);

  const activeJobs=fieldJobs.filter((job:any)=>!["DELIVERED","COMPLETED","FAILED","CANCELLED","CANCELED","RETURNED"].includes(String(job.mobile_status||job.status||"").toUpperCase()));
  const pickupJobs=activeJobs.filter((job:any)=>String(job.job_kind||"PICKUP").toUpperCase()==="PICKUP");
  const deliveryJobs=activeJobs.filter((job:any)=>String(job.job_kind||"").toUpperCase()==="DELIVERY");
  const unreadNotices=fieldNotices.filter((n:any)=>!(n.is_read||n.read_at));
  const taskRows=activeJobs.filter((job:any)=>{
    const kind=String(job.job_kind||"PICKUP").toUpperCase();
    const matches=taskFilter==="all"||(taskFilter==="pickup"?kind==="PICKUP":kind==="DELIVERY");
    const text=[job.delivery_way_id,job.pickup_id,job.pickup_way_id,job.recipient_name,job.sender_name,job.merchant_name,job.township,job.address].join(" ").toLowerCase();
    return matches&&text.includes(taskQuery.trim().toLowerCase());
  });
  const fieldIdentity=daily.identity||data.identity||{};
  const shortDate=(value:any)=>{const date=new Date(value);return value&&!Number.isNaN(date.getTime())?date.toLocaleString():"";};
  async function markNoticeRead(n:any){
    if(!n.id||n.is_read||n.read_at)return;
    setNoticeBusy(String(n.id));
    try{
      const {error}=await (supabase as any).rpc("be_mark_app_notification_read",{p_notification_id:n.id,p_login:null});
      if(error)throw error;
      setFieldNotices(previous=>previous.map((row:any)=>row.id===n.id?{...row,is_read:true}:row));
    }catch(error:any){setFieldSnapshotError(error?.message||tx("Unable to mark notification read.","အသိပေးစာ ဖတ်ပြီးဟု မသတ်မှတ်နိုင်ပါ။"));}
    finally{setNoticeBusy("");}
  }

  const portalCards=[
    [tx("Assigned Pickups","တာဝန်ပေးထားသော Pickup များ"),counts.pickups||counts.pickup_jobs||0,Truck],
    [tx("Active Delivery Jobs","လက်ရှိ ပို့ဆောင်ရမည့်အလုပ်များ"),summary.active_ways??counts.deliveries??counts.delivery_jobs??0,Package],
    [tx("Unread / Active Notifications","မဖတ်ရသေးသော အသိပေးချက်များ"),counts.notifications||0,Bell],
    [tx("COD Balance","COD လက်ကျန်"),money(wallet.cod_balance||0),WalletCards],
  ];

  const dailyCards=[
    [tx("Total Ways","စုစုပေါင်း Way"),summary.total_ways||0,Package],
    [tx("Successful","ပို့ဆောင်အောင်မြင်"),summary.success_ways||0,CheckCircle2],
    [tx("Failed","ပို့ဆောင်မအောင်မြင်"),summary.failed_ways||0,XCircle],
    [tx("Wayplan Expected","Wayplan အရ ကောက်ခံရမည့်ငွေ"),money(summary.wayplan_expected_total||0),Scale],
    [tx("Actual Collected","အမှန်တကယ် ကောက်ခံရရှိငွေ"),money(summary.actual_collected_total||0),Banknote],
    [tx("Cash Collected","ငွေသား ကောက်ခံရရှိ"),money(channels.CASH||0),Banknote],
    [tx("Mobile Banking","Mobile Banking / QR"),money(mobileBanking),Smartphone],
    [tx("Successful Expected","အောင်မြင် Way များအတွက် ကောက်ခံရမည့်ငွေ"),money(summary.success_expected_total||0),WalletCards],
  ];

  return (
    <div className="v142-portal-bg min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">

        <section aria-labelledby="shift-title" className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#08162d] via-[#10213d] to-[#103a55] p-5 text-white shadow-[0_14px_35px_rgba(12,27,51,.16)] sm:p-7">
          <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-10" style={{backgroundImage:"linear-gradient(90deg,white 1px,transparent 1px),linear-gradient(white 1px,transparent 1px)",backgroundSize:"35px 35px"}}/>
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300"><span className="h-1.5 w-1.5 rounded-full bg-cyan-400"/>{tx("LIVE SHIFT · BRITIUM EXPRESS","ယနေ့တာဝန် · BRITIUM EXPRESS")}</p>
              <h1 id="shift-title" className="mt-5 text-2xl font-bold sm:text-3xl">{tx("Welcome to your shift","မင်္ဂလာပါ၊ ယနေ့တာဝန်များ")}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">{tx("See your assigned tasks, messages and settlements. Select a card to review the details.","တာဝန်များ၊ အသိပေးချက်များနှင့် ငွေစာရင်းများကို ကြည့်ရှုပါ။")}</p>
              <p className="mt-3 text-xs font-semibold text-slate-300">{fieldIdentity.display_name||fieldIdentity.worker_code||tx("Field team","လုပ်ငန်းခွင်")} · {fieldIdentity.branch_code||tx("No branch assigned","ဌာနခွဲမရှိ")} · {daily.work_date||tx("Today","ယနေ့")}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold"><Clock3 className="mr-1 inline h-4 w-4"/>{tx("Today's work","ယနေ့လုပ်ငန်း")}</span>
              <button type="button" onClick={load} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/>{tx("Sync Enterprise","Enterprise နှင့် Sync")}</button>
            </div>
          </div>
          <div className="relative mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {([
              ["all",tx("Assigned tasks","တာဝန်များ"),activeJobs.length,ClipboardList],
              ["pickup",tx("Pickups","ပစ္စည်းယူ"),pickupJobs.length,Package],
              ["delivery",tx("Deliveries","ပို့ဆောင်"),deliveryJobs.length,Truck],
              ["messages",tx("Unread notices","မဖတ်ရသေးသောစာ"),unreadNotices.length,Bell]
            ] as const).map(([kind,label,value,Icon])=><button type="button" key={kind} onClick={()=>{if(kind==="messages"){setWorkspaceTab("messages")}else{setWorkspaceTab("tasks");setTaskFilter(kind==="all"?"all":kind)}}} className="group min-h-28 rounded-2xl border border-white/10 bg-white/[.07] p-4 text-left transition hover:border-cyan-300/40 hover:bg-white/[.13]"><div className="flex items-center justify-between"><Icon className="h-5 w-5 text-cyan-300"/><ArrowRight className="h-4 w-4 text-cyan-300/70"/></div><p className="mt-3 text-3xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs font-medium text-slate-300">{label}</p></button>)}
          </div>
        </section>

        <section role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white px-4 py-3">
          <div className="flex min-w-0 items-start gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"/><div><h2 className="text-sm font-bold text-amber-950">{tx("Enterprise connection & dispatch status","Enterprise ချိတ်ဆက်မှု အခြေအနေ")}</h2><p className="mt-1 break-words text-xs leading-5 text-amber-900">{message}</p></div></div>
          <button type="button" onClick={load} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0d1d36] px-3 text-xs font-semibold text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/>{tx("Retry sync","ထပ်မံစစ်ဆေး")}</button>
        </section>

        <nav role="tablist" aria-label={tx("Rider workspace sections","Rider လုပ်ငန်းကဏ္ဍများ")} className="flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {([
            ["overview",tx("Overview","အကျဉ်းချုပ်"),Package],
            ["tasks",tx("My tasks","တာဝန်များ"),ClipboardList],
            ["messages",tx("Notifications","အသိပေးချက်"),Bell],
            ["finance",tx("Finance & reports","ငွေစာရင်း"),WalletCards],
          ] as const).map(([key,label,Icon])=><button type="button" role="tab" aria-selected={workspaceTab===key} key={key} onClick={()=>setWorkspaceTab(key)} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-xs font-semibold ${workspaceTab===key?"bg-[#10213d] text-white":"text-slate-600 hover:bg-slate-100"}`}><Icon className="h-4 w-4"/>{label}{key==="messages"&&unreadNotices.length>0?<span className="rounded-full bg-amber-300 px-1.5 text-[10px] text-slate-950">{unreadNotices.length}</span>:null}</button>)}
        </nav>
        {fieldSnapshotError&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">{fieldSnapshotError} <button type="button" onClick={load} className="ml-2 underline">{tx("Retry","ပြန်စမ်းရန်")}</button></div>}


        {workspaceTab==="overview"&&<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-blue-700">{tx("INBOX","စာတိုက်")} · {unreadNotices.length} {tx("unread","မဖတ်ရသေး")}</p><h2 className="mt-1 text-lg font-bold text-slate-950">{tx("Notifications & announcements","အသိပေးချက်နှင့် ကြေညာချက်များ")}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{tx("Messages, updates and shift instructions sent to your account.","သင့်အကောင့်သို့ ပို့ထားသော လုပ်ငန်းဆိုင်ရာ အကြောင်းကြားချက်များ")}</p></div>
              <button type="button" onClick={()=>setWorkspaceTab("messages")} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Bell className="h-4 w-4"/>{tx("View messages","စာများကြည့်ရန်")}</button>
            </div>
            <div className="mt-4 space-y-3">
              {fieldNotices.slice(0,3).map((notice:any,i:number)=><article key={notice.id||i} className="rounded-xl border border-blue-100 bg-blue-50/50 p-3"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-900">{notice.title||tx("New notice","အသိပေးစာ")}</h3>{!(notice.is_read||notice.read_at)&&<span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-blue-600"/>}</div><p className="mt-1 text-xs leading-5 text-slate-600">{notice.message||notice.body||"-"}</p></article>)}
              {fieldNotices.length===0&&<div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm"><Bell className="h-6 w-6"/></span><p className="mt-3 text-sm font-bold text-slate-800">{tx("You're all caught up","အသိပေးချက် မရှိသေးပါ")}</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{tx("Dispatch updates, team notices and settlement messages will appear here.","Dispatch နှင့် အဖွဲ့အသိပေးချက်များကို ဤနေရာတွင် ပြသပါမည်။")}</p></div>}
            </div>
            <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-100 pt-3 text-center text-[11px] font-semibold text-slate-600">
              <button type="button" onClick={()=>{setWorkspaceTab("tasks");setTaskFilter("all")}} className="flex items-center justify-center gap-1 py-2 hover:text-blue-700"><ClipboardList className="h-4 w-4"/>{tx("Tasks","တာဝန်များ")}</button>
              <Link to="/cod-settlement" className="flex items-center justify-center gap-1 py-2 hover:text-blue-700"><WalletCards className="h-4 w-4"/>COD</Link>
              <Link to="/route" className="flex items-center justify-center gap-1 py-2 hover:text-blue-700"><MapPin className="h-4 w-4"/>{tx("Route","လမ်းကြောင်း")}</Link>
            </div>
          </section>
          <aside className="space-y-3">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">{tx("My account","အကောင့်")}</p><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">{tx("Signed in","ဝင်ထားသည်")}</span></div>
              <dl className="mt-4 space-y-2 text-xs">{[[tx("Rider ID","Rider ID"),fieldIdentity.worker_code||"-"],[tx("Branch","ဌာနခွဲ"),fieldIdentity.branch_code||"-"],[tx("Role","ရာထူး"),fieldIdentity.role||"-"]].map(([key,value])=><div key={key} className="flex justify-between gap-2 border-b border-dashed border-slate-100 pb-2"><dt className="text-slate-500">{key}</dt><dd className="font-semibold text-slate-900">{value}</dd></div>)}</dl>
              <Link to="/profile" className="mt-3 flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50">{tx("View profile","ပရိုဖိုင်ကြည့်ရန်")}<ChevronRight className="h-4 w-4"/></Link>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><Headphones className="h-5 w-5 text-cyan-700"/><h3 className="text-sm font-bold">{tx("Operations support","လုပ်ငန်းအကူအညီ")}</h3></div><p className="mt-2 text-xs leading-5 text-slate-500">{tx("Need help with dispatch, task progress or photo proof? Contact support.","Dispatch၊ တာဝန် သို့မဟုတ် ဓာတ်ပုံသက်သေအတွက် အကူအညီတောင်းပါ။")}</p><Link to="/support" className="mt-3 flex min-h-10 items-center justify-center rounded-xl bg-[#10213d] text-xs font-semibold text-white">{tx("Contact support","အကူအညီတောင်းရန်")}</Link></section>
          </aside>
        </div>}

        {workspaceTab==="tasks"&&<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-900">{tx("My assigned tasks","ပေးအပ်ထားသော တာဝန်များ")} · {taskRows.length}</h2><p className="mt-1 text-xs text-slate-500">{tx("Select a waybill to expand job details and open the workflow.","Waybill ကိုနှိပ်၍ အလုပ်အသေးစိတ်ကြည့်ရှုပါ။")}</p></div><Link to="/route" className="inline-flex items-center gap-2 text-xs font-bold text-blue-700"><MapPin className="h-4 w-4"/>{tx("View route","လမ်းကြောင်း")}</Link></div>
          <div className="mt-4 flex flex-wrap gap-2">{(["all","pickup","delivery"] as const).map(kind=><button type="button" key={kind} aria-pressed={taskFilter===kind} onClick={()=>{setTaskFilter(kind);setExpandedTask("")}} className={`min-h-10 rounded-xl px-4 text-xs font-bold ${taskFilter===kind?"bg-blue-700 text-white":"bg-slate-100 text-slate-600"}`}>{kind==="all"?tx("All","အားလုံး"):kind==="pickup"?tx("Pickup","ပစ္စည်းယူ"):tx("Delivery","ပို့ဆောင်")}</button>)}</div>
          <label className="mt-3 flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400"/><input value={taskQuery} onChange={e=>setTaskQuery(e.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder={tx("Search waybill, recipient or township","Waybill၊ လက်ခံသူ၊ မြို့နယ် ရှာရန်")}/></label>
          <div className="mt-4 space-y-2">{taskRows.map((job:any,i:number)=>{const id=String(job.id||job.delivery_way_id||job.pickup_id||i);const open=expandedTask===id;const delivery=String(job.job_kind||"PICKUP").toUpperCase()==="DELIVERY";const way=job.display_way_id||job.delivery_way_id||job.pickup_way_id||job.pickup_id||id;return <article key={id} className="overflow-hidden rounded-xl border border-slate-200"><button type="button" aria-expanded={open} onClick={()=>setExpandedTask(open?"":id)} className="flex min-h-16 w-full items-center gap-3 p-3 text-left hover:bg-slate-50"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">{delivery?<Truck className="h-5 w-5"/>:<Package className="h-5 w-5"/>}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{way}</strong><span className="block truncate text-xs text-slate-500">{job.recipient_name||job.merchant_name||job.sender_name||tx("Assigned task","တာဝန်")} · {job.mobile_status||job.status||tx("Assigned","တာဝန်ပေးထား")}</span></span><ChevronRight className={`h-5 w-5 text-slate-400 transition ${open?"rotate-90":""}`}/></button>{open&&<div className="space-y-3 border-t border-slate-200 bg-slate-50 p-4 text-sm"><p><span className="text-slate-500">{tx("Address","လိပ်စာ")}:</span> {job.delivery_address||job.pickup_address||job.address||job.township||"-"}</p><p><span className="text-slate-500">{tx("Contact","ဆက်သွယ်ရန်")}:</span> {job.recipient_phone||job.sender_phone||"-"}</p><Link to={delivery?"/delivery":job.pickup_id?"/jobs/"+encodeURIComponent(String(job.pickup_id)):"/jobs"} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white">{tx("Open workflow","လုပ်ငန်းဖွင့်ရန်")}<ArrowRight className="h-4 w-4"/></Link></div>}</article>})}</div>
          {!taskRows.length&&<p className="mt-4 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">{tx("No tasks match this filter.","ကိုက်ညီသောတာဝန် မရှိပါ။")}</p>}
        </section>}

        {workspaceTab==="messages"&&<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex justify-between gap-3"><div><h2 className="text-xl font-bold">{tx("Notifications & messages","အသိပေးချက်များ")}</h2><p className="mt-1 text-xs text-slate-500">{tx("Delivered to your authenticated field-team account.","သင့်အကောင့်သို့ ပေးပို့ထားသော စာများ")}</p></div><span className="text-xs font-bold text-blue-700">{unreadNotices.length} {tx("unread","မဖတ်ရသေး")}</span></div>
          <div className="mt-4 space-y-3">{fieldNotices.map((n:any,i:number)=><article key={n.id||i} className={`rounded-xl border p-4 ${n.is_read||n.read_at?"border-slate-200 bg-slate-50":"border-blue-200 bg-blue-50/50"}`}><h3 className="font-bold">{n.title||tx("Notification","အသိပေးစာ")}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{n.message||n.body||"-"}</p><p className="mt-2 text-xs text-slate-400">{shortDate(n.created_at)}</p>{!(n.is_read||n.read_at)&&n.id&&<button type="button" onClick={()=>void markNoticeRead(n)} disabled={noticeBusy===String(n.id)} className="mt-2 min-h-10 rounded-lg border border-blue-200 bg-white px-3 text-xs font-bold text-blue-700">{tx("Mark as read","ဖတ်ပြီးဟု သတ်မှတ်ရန်")}</button>}</article>)}{!fieldNotices.length&&<p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">{tx("No messages at the moment.","စာများ မရှိသေးပါ။")}</p>}</div>
        </section>}

        {workspaceTab==="finance"&&<>
        <FinishAssignmentsButton onFinished={load} />

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">{tx("Today's Delivery & Collection Summary","ယနေ့ ပို့ဆောင်မှုနှင့် ငွေကောက်ခံမှု အနှစ်ချုပ်")}</h2>
              <p className="text-sm font-semibold text-slate-500">{tx("Shared from the same delivery records used by Finance and Warehouse.","Finance နှင့် Warehouse တို့အသုံးပြုသော Delivery record တစ်ခုတည်းမှ ချိတ်ဆက်ပြသထားပါသည်။")}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {dailyCards.map(([label,value,Icon]:any)=>(
              <div key={label} className="v142-portal-card group p-5 transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_46px_rgba(15,23,42,.12)]">
                <div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p><div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-amber-50 to-cyan-50 text-[#b38d13] shadow-sm"><Icon className="h-5 w-5"/></div></div>
                <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={`rounded-3xl border p-5 shadow-sm ${reconciliationClass}`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                {reconciliation==="MATCH" ? <CheckCircle2 className="h-6 w-6"/> : <AlertTriangle className="h-6 w-6"/>}
                <h2 className="text-xl font-black">{tx("Cash / Collection Reconciliation","ငွေကောက်ခံမှု စာရင်းညှိနှိုင်းခြင်း")}: {reconciliation}</h2>
              </div>
              <p className="mt-2 text-sm font-bold">
                {tx(
                  "Reconciliation compares the expected amount for successful deliveries only against the actual amount collected, so failed ways do not create a false cash shortage.",
                  "စာရင်းညှိနှိုင်းရာတွင် ပို့ဆောင်အောင်မြင်သော Way များအတွက် ကောက်ခံရမည့်ငွေနှင့် အမှန်တကယ်ကောက်ခံရရှိငွေကိုသာ နှိုင်းယှဉ်သဖြင့် Failed Way များကြောင့် ငွေလိုငွေပျောက် အမှားမဖြစ်စေပါ။"
                )}
              </p>
            </div>
            <div className="rounded-2xl bg-white/70 px-5 py-3 text-right">
              <p className="text-xs font-black uppercase">{tx("Variance","ကွာဟချက်")}</p>
              <p className="text-2xl font-black">{money(summary.cash_reconciliation_variance||0)}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">{tx("Collection by Payment Channel","ငွေပေးချေမှုနည်းလမ်းအလိုက် ကောက်ခံရရှိငွေ")}</h2>
            <div className="mt-4 grid gap-2 text-sm font-bold">
              {[
                ["CASH",channels.CASH],
                ["QR",channels.QR],
                ["BANK TRANSFER",channels.BANK_TRANSFER],
                ["MOBILE WALLET",channels.MOBILE_WALLET],
                ["PREPAID",channels.PREPAID],
                ["UNKNOWN / LEGACY",channels.UNKNOWN],
              ].map(([label,value]:any)=>(
                <div key={label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span>{label}</span><span>{money(value||0)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">{tx("Failed Ways & Reasons","Failed Way များနှင့် အကြောင်းပြချက်များ")}</h2>
            <div className="mt-4 space-y-2">
              {failureReasons.length===0 && <p className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-900">{tx("No failed ways recorded for today.","ယနေ့ Failed Way မရှိသေးပါ။")}</p>}
              {failureReasons.map((r:any)=>(
                <div key={r.reason_code||r.reason} className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="font-black text-rose-950">{r.reason||r.reason_code||"FAILED"}</p><p className="mt-1 text-xs font-bold text-rose-700">{Array.isArray(r.ways)?r.ways.join(", "):""}</p></div>
                    <span className="rounded-full bg-rose-600 px-3 py-1 text-sm font-black text-white">{r.count||0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-950">{tx("Today's Completed / Failed Ways","ယနေ့ ပြီးစီး / Failed Way များ")}</h2>
              <p className="text-sm font-semibold text-slate-500">{tx("These ways no longer remain in the active Delivery screen.","ဤ Way များသည် Active Delivery Screen တွင် ဆက်လက်မပြတော့ပါ။")}</p>
            </div>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-white">{completedRows.length}</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead><tr className="border-b text-xs uppercase text-slate-500">
                <th className="px-3 py-2">Way ID</th><th className="px-3 py-2">{tx("Result","ရလဒ်")}</th><th className="px-3 py-2">{tx("Reason","အကြောင်းပြချက်")}</th><th className="px-3 py-2">{tx("Expected","ကောက်ခံရမည့်ငွေ")}</th><th className="px-3 py-2">{tx("Actual","ကောက်ခံရရှိငွေ")}</th><th className="px-3 py-2">{tx("Channel","နည်းလမ်း")}</th>
              </tr></thead>
              <tbody>
                {completedRows.map((r:any)=>(
                  <tr key={`${r.wayplan_id}-${r.delivery_way_id}`} className="border-b last:border-0">
                    <td className="px-3 py-3 font-mono font-black text-blue-700">{r.delivery_way_id}</td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${r.result==="SUCCESS"?"bg-emerald-100 text-emerald-800":"bg-rose-100 text-rose-800"}`}>{r.result}</span></td>
                    <td className="px-3 py-3 font-semibold">{r.failed_reason||"-"}</td>
                    <td className="px-3 py-3 font-bold">{money(r.expected_collect||0)}</td>
                    <td className="px-3 py-3 font-bold">{money(r.actual_collected||0)}</td>
                    <td className="px-3 py-3 font-bold">{r.payment_mode||"-"}</td>
                  </tr>
                ))}
                {completedRows.length===0 && <tr><td colSpan={6} className="px-3 py-8 text-center font-bold text-slate-400">{tx("No completed or failed ways yet today.","ယနေ့ ပြီးစီး သို့မဟုတ် Failed Way မရှိသေးပါ။")}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>


        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-xl font-black text-slate-950">{tx("End-of-Day Financial Settlement","နေ့ကုန် ဘဏ္ဍာရေး စာရင်းရှင်းတမ်း")}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{tx(
              "Each assigned Rider / Driver / Helper signs electronically. Finance can mark the route CLEARED only after every required signature and collection reconciliation are complete.",
              "တာဝန်ကျ Rider / Driver / Helper တစ်ဦးချင်းစီ အီလက်ထရွန်နစ်လက်မှတ်ထိုးရပါမည်။ လိုအပ်သော လက်မှတ်အားလုံးနှင့် ငွေစာရင်းညှိနှိုင်းမှု ပြည့်စုံပြီးမှ Finance မှ CLEARED ပြုလုပ်နိုင်ပါသည်။"
            )}</p>
          </div>
          <div className="mt-4 space-y-3">
            {settlements.map((r:any)=>(
              <div key={r.id||r.wayplan_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div><p className="text-xs font-black text-slate-500">WAYPLAN / VEHICLE</p><p className="font-black text-slate-950">{r.wayplan_id}</p><p className="text-xs font-bold text-blue-700">{r.vehicle_code||r.vehicle_name||"-"}</p></div>
                  <div><p className="text-xs font-black text-slate-500">WAYS</p><p className="font-black">{r.total_ways} total · {r.delivered_ways} success · {r.failed_ways} failed · {r.remaining_ways} left</p></div>
                  <div><p className="text-xs font-black text-slate-500">{tx("COLLECTION","ငွေကောက်ခံမှု")}</p><p className="font-black">{money(r.actual_collected)}</p><p className="text-xs font-bold text-slate-500">Cash {money(r.cash_collected)} · Digital {money(r.digital_collected)}</p></div>
                  <div><p className="text-xs font-black text-slate-500">STATUS</p><span className={r.status==="CLEARED"?"inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800":"inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800"}>{r.status}</span></div>
                </div>
                <div className="mt-3 text-xs font-bold text-slate-500">
                  Signatures: Finance {r.signature_status?.finance?"✓":"—"} · Rider {r.signature_status?.rider?"✓":"—"} · Driver {r.signature_status?.driver?"✓":"—"} · Helper {r.signature_status?.helper?"✓":"—"}
                </div>
                {r.status!=="CLEARED" && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input value={signerNames[r.wayplan_id]||""} onChange={(e)=>setSignerNames({...signerNames,[r.wayplan_id]:e.target.value})} placeholder={tx("Your full name for electronic signature","အီလက်ထရွန်နစ်လက်မှတ်အတွက် အမည်အပြည့်အစုံ")} className="h-11 flex-1 rounded-xl border border-slate-300 bg-white px-3 font-bold" />
                    <button disabled={settlementBusy===r.wayplan_id} onClick={()=>void signSettlement(r)} className="h-11 rounded-xl bg-blue-700 px-5 font-black text-white disabled:opacity-50">{settlementBusy===r.wayplan_id?tx("Signing...","လက်မှတ်ထိုးနေသည်..."):tx("Electronic Sign","အီလက်ထရွန်နစ် လက်မှတ်ထိုးမည်")}</button>
                  </div>
                )}
              </div>
            ))}
            {settlements.length===0 && <div className="rounded-2xl bg-slate-50 p-5 text-center font-bold text-slate-400">{tx("No Finance settlement is assigned to you for today.","ယနေ့ သင့်အတွက် Finance Settlement မရှိသေးပါ။")}</div>}
          </div>
        </section>

        </>}
        {workspaceTab==="overview"&&<>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {portalCards.map(([label,value,Icon]:any)=>(
            <div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p><div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-amber-50 to-cyan-50 text-[#b38d13] shadow-sm"><Icon className="h-5 w-5"/></div></div>
              <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Link to="/jobs" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:bg-blue-50">
            <h2 className="text-xl font-black text-slate-950">{tx("Pickup Verification","Pickup စစ်ဆေးအတည်ပြုခြင်း")}</h2>
            <p className="mt-2 font-semibold text-slate-600">{tx("Open Enterprise-assigned pickups, capture proof, weight, and submit parcels for review.","Enterprise မှ တာဝန်ပေးထားသော Pickup များကို ဖွင့်ပြီး ဓာတ်ပုံသက်သေ၊ အလေးချိန် ထည့်သွင်းကာ စစ်ဆေးရန် ပို့ပါ။")}</p>
          </Link>
          <Link to="/delivery" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:bg-blue-50">
            <h2 className="text-xl font-black text-slate-950">{tx("Active Delivery / Drop-Off","လက်ရှိ ပို့ဆောင် / ပစ္စည်းချခြင်း")}</h2>
            <p className="mt-2 font-semibold text-slate-600">{tx("Only active Wayplan stops remain here; completed and failed stops move to today's dashboard.","Active Wayplan မှတ်တိုင်များကိုသာ ပြသပြီး ပြီးစီး/Failed Way များကို ယနေ့ Dashboard သို့ ရွှေ့ပြပါသည်။")}</p>
          </Link>
          <Link to="/cod-settlement" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:bg-blue-50">
            <h2 className="text-xl font-black text-slate-950">{tx("COD Settlement","COD ငွေစာရင်းရှင်းခြင်း")}</h2>
            <p className="mt-2 font-semibold text-slate-600">{tx("Submit delivered COD to Finance using authoritative Enterprise values.","ပို့ဆောင်ပြီးသော COD ကို Enterprise သတ်မှတ်ချက်အတိုင်း Finance သို့ တင်သွင်းပါ။")}</p>
          </Link>
          <Link to="/branch-sync" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:bg-blue-50">
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-950"><Building2 className="h-5 w-5"/> {tx("Branch Sync","ဌာနခွဲ ချိတ်ဆက်မှု")}</h2>
            <p className="mt-2 font-semibold text-slate-600">{tx("View your authenticated branch assignment and branch pickup workload.","သင့်ဌာနခွဲတာဝန်နှင့် Pickup အလုပ်ပမာဏကို ကြည့်ရှုပါ။")}</p>
          </Link>
        </section>
        </>}
      </div>
    </div>
  );
}
