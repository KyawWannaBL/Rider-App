import { useEffect, useState } from "react";
import { Loader2, RefreshCw, TrendingUp, WalletCards } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface EarningsPanelProps { role: "rider" | "driver" | "helper"; }

export function EarningsPanel({ role }: EarningsPanelProps) {
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("Loading Enterprise commission and settlement data...");

  async function load(){
    setLoading(true);
    const {data:result,error}=await (supabase as any).rpc("be_field_financial_snapshot_v91",{p_days:30});
    if(error){setMessage(error.message);setData(null);} else {setData(result);setMessage("Commission, COD and wallet data synchronized with Enterprise Finance.");}
    setLoading(false);
  }
  useEffect(()=>{void load();},[]);

  if(loading&&!data) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground"/></div>;

  const commission=data?.commission||{};
  const wallet=data?.wallet||{};
  const rows=Array.isArray(commission.rows)?commission.rows:[];

  return <div className="space-y-4 p-4">
    <div className="flex items-center justify-between">
      <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{role} · Enterprise Finance</p><h1 className="mt-1 text-xl font-black text-foreground">Commission & Earnings</h1></div>
      <button onClick={load} disabled={loading} className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-black" style={{background:"oklch(0.83 0.175 96)",color:"oklch(0.09 0.028 256)"}}><RefreshCw className={`h-3.5 w-3.5 ${loading?"animate-spin":""}`}/>Refresh</button>
    </div>

    <div className="rounded-2xl p-3 text-xs font-bold" style={{background:"oklch(0.55 0.18 240 / 0.10)",border:"1px solid oklch(0.55 0.18 240 / 0.25)"}}>{message}</div>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Metric label="30-Day Commission" value={Number(commission.total||0)} suffix=" MMK"/>
      <Metric label="Pending Commission" value={Number(commission.pending||0)} suffix=" MMK"/>
      <Metric label="Paid Commission" value={Number(commission.paid||0)} suffix=" MMK"/>
      <Metric label="Commission Units" value={Number(commission.units||0)} suffix=""/>
      <Metric label="COD Collected" value={Number(wallet.cod_collected||0)} suffix=" MMK"/>
      <Metric label="COD Handed Over" value={Number(wallet.cod_handed_over||0)} suffix=" MMK"/>
      <Metric label="COD Balance" value={Number(wallet.cod_balance||0)} suffix=" MMK"/>
      <Metric label="Settled Jobs" value={Number(wallet.completed_jobs||0)} suffix=""/>
    </div>

    <section className="rounded-2xl p-4" style={{background:"oklch(0.13 0.032 258)",border:"1px solid oklch(0.19 0.036 260)"}}>
      <div className="flex items-center gap-2"><TrendingUp className="h-5 w-5"/><h2 className="font-black text-foreground">Commission Breakdown</h2></div>
      <div className="mt-3 space-y-2">
        {rows.length===0?<p className="rounded-xl bg-muted/20 p-5 text-center text-sm font-bold text-muted-foreground">No Enterprise commission rows for the selected period.</p>:rows.map((r:any,i:number)=><div key={`${r.work_date}-${r.operation_type}-${i}`} className="flex items-center justify-between gap-3 rounded-xl bg-muted/20 px-4 py-3"><div><p className="text-sm font-black text-foreground">{String(r.operation_type||"COMMISSION").replaceAll("_"," ")}</p><p className="text-xs text-muted-foreground">{r.work_date} · {Number(r.total_units||0).toLocaleString()} {r.unit_type||"unit(s)"}</p></div><div className="text-right"><p className="text-sm font-black">{Number(r.commission_mmk||0).toLocaleString()} MMK</p><p className="text-[10px] text-muted-foreground">@ {Number(r.rate_mmk||0).toLocaleString()} MMK</p></div></div>)}
      </div>
    </section>

    <section className="rounded-2xl p-4" style={{background:"oklch(0.13 0.032 258)",border:"1px solid oklch(0.19 0.036 260)"}}>
      <div className="flex items-center gap-2"><WalletCards className="h-5 w-5"/><h2 className="font-black text-foreground">Finance Rule</h2></div>
      <p className="mt-2 text-sm text-muted-foreground">Commission shown here is calculated by Enterprise commission rules and Finance settlement records. The mobile app does not estimate or override rates.</p>
    </section>
  </div>;
}

function Metric({label,value,suffix}:{label:string;value:number;suffix:string}){
  return <div className="rounded-2xl p-4" style={{background:"oklch(0.13 0.032 258)",border:"1px solid oklch(0.19 0.036 260)"}}><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-2 text-lg font-black text-foreground">{Number(value||0).toLocaleString()}{suffix}</p></div>;
}
