import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Database, DollarSign, Loader2, RefreshCw, ShieldCheck, User, Zap } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

interface PortalSyncCenterProps { role: "rider" | "driver" | "helper"; }
type SyncStatus="idle"|"syncing"|"success"|"error";
type SyncResult={key:string;label:string;count:number|null;error:string|null;icon:React.ReactNode};

export default function PortalSyncCenter({ role }: PortalSyncCenterProps){
 const [status,setStatus]=useState<SyncStatus>("idle");
 const [lastSync,setLastSync]=useState<string|null>(null);
 const [errorMsg,setErrorMsg]=useState<string|null>(null);
 const [syncLog,setSyncLog]=useState<SyncResult[]>([]);
 const [autoSync,setAutoSync]=useState(false);
 const timerRef=useRef<ReturnType<typeof setInterval>|null>(null);

 async function runSync(){
  if(!isSupabaseConfigured||!supabase){setStatus("error");setErrorMsg("Supabase configuration is missing.");return;}
  setStatus("syncing");setErrorMsg(null);
  const results:SyncResult[]=[];
  const calls=[
    {key:"profile",label:"Enterprise Profile / Identity",icon:<User className="h-3.5 w-3.5"/>,rpc:"be_field_profile_snapshot_v91",args:{}},
    {key:"jobs",label:"Assignments / Notifications",icon:<Database className="h-3.5 w-3.5"/>,rpc:"be_rider_dashboard_snapshot",args:{}},
    {key:"finance",label:"COD / Commission / Settlement",icon:<DollarSign className="h-3.5 w-3.5"/>,rpc:"be_field_financial_snapshot_v91",args:{p_days:30}},
  ];
  for(const call of calls){
    try{
      const {data,error}=await (supabase as any).rpc(call.rpc,call.args);
      if(error) throw error;
      let count=1;
      if(call.key==="jobs") count=Number(data?.counts?.jobs||data?.counts?.delivery_jobs||0);
      if(call.key==="finance") count=(Array.isArray(data?.commission?.rows)?data.commission.rows.length:0)+(Array.isArray(data?.cod_settlements)?data.cod_settlements.length:0);
      results.push({key:call.key,label:call.label,count,error:null,icon:call.icon});
    }catch(e:any){
      results.push({key:call.key,label:call.label,count:null,error:e?.message||"Sync failed",icon:call.icon});
    }
  }
  setSyncLog(results);
  const failed=results.some(r=>r.error);
  setStatus(failed?"error":"success");
  setErrorMsg(failed?"One or more Enterprise services failed. See details below.":null);
  setLastSync(new Date().toLocaleString());
 }

 useEffect(()=>{ if(autoSync) timerRef.current=setInterval(()=>void runSync(),60_000); else if(timerRef.current) clearInterval(timerRef.current); return()=>{if(timerRef.current) clearInterval(timerRef.current)}; },[autoSync]);
 useEffect(()=>{void runSync();},[]);

 const cfg={
  idle:{label:"Ready to Sync",icon:<Database className="h-7 w-7"/>},
  syncing:{label:"Synchronizing...",icon:<Loader2 className="h-7 w-7 animate-spin"/>},
  success:{label:"Enterprise Sync Healthy",icon:<CheckCircle2 className="h-7 w-7"/>},
  error:{label:"Enterprise Sync Needs Attention",icon:<AlertCircle className="h-7 w-7"/>},
 }[status];

 return <div className="space-y-5 p-4 pb-24">
  <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{role} · www.britiumexpress.com</p><h1 className="mt-1 text-2xl font-black text-foreground">Enterprise Portal Sync</h1></div>
  <div className="rounded-3xl p-6 text-center" style={{background:"oklch(0.13 0.032 258)",border:"1px solid oklch(0.19 0.036 260)"}}>
   <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted/20">{cfg.icon}</div><p className="mt-3 font-black text-foreground">{cfg.label}</p>
   {lastSync&&<p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3"/>Last sync: {lastSync}</p>}
   {errorMsg&&<p className="mt-2 text-xs text-destructive">{errorMsg}</p>}
   <button onClick={runSync} disabled={status==="syncing"} className="mt-4 inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black" style={{background:"oklch(0.83 0.175 96)",color:"oklch(0.09 0.028 256)"}}><RefreshCw className={`h-4 w-4 ${status==="syncing"?"animate-spin":""}`}/>Full Enterprise Sync</button>
  </div>

  <div className="flex items-center justify-between rounded-2xl bg-muted/20 px-4 py-3.5"><div className="flex items-center gap-2"><Zap className="h-4 w-4"/><div><p className="text-sm font-bold text-foreground">Auto Sync</p><p className="text-xs text-muted-foreground">Refresh every minute</p></div></div><button onClick={()=>setAutoSync(v=>!v)} className={`relative h-6 w-11 rounded-full ${autoSync?"bg-emerald-500":"bg-slate-700"}`}><span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${autoSync?"translate-x-5":""}`}/></button></div>

  <div className="space-y-2">{syncLog.map(r=><div key={r.key} className="flex items-center gap-3 rounded-2xl bg-muted/20 px-4 py-3"><div className="grid h-8 w-8 place-items-center rounded-xl bg-background">{r.icon}</div><div className="min-w-0 flex-1"><p className="text-sm font-bold text-foreground">{r.label}</p>{r.error?<p className="truncate text-xs text-destructive">{r.error}</p>:<p className="text-xs text-muted-foreground">{r.count} synchronized record(s)</p>}</div>{r.error?<AlertCircle className="h-4 w-4 text-destructive"/>:<CheckCircle2 className="h-4 w-4 text-emerald-500"/>}</div>)}</div>

  <div className="rounded-2xl bg-muted/20 p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4"/><p className="text-sm font-black text-foreground">Canonical sources</p></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Profile identity, assignments, failed-way/RTO events, COD settlements, commissions and notifications are read through authenticated Enterprise RPCs. Generic jobs/cod/profile table reads are not used.</p></div>
 </div>;
}
