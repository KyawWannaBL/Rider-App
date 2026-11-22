import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  ArrowRight,
  ClipboardList,
  ChevronRight,
  MapPin,
  Phone,
  Search,
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
  const [activeView,setActiveView]=useState<"home"|"tasks"|"updates"|"reports">("home");
  const [taskFilter,setTaskFilter]=useState<"all"|"pickup"|"delivery">("all");
  const [taskSearch,setTaskSearch]=useState("");
  const [selectedTask,setSelectedTask]=useState("");
  const [mobile,setMobile]=useState<any>({jobs:[],notifications:[]});
  const [mobileError,setMobileError]=useState("");
  const [syncError,setSyncError]=useState("");
  const [readBusy,setReadBusy]=useState("");

  const [settlements,setSettlements]=useState<any[]>([]);
  const [signerNames,setSignerNames]=useState<Record<string,string>>({});
  const [settlementBusy,setSettlementBusy]=useState("");
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
      // The mobile snapshot is scoped by the authenticated rider; do not
      // substitute another rider's assignments if it is unavailable.
      try {
        const { data: mobileData, error: mobileFailure } = await (supabase as any).rpc("be_field_team_mobile_snapshot_v187",{p_payload:{limit:200,notification_limit:50}});
        if(mobileFailure || mobileData?.ok===false) throw mobileFailure || new Error(mobileData?.error || "Unable to load assigned tasks");
        setMobile({jobs:Array.isArray(mobileData?.jobs)?mobileData.jobs:[],notifications:Array.isArray(mobileData?.notifications)?mobileData.notifications:[]});
        setMobileError("");
      } catch(mobileFailure:any) {
        setMobileError(mobileFailure?.message || "Assigned tasks and notifications are unavailable.");
      }
      if(failures.length){
        const issues=failures.map(({ result, fallback }) => result.error?.message || result.data?.error || result.data?.code || fallback).join(" · ");
        setSyncError(issues);
        setMessage(issues);
      } else {
        setSyncError("");
        riderFeedback("success");
        setMessage(tx("Enterprise Portal and today's field settlement are synchronized.","Enterprise Portal နှင့် ယနေ့ Field Settlement အချက်အလက်များ ချိတ်ဆက်ပြီးပါပြီ။"));
      }
    } catch(error:any) {
      const issue=error?.message || tx("Unable to synchronize Enterprise Portal. Please retry.", "Enterprise Portal နှင့် ချိတ်ဆက်၍မရပါ။ ထပ်မံကြိုးစားပါ။");
      setSyncError(issue);
      setMessage(issue);
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

  const mobileJobs=Array.isArray(mobile.jobs)?mobile.jobs:[];
  const mobileNotifications=Array.isArray(mobile.notifications)?mobile.notifications:[];
  const activeJobs=mobileJobs.filter((j:any)=>!["DELIVERED","COMPLETED","FAILED","CANCELLED","CANCELED"].includes(String(j.status||"").toUpperCase()));
  const pickups=activeJobs.filter((j:any)=>String(j.job_kind||"PICKUP").toUpperCase()==="PICKUP");
  const deliveries=activeJobs.filter((j:any)=>String(j.job_kind||"").toUpperCase()==="DELIVERY");
  const filteredJobs=activeJobs.filter((job:any)=>{
    const kind=String(job.job_kind||"PICKUP").toUpperCase();
    const matchesKind=taskFilter==="all" || (taskFilter==="pickup"?kind==="PICKUP":kind==="DELIVERY");
    const q=taskSearch.trim().toLowerCase();
    return matchesKind && (!q || [job.pickup_id,job.pickup_way_id,job.delivery_way_id,job.tracking_no,job.recipient_name,job.recipient_phone,job.recipient_town,job.merchant_name,job.pickup_address,job.delivery_address].some(x=>String(x||"").toLowerCase().includes(q)));
  });
  const unreadNotifications=mobileNotifications.filter((n:any)=>!(n.is_read||n.read_at)).length;
  const taskId=(j:any)=>String(j.id||j.delivery_way_id||j.pickup_id||j.tracking_no||"");
  const taskHref=(j:any)=>String(j.job_kind||"PICKUP").toUpperCase()==="DELIVERY"
    ? "/delivery?"+new URLSearchParams({deliveryWayId:String(j.delivery_way_id||j.tracking_no||"")}).toString()
    : "/jobs/"+encodeURIComponent(String(j.pickup_id||""));
  async function markRead(notification:any){
    if(!notification.id || notification.is_read || notification.read_at)return;
    setReadBusy(String(notification.id));
    try {
      const {error}=await (supabase as any).rpc("be_mark_app_notification_read",{p_notification_id:notification.id,p_login:null});
      if(error)throw error;
      setMobile((prev:any)=>({...prev,notifications:prev.notifications.map((n:any)=>n.id===notification.id?{...n,is_read:true}:n)}));
    }catch(error:any){setMobileError(error?.message||tx("Could not mark notification read.","အကြောင်းကြားချက်ကို ဖတ်ပြီးဟု သတ်မှတ်မရပါ။"))}
    finally{setReadBusy("")}
  }
  const shortDate=(value:any)=>{if(!value)return "";const d=new Date(value);return Number.isNaN(d.getTime())?"":d.toLocaleString();};

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

        <section className="overflow-hidden rounded-[28px] bg-[#0d1b34] p-5 text-white shadow-lg sm:p-7" aria-labelledby="rider-home-heading">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-300">{tx("My workspace","ကျွန်ုပ်၏ လုပ်ငန်းခွင်")}</p>
              <h1 id="rider-home-heading" className="mt-2 text-2xl font-bold sm:text-3xl">{tx("Good day. Here's your work.","မင်္ဂလာပါ။ ယနေ့တာဝန်များ")}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{daily.identity?.display_name||data.identity?.display_name||tx("Field team member","ဝန်ထမ်း")} · {data.identity?.branch_code||tx("Branch not assigned","ဌာနခွဲ မသတ်မှတ်ရသေး")}</p>
            </div>
            <button type="button" onClick={load} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/>{tx("Refresh","ပြန်လည်စစ်ဆေး")}</button>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {([
              ["tasks",tx("Active tasks","လက်ရှိတာဝန်"),activeJobs.length,ClipboardList],
              ["pickup",tx("Pickups","ပစ္စည်းယူ"),pickups.length,Truck],
              ["delivery",tx("Deliveries","ပို့ဆောင်"),deliveries.length,Package],
              ["updates",tx("Unread notices","မဖတ်ရသေးသောစာ"),unreadNotifications,Bell],
            ] as const).map(([kind,label,value,Icon])=>(
              <button key={kind} type="button" onClick={()=>{if(kind==="updates"){setActiveView("updates")}else{setActiveView("tasks");setTaskFilter(kind==="tasks"?"all":kind)}}} className="group min-h-[112px] rounded-2xl border border-white/15 bg-white/[0.08] p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-white/[0.13] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
                <div className="flex items-center justify-between"><Icon className="h-5 w-5 text-cyan-300"/><ChevronRight className="h-4 w-4 text-slate-300"/></div>
                <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
                <p className="mt-1 text-xs font-medium text-slate-200">{label}</p>
              </button>
            ))}
          </div>
        </section>

        <nav aria-label={tx("Rider work sections","Rider လုပ်ငန်းကဏ္ဍများ")} className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" role="tablist">
          {([
            ["home",tx("Overview","အကျဉ်းချုပ်"),Package],
            ["tasks",tx("My tasks","ကျွန်ုပ်၏တာဝန်"),ClipboardList],
            ["updates",tx("Messages","အသိပေးချက်"),Bell],
            ["reports",tx("Finance & reports","ငွေစာရင်းနှင့် အစီရင်ခံစာ"),WalletCards],
          ] as const).map(([key,label,Icon])=>(
            <button key={key} type="button" role="tab" aria-selected={activeView===key} onClick={()=>setActiveView(key)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${activeView===key?"bg-blue-700 text-white shadow-sm":"text-slate-600 hover:bg-slate-100"}`}><Icon className="h-4 w-4"/>{label}{key==="updates"&&unreadNotifications>0?<span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">{unreadNotifications}</span>:null}</button>
          ))}
        </nav>

        {!syncError&&message?<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">{message}</div>:null}
        {syncError?<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">{tx("Some Enterprise data could not be synchronized: ","Enterprise အချက်အလက်အချို့ ချိတ်ဆက်မရပါ။ ")}{syncError} <button type="button" onClick={load} className="ml-2 underline">{tx("Retry","ထပ်စမ်းရန်")}</button></div>:null}
        {mobileError?<div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{mobileError} <button onClick={()=>void load()} type="button" className="ml-2 underline">{tx("Retry","ထပ်စမ်းရန်")}</button></div>:null}
        {activeView==="home"&&<>
          <section aria-label={tx("Operational notifications","လုပ်ငန်းဆိုင်ရာ အသိပေးချက်များ")} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Bell className="h-5 w-5 text-blue-700"/>{tx("Updates for you","သင့်အတွက် အသိပေးချက်များ")}</h2><p className="mt-1 text-sm text-slate-500">{tx("Team announcements and notifications delivered to your account.","အဖွဲ့ဆိုင်ရာနှင့် သင့်အတွက် ပေးပို့ထားသော အသိပေးချက်များ")}</p></div><button type="button" onClick={()=>setActiveView("updates")} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-blue-700">{tx("View all","အားလုံးကြည့်ရန်")}<ArrowRight className="h-4 w-4"/></button></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">{mobileNotifications.slice(0,4).map((n:any,i:number)=><div key={n.id||i} className={`rounded-xl border p-4 ${n.is_read||n.read_at?"border-slate-200 bg-slate-50":"border-blue-200 bg-blue-50/70"}`}><div className="flex items-start justify-between gap-2"><p className="font-semibold text-slate-900">{n.title||tx("New notification","အသိပေးချက်")}</p>{!(n.is_read||n.read_at)&&<span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread"/>}</div><p className="mt-1 text-sm leading-6 text-slate-600">{n.message||n.body||"-"}</p><p className="mt-2 text-xs text-slate-400">{shortDate(n.created_at)}</p></div>)}</div>
            {mobileNotifications.length===0&&<p className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">{tx("No notifications currently available.","ယခုအချိန် အသိပေးချက် မရှိသေးပါ။")}</p>}
          </section>
          <section className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={()=>{setTaskFilter("all");setActiveView("tasks")}} className="flex min-h-28 items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-blue-300"><div><h2 className="text-lg font-bold text-slate-900">{tx("View assigned tasks","တာဝန်ပေးထားသော အလုပ်များ")}</h2><p className="mt-1 text-sm text-slate-500">{tx("Open your list and select a job to view details.","အလုပ်စာရင်းမှ တစ်ခုချင်းစီ ဖွင့်ကြည့်ရန်")}</p></div><ArrowRight className="h-6 w-6 shrink-0 text-blue-700"/></button>
            <Link to="/route" className="flex min-h-28 items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300"><div><h2 className="text-lg font-bold text-slate-900">{tx("Open my route","ကျွန်ုပ်၏လမ်းကြောင်း")}</h2><p className="mt-1 text-sm text-slate-500">{tx("Review planned stops and directions.","မှတ်တိုင်နှင့် လမ်းညွှန်ချက်များကြည့်ရန်")}</p></div><MapPin className="h-6 w-6 shrink-0 text-blue-700"/></Link>
          </section>
        </>}

        {activeView==="tasks"&&<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-950">{tx("My assigned tasks","ကျွန်ုပ်၏တာဝန်များ")} <span className="ml-2 text-slate-400">{filteredJobs.length}</span></h2><p className="mt-1 text-sm text-slate-500">{tx("Select a task to expand its details, then open the verified operational workflow.","လုပ်ငန်းတစ်ခုကို နှိပ်ပြီး အချက်အလက်အသေးစိတ်ကြည့်ရှုနိုင်ပါသည်။")}</p></div><Link to="/route" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-blue-700"><MapPin className="h-4 w-4"/>{tx("Route","လမ်းကြောင်း")}</Link></div>
          <div className="mt-5 flex flex-wrap gap-2">{(["all","pickup","delivery"] as const).map(kind=><button type="button" key={kind} onClick={()=>{setTaskFilter(kind);setSelectedTask("")}} aria-pressed={taskFilter===kind} className={`min-h-10 rounded-xl px-4 text-sm font-semibold ${taskFilter===kind?"bg-blue-700 text-white":"bg-slate-100 text-slate-700"}`}>{kind==="all"?tx("All","အားလုံး"):kind==="pickup"?tx("Pickup","ပစ္စည်းယူ"):tx("Delivery","ပို့ဆောင်")}</button>)}</div>
          <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 px-3"><Search className="h-5 w-5 text-slate-400"/><input value={taskSearch} onChange={e=>setTaskSearch(e.target.value)} placeholder={tx("Search waybill, recipient, merchant or township","Way ID၊ လက်ခံသူ၊ ဆိုင် သို့မဟုတ် မြို့နယ် ရှာရန်")} className="min-h-12 w-full bg-transparent text-sm outline-none"/></label>
          <div className="mt-4 space-y-2">{filteredJobs.map((job:any,index:number)=>{const id=taskId(job)||String(index);const opened=selectedTask===id;const kind=String(job.job_kind||"PICKUP").toUpperCase();const way=job.delivery_way_id||job.pickup_way_id||job.tracking_no||job.pickup_id||id;return <article key={id} className="overflow-hidden rounded-xl border border-slate-200 bg-white"><button type="button" aria-expanded={opened} onClick={()=>setSelectedTask(opened?"":id)} className="flex min-h-20 w-full items-center gap-3 p-4 text-left hover:bg-slate-50"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">{kind==="DELIVERY"?<Package className="h-5 w-5"/>:<Truck className="h-5 w-5"/>}</div><div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-950">{way}</p><p className="mt-1 truncate text-sm text-slate-600">{job.recipient_name||job.merchant_name||job.sender_name||tx("Assigned job","တာဝန်ပေးထားသော အလုပ်")}</p><p className="mt-1 text-xs text-slate-500">{kind==="DELIVERY"?tx("Delivery","ပို့ဆောင်"):tx("Pickup","ပစ္စည်းယူ")} · {job.status||tx("Assigned","တာဝန်ပေးထား")}</p></div><ChevronRight className={`h-5 w-5 text-slate-400 transition-transform ${opened?"rotate-90":""}`}/></button>{opened&&<div className="border-t border-slate-200 bg-slate-50 p-4"><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-slate-500">{tx("Waybill / ID","Waybill / ID")}</dt><dd className="mt-1 break-words font-semibold">{way}</dd></div><div><dt className="text-xs text-slate-500">{tx("Status","အခြေအနေ")}</dt><dd className="mt-1 font-semibold">{job.status||"-"}</dd></div><div><dt className="text-xs text-slate-500">{tx("Contact","ဆက်သွယ်ရန်")}</dt><dd className="mt-1 font-semibold">{job.recipient_phone||job.sender_phone||"-"}</dd></div><div><dt className="text-xs text-slate-500">{tx("Address","လိပ်စာ")}</dt><dd className="mt-1 break-words font-semibold">{job.delivery_address||job.pickup_address||job.recipient_town||job.township||"-"}</dd></div></dl><div className="mt-4 flex flex-wrap gap-2"><Link to={taskHref(job)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white">{tx("Open task","လုပ်ငန်းဖွင့်ရန်")}<ArrowRight className="h-4 w-4"/></Link>{(job.recipient_phone||job.sender_phone)&&<a href={`tel:${String(job.recipient_phone||job.sender_phone).replace(/[^+0-9]/g,"")}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700"><Phone className="h-4 w-4"/>{tx("Call","ဖုန်းဆက်ရန်")}</a>}</div></div>}</article>})}</div>
          {filteredJobs.length===0&&<p className="mt-4 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-600">{mobileError||tx("No matching assigned tasks. Pull to refresh or try another filter.","သတ်မှတ်ချက်နှင့် ကိုက်ညီသောတာဝန် မရှိပါ။")}</p>}
        </section>}

        {activeView==="updates"&&<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold text-slate-900">{tx("Notifications & announcements","အသိပေးချက်နှင့် ကြေညာချက်များ")}</h2><p className="mt-1 text-sm text-slate-500">{tx("Messages received through your authenticated Rider account.","သင့် Rider အကောင့်သို့ ရောက်ရှိလာသော အသိပေးချက်များ")}</p><div className="mt-4 space-y-3">{mobileNotifications.map((n:any,i:number)=><article key={n.id||i} className={`rounded-xl border p-4 ${n.is_read||n.read_at?"border-slate-200":"border-blue-200 bg-blue-50/60"}`}><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold text-slate-900">{n.title||tx("Notification","အသိပေးချက်")}</h3><span className="text-xs text-slate-500">{shortDate(n.created_at)}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{n.message||n.body||"-"}</p>{!(n.is_read||n.read_at)&&n.id&&<button type="button" disabled={readBusy===String(n.id)} onClick={()=>void markRead(n)} className="mt-3 min-h-10 rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-700 disabled:opacity-50">{tx("Mark as read","ဖတ်ပြီးဟု သတ်မှတ်ရန်")}</button>}</article>)}{mobileNotifications.length===0&&<p className="rounded-xl bg-slate-50 p-6 text-center text-slate-500">{tx("No notifications available.","အသိပေးချက် မရှိသေးပါ။")}</p>}</div></section>}

        {activeView==="reports"&&<>
        <section className="rider-dashboard-hero relative overflow-hidden rounded-[32px] border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,.22)]">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" /><div className="pointer-events-none absolute -bottom-16 left-10 h-44 w-44 rounded-full bg-[#d4af37]/10 blur-3xl" /><div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black tracking-[0.35em] text-[#f4d66d]">BRITIUM EXPRESS</p>
              <h1 className="mt-2 text-3xl font-black text-white">{tx("Field Team Daily Dashboard","Rider / Driver / Helper နေ့စဉ် Dashboard")}</h1>
              <p className="rider-dashboard-subtext mt-2 font-semibold text-slate-300">
                {tx(
                  "Completed and failed delivery stops leave the active work screen and are summarized here for the day, including Finance reconciliation.",
                  "ပို့ဆောင်အောင်မြင်ပြီးသော Way နှင့် မအောင်မြင်သော Way များကို Active လုပ်ငန်းစာရင်းမှ ဖယ်ရှားပြီး ယနေ့ Dashboard တွင် Finance စာရင်းညှိနှိုင်းမှုနှင့်အတူ စုစည်းပြသပါသည်။"
                )}
              </p>
              <p className="mt-2 text-sm font-bold text-slate-400">
                {daily.identity?.display_name||data.identity?.display_name||daily.identity?.worker_code||data.identity?.worker_code||"Field Team"} · {daily.identity?.worker_code||data.identity?.worker_code||"-"} · {daily.identity?.role||data.identity?.role||"-"} · {data.identity?.branch_code||"No branch"}
              </p>
              <p className="mt-1 text-xs font-black text-cyan-300">{tx("Work date","လုပ်ငန်းရက်")}: {daily.work_date||"-"}</p>
            </div>
            <button onClick={load} disabled={loading} className="v142-button-sheen v142-jelly inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#d4af37] to-[#f4d66d] px-4 text-sm font-black text-slate-950 shadow-[0_14px_30px_rgba(212,175,55,.18)] disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`} /> {tx("Sync Enterprise","Enterprise နှင့် Sync")}
            </button>
          </div>
          <div className="rider-dashboard-message mt-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-900">{message}</div>
        </section>

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
