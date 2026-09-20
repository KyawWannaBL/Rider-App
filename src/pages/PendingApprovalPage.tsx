import { useEffect, useState } from "react";
import { Clock, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function PendingApprovalPage() {
  const navigate = useNavigate();
  const [status,setStatus]=useState("PENDING");
  const [message,setMessage]=useState("Synchronizing your Rider access request with Enterprise Management.");
  const [loading,setLoading]=useState(false);

  async function syncRequest(){
    setLoading(true);
    try{
      const {data:ensure,error:ensureError}=await (supabase as any).rpc("be_rider_access_request_ensure");
      if(ensureError) throw ensureError;
      const {data,error}=await (supabase as any).rpc("be_rider_access_request_snapshot");
      if(error) throw error;
      const next=String(data?.status||ensure?.status||"PENDING").toUpperCase();
      setStatus(next);
      if(next==="APPROVED"){
        setMessage("Access approved. Refreshing your Enterprise workforce profile...");
        window.setTimeout(()=>window.location.assign(window.location.origin+"/#/dashboard"),400);
      }else if(next==="REJECTED"){
        setMessage("This access request was rejected. Please contact Britium Operations / HR if you need a review.");
      }else{
        setMessage("Your account is waiting for Britium Enterprise approval and workforce mapping.");
      }
    }catch(error:any){
      setMessage(error?.message||"Unable to synchronize the access request.");
    }finally{
      setLoading(false);
    }
  }

  async function handleLogout(){
    await supabase.auth.signOut();
    navigate("/login",{replace:true});
  }

  useEffect(()=>{void syncRequest();},[]);

  return (
    <div className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center">
        <section className="w-full rounded-3xl border border-white/10 bg-white/5 p-7 text-center shadow-2xl backdrop-blur">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
            {status==="APPROVED"?<ShieldCheck className="h-10 w-10"/>:<Clock className="h-10 w-10"/>}
          </div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.3em] text-blue-300">BRITIUM EXPRESS</p>
          <h1 className="mt-2 text-2xl font-black">
            {status==="APPROVED"?"Access Approved":status==="REJECTED"?"Access Review Required":"Pending Enterprise Approval"}
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">{message}</p>
          <div className="mt-5 rounded-2xl bg-black/20 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Enterprise Status</p>
            <p className="mt-2 text-lg font-black text-white">{status.replaceAll("_"," ")}</p>
          </div>
          <div className="mt-6 grid gap-3">
            <button onClick={syncRequest} disabled={loading} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 font-black text-white disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/> Check Approval Status
            </button>
            <button onClick={handleLogout} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 font-black text-rose-200">
              <LogOut className="h-4 w-4"/> Sign Out
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
