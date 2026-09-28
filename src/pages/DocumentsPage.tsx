// @ts-nocheck
import { useEffect, useState } from "react";
import { FileCheck2, RefreshCw, UploadCloud } from "lucide-react";
import { supabase } from "../integrations/supabase/client";
import { useAppState } from "../hooks/useAppState";

export default function DocumentsPage(){
  const { language } = useAppState();
  const tx=(en:string,my:string)=>language==="my"?my:en;
  const [form,setForm]=useState({document_type:"national_id",file_name:"",file_data_url:""});
  const [documents,setDocuments]=useState<any[]>([]);
  const [identity,setIdentity]=useState<any>({});
  const [msg,setMsg]=useState(tx("Loading Enterprise document status...","Enterprise စာရွက်စာတမ်းအခြေအနေကို ဖွင့်နေသည်..."));
  const [loading,setLoading]=useState(false);

  async function load(){
    setLoading(true);
    const {data,error}=await (supabase as any).rpc("be_rider_document_snapshot");
    if(error){setMsg(error.message);setLoading(false);return;}
    setDocuments(Array.isArray(data?.documents)?data.documents:[]);
    setIdentity(data?.identity||{});
    setMsg(tx("Documents synchronized with Enterprise Operations verification.","စာရွက်စာတမ်းများကို Enterprise Operations စစ်ဆေးအတည်ပြုစနစ်နှင့် ချိတ်ဆက်ပြီးပါပြီ။"));
    setLoading(false);
  }

  function selectFile(file?:File){
    if(!file)return;
    if(file.size>6*1024*1024){setMsg(tx("File is too large. Maximum 6 MB.","ဖိုင်အရွယ်အစား 6 MB ထက်မကျော်ရပါ။"));return;}
    const reader=new FileReader();
    reader.onload=()=>setForm(c=>({...c,file_name:file.name,file_data_url:String(reader.result||"")}));
    reader.readAsDataURL(file);
  }

  async function save(){
    if(!form.file_data_url)return setMsg(tx("Select a document first.","စာရွက်စာတမ်းဖိုင်ကို အရင်ရွေးပါ။"));
    setLoading(true);
    const {data,error}=await (supabase as any).rpc("be_rider_document_save",{p_payload:form});
    if(error || data?.ok===false){
      setMsg(error?.message||data?.error||tx("Document submission failed.","စာရွက်စာတမ်းတင်သွင်းမှု မအောင်မြင်ပါ။"));
      setLoading(false);
      return;
    }
    setMsg(tx("Document submitted to Enterprise Operations for verification.","စာရွက်စာတမ်းကို Enterprise Operations သို့ စစ်ဆေးအတည်ပြုရန် တင်သွင်းပြီးပါပြီ။"));
    setForm({...form,file_name:"",file_data_url:""});
    await load();
  }

  useEffect(()=>{void load();},[]);

  return <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black tracking-[0.3em] text-blue-600">BRITIUM EXPRESS</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">{tx("Documents","စာရွက်စာတမ်းများ")}</h1>
            <p className="mt-2 font-semibold text-slate-600">{tx("Submit workforce identity and vehicle documents and track Operations verification status.","ဝန်ထမ်းအထောက်အထားနှင့် ယာဉ်ဆိုင်ရာစာရွက်စာတမ်းများ တင်သွင်းပြီး Operations စစ်ဆေးအတည်ပြုမှုကို စောင့်ကြည့်နိုင်ပါသည်။")}</p>
            <p className="mt-2 text-sm font-bold text-slate-500">{identity?.display_name||identity?.worker_code||"Field Team"} · {identity?.worker_code||"-"} · {String(identity?.role||"-").toUpperCase()}</p>
          </div>
          <button onClick={()=>void load()} disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/>{tx("Refresh","ပြန်ဖွင့်ရန်")}</button>
        </div>
        <div className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-900">{msg}</div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2"><UploadCloud className="h-5 w-5 text-blue-700"/><h2 className="text-xl font-black">{tx("Submit Document","စာရွက်စာတမ်းတင်သွင်းရန်")}</h2></div>
          <select className="mt-5 w-full rounded-2xl border border-slate-200 p-3 font-bold" value={form.document_type} onChange={e=>setForm({...form,document_type:e.target.value})}>
            <option value="national_id">{tx("National ID / NRC","မှတ်ပုံတင် / NRC")}</option>
            <option value="driver_license">{tx("Driver License","ယာဉ်မောင်းလိုင်စင်")}</option>
            <option value="vehicle_registration">{tx("Vehicle Registration","ယာဉ်မှတ်ပုံတင်")}</option>
            <option value="insurance">{tx("Insurance","အာမခံ")}</option>
            <option value="employment_document">{tx("Employment Document","အလုပ်ခန့်စာ / ဝန်ထမ်းစာရွက်စာတမ်း")}</option>
            <option value="other">{tx("Other","အခြား")}</option>
          </select>
          <input className="mt-4 w-full rounded-2xl border border-slate-200 p-3" type="file" accept="image/*,.pdf" onChange={e=>selectFile(e.target.files?.[0])}/>
          {form.file_name&&<p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-600">{tx("Selected","ရွေးထားသောဖိုင်")}: {form.file_name}</p>}
          <button onClick={()=>void save()} disabled={loading||!form.file_data_url} className="mt-5 w-full rounded-2xl bg-blue-700 p-4 font-black text-white disabled:opacity-50">{tx("Submit to Operations","Operations သို့ တင်သွင်းမည်")}</button>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-blue-700"/><h2 className="text-xl font-black">{tx("Verification Status","စစ်ဆေးအတည်ပြုမှု အခြေအနေ")}</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{documents.length}</span></div>
          <div className="mt-4 space-y-3">
            {documents.length===0?<p className="rounded-2xl bg-slate-50 p-6 text-center font-bold text-slate-500">{tx("No submitted documents.","တင်သွင်းထားသောစာရွက်စာတမ်း မရှိသေးပါ။")}</p>:documents.map(d=>{
              const status=String(d.verification_status||"PENDING").toUpperCase();
              const cls=status==="APPROVED"||status==="VERIFIED"?"bg-emerald-100 text-emerald-800":status==="REJECTED"?"bg-rose-100 text-rose-800":"bg-amber-100 text-amber-800";
              return <div key={d.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-black">{String(d.document_type||"document").replaceAll("_"," ")}</p><p className="mt-1 text-sm font-semibold text-slate-500">{d.file_name||"-"}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${cls}`}>{status}</span></div>
                <p className="mt-2 text-xs font-bold text-slate-500">{d.created_at?new Date(d.created_at).toLocaleString():"-"}</p>
                {d.verified_at&&<p className="mt-1 text-xs font-bold text-emerald-700">{tx("Verified","စစ်ဆေးပြီး")}: {new Date(d.verified_at).toLocaleString()}</p>}
              </div>
            })}
          </div>
        </div>
      </section>
    </div>
  </div>;
}
