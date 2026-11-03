import { ArrowRight, CheckCircle2, Clock3, MapPin, Navigation, Phone, RefreshCw, ScanLine, Wallet } from "lucide-react";
import type { Waybill } from "@/types/rider";

const terminal = new Set(["DELIVERED", "FAILED", "RETURN_SCANNED", "RTO"]);
const currency = (amount:number) => new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(amount || 0);

export function DeliveryMissionPanel({
  waybills, selected, onSelect, onNavigate, onVerify, onRefresh, loading,
}:{
  waybills:Waybill[];
  selected:Waybill;
  onSelect:(waybill:Waybill)=>void;
  onNavigate:(waybill:Waybill)=>void;
  onVerify:(waybill:Waybill)=>void;
  onRefresh:()=>void;
  loading:boolean;
}) {
  const ordered=[...waybills].sort((a,b)=>(a.sequenceNo||9999)-(b.sequenceNo||9999));
  const delivered=ordered.filter(w=>w.status==="DELIVERED").length;
  const outstanding=ordered.filter(w=>!terminal.has(w.status));
  const next=outstanding[0] || null;
  const amount=outstanding.reduce((sum,waybill)=>sum+Number(waybill.tariff?.expectedCod||0),0);
  const selectedNumber=selected.sequenceNo || ordered.indexOf(selected)+1;
  const hasPhone=Boolean(selected.customer.phone?.trim());
  const hasLocation=Boolean(selected.customer.location && Number.isFinite(selected.customer.location.latitude) && Number.isFinite(selected.customer.location.longitude));
  return <aside className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,.06)]" aria-label="Delivery mission controls">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-700">Today’s delivery mission</p>
        <h2 className="mt-1 text-xl font-black text-slate-950">Route command center</h2>
        <p className="mt-1 text-xs font-semibold text-slate-500">Approved stops · read-only planning</p>
      </div>
      <button type="button" onClick={onRefresh} disabled={loading} aria-label="Refresh delivery assignments"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-800 disabled:opacity-50">
        <RefreshCw className={`h-5 w-5 ${loading?"animate-spin":""}`}/>
      </button>
    </div>
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-xl bg-blue-50 p-3"><p className="text-[10px] font-bold text-blue-800">Assigned</p><p className="mt-1 text-xl font-black text-blue-950">{ordered.length}</p></div>
      <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[10px] font-bold text-emerald-800">Delivered</p><p className="mt-1 text-xl font-black text-emerald-950">{delivered}</p></div>
      <div className="rounded-xl bg-amber-50 p-3"><p className="text-[10px] font-bold text-amber-800">Open</p><p className="mt-1 text-xl font-black text-amber-950">{outstanding.length}</p></div>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={delivered} aria-valuemin={0} aria-valuemax={ordered.length} aria-label="Completed deliveries">
      <div className="h-full rounded-full bg-emerald-500" style={{width:`${ordered.length ? delivered/ordered.length*100 : 0}%`}}/>
    </div>
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 text-xs">
      <span className="flex items-center gap-2 font-semibold text-slate-600"><Wallet className="h-4 w-4"/> Expected COD for open stops</span>
      <strong className="text-sm text-slate-950">{currency(amount)} MMK</strong>
    </div>
    {next && next.id!==selected.id && <button type="button" onClick={()=>onSelect(next)}
      className="flex min-h-12 w-full items-center justify-between rounded-xl bg-amber-50 px-3 text-left text-sm font-black text-amber-950">
      <span>Go to next open stop #{next.sequenceNo || "–"}</span><ArrowRight className="h-5 w-5"/>
    </button>}
    <section className="space-y-3 rounded-2xl border border-blue-100 bg-slate-50 p-3" aria-label="Selected delivery stop">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-blue-900 px-3 py-1 text-xs font-black text-white">STOP #{selectedNumber}</span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">{selected.status.replaceAll("_"," ")}</span>
      </div>
      <div>
        <h3 className="text-base font-black text-slate-950">{selected.customer.name}</h3>
        <p className="mt-1 break-words text-xs font-semibold leading-5 text-slate-600">{selected.customer.address || selected.customer.township || "Recipient address pending"}</p>
        <p className="mt-1 font-mono text-xs font-bold text-blue-700">{selected.deliveryWayId}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-white p-3"><p className="font-semibold text-slate-500">Collection expected</p><strong className="mt-1 block text-sm text-slate-950">{currency(selected.tariff.expectedCod)} MMK</strong></div>
        <div className="rounded-xl bg-white p-3"><p className="font-semibold text-slate-500">Drop-off pin</p><strong className={`mt-1 flex items-center gap-1 text-sm ${hasLocation?"text-emerald-700":"text-amber-700"}`}><MapPin className="h-4 w-4"/>{hasLocation?"Ready":"Needs review"}</strong></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={()=>onNavigate(selected)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-900 px-2 text-xs font-black text-white"><Navigation className="h-4 w-4"/> Navigate</button>
        {hasPhone
          ? <a href={`tel:${selected.customer.phone}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-2 text-xs font-black text-slate-900"><Phone className="h-4 w-4"/> Call customer</a>
          : <span className="flex min-h-12 items-center justify-center rounded-xl border bg-slate-100 text-xs font-semibold text-slate-500">No phone provided</span>}
      </div>
      <button type="button" onClick={()=>onVerify(selected)}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 text-sm font-black text-white">
        <ScanLine className="h-5 w-5"/> Open Delivery Verification <ArrowRight className="h-4 w-4"/>
      </button>
      <p className="flex items-start gap-2 text-[11px] leading-5 text-slate-500"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/> Delivery success, payment capture, failure reasons and proof are confirmed in the existing secure verification flow—not by this overview.</p>
    </section>
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs font-black text-slate-700"><Clock3 className="h-4 w-4"/> Approved stop order</p>
      <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1" aria-label="Assigned stops">
        {ordered.map(w=><button key={w.id} type="button" onClick={()=>onSelect(w)}
          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${w.id===selected.id?"border-blue-500 bg-blue-50":"border-slate-100 bg-white"}`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-black text-white">{w.sequenceNo||"–"}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-black text-slate-900">{w.customer.name}</span><span className="block truncate font-mono text-[10px] text-slate-500">{w.deliveryWayId}</span></span>
          <span className={`text-[10px] font-bold ${w.status==="DELIVERED"?"text-emerald-700":"text-amber-700"}`}>{w.status==="DELIVERED"?"Done":w.status.replaceAll("_"," ")}</span>
        </button>)}
      </div>
    </div>
  </aside>;
}
