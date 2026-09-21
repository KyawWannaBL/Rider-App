import { useEffect, useState } from "react";
import { Clock, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppState } from "@/hooks/useAppState";

export default function PendingApprovalPage() {
  const { language, toggleLanguage } = useAppState();
  const tx = (en:string,my:string) => language === "my" ? my : en;
  const navigate = useNavigate();
  const [status,setStatus]=useState("PENDING");
  const [message,setMessage]=useState(language === "my" ? "Rider ဝင်ရောက်ခွင့်တောင်းဆိုမှုကို Enterprise Management နှင့် ချိတ်ဆက်နေသည်။" : "Synchronizing your Rider access request with Enterprise Management.");
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
        setMessage(tx("Access approved. Refreshing your Enterprise workforce profile...","ဝင်ရောက်ခွင့် အတည်ပြုပြီးပါပြီ။ Enterprise workforce profile ကို ပြန်ဖွင့်နေသည်..."));
        window.setTimeout(()=>window.location.assign(window.location.origin+"/#/dashboard"),400);
      }else if(next==="REJECTED"){
        setMessage(tx("This access request was rejected. Please contact Britium Operations / HR if you need a review.","ဝင်ရောက်ခွင့်တောင်းဆိုမှုကို ငြင်းပယ်ထားပါသည်။ ပြန်လည်စစ်ဆေးလိုပါက Britium Operations / HR ကို ဆက်သွယ်ပါ။"));
      }else{
        setMessage(tx("Your account is waiting for Britium Enterprise approval and workforce mapping.","သင့်အကောင့်သည် Britium Enterprise အတည်ပြုချက်နှင့် ဝန်ထမ်းချိတ်ဆက်မှုကို စောင့်နေပါသည်။"));
      }
    }catch(error:any){
      setMessage(error?.message||tx("Unable to synchronize the access request.","ဝင်ရောက်ခွင့်တောင်းဆိုမှုကို ချိတ်ဆက်မရပါ။"));
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
        <section className="relative w-full rounded-3xl border border-white/10 bg-white/5 p-7 text-center shadow-2xl backdrop-blur">
          <button type="button" onClick={toggleLanguage} className="absolute right-4 top-4 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white">
            {language === "my" ? "English" : "မြန်မာ"}
          </button>
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
            {status==="APPROVED"?<ShieldCheck className="h-10 w-10"/>:<Clock className="h-10 w-10"/>}
          </div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.3em] text-blue-300">BRITIUM EXPRESS</p>
          <h1 className="mt-2 text-2xl font-black">
            {status==="APPROVED"?tx("Access Approved","ဝင်ရောက်ခွင့် အတည်ပြုပြီး"):status==="REJECTED"?tx("Access Review Required","ဝင်ရောက်ခွင့် ပြန်လည်စစ်ဆေးရန်လိုအပ်သည်"):tx("Pending Enterprise Approval","Enterprise အတည်ပြုချက် စောင့်နေသည်")}
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">{message}</p>
          <div className="mt-5 rounded-2xl bg-black/20 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">{tx("Enterprise Status","Enterprise အခြေအနေ")}</p>
            <p className="mt-2 text-lg font-black text-white">{status.replaceAll("_"," ")}</p>
          </div>
          <div className="mt-6 grid gap-3">
            <button onClick={syncRequest} disabled={loading} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 font-black text-white disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/> {tx("Check Approval Status","အတည်ပြုမှုအခြေအနေ စစ်ရန်")}
            </button>
            <button onClick={handleLogout} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 font-black text-rose-200">
              <LogOut className="h-4 w-4"/> {tx("Sign Out","အကောင့်မှထွက်ရန်")}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
