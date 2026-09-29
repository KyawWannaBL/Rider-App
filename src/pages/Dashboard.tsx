// @ts-nocheck
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
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { useAppState } from "../hooks/useAppState";
import { riderFeedback } from "../lib/riderFeedback";

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
  const [message,setMessage]=useState(language === "my" ? "Enterprise Portal အခြေအနေကို ဖွင့်နေသည်..." : "Loading Enterprise Portal status...");

  async function load(){
    setLoading(true);
    const [portal,dailyResult,settlementResult]=await Promise.all([
      (supabase as any).rpc("be_rider_dashboard_snapshot"),
      (supabase as any).rpc("be_field_team_delivery_daily_dashboard_v172",{p_work_date:null}),
      (supabase as any).rpc("be_finance_field_settlement_center_v1",{p_work_date:null}),
    ]);
    if(portal.error){
      setMessage(portal.error.message);
      setLoading(false);
      return;
    }
    setData(portal.data||{});
    if(!dailyResult.error && dailyResult.data?.ok!==false) setDaily(dailyResult.data||{});
    else if(dailyResult.error) setMessage(dailyResult.error.message);
    if(!settlementResult.error && settlementResult.data?.ok!==false) setSettlements(Array.isArray(settlementResult.data?.rows)?settlementResult.data.rows:[]);
    else if(settlementResult.error) setMessage(settlementResult.error.message);
    else setMessage(dailyResult.data?.error || tx("Unable to load today's delivery summary.","ယနေ့ ပို့ဆောင်မှုအနှစ်ချုပ်ကို ဖွင့်၍မရပါ။"));
    if(!dailyResult.error && dailyResult.data?.ok!==false){
      riderFeedback("success");
      setMessage(tx("Enterprise Portal and today's field settlement are synchronized.","Enterprise Portal နှင့် ယနေ့ Field Settlement အချက်အလက်များ ချိတ်ဆက်ပြီးပါပြီ။"));
    }
    setLoading(false);
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
      </div>
    </div>
  );
}
