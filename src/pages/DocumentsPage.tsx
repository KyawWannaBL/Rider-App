// @ts-nocheck
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../integrations/supabase/client";
import { useAppState } from "../hooks/useAppState";

export default function DocumentsPage(){
 const [form,setForm]=useState({document_type:"driver_license",file_name:"",file_data_url:""});
 const [documents,setDocuments]=useState<any[]>([]);
 const [msg,setMsg]=useState(language === "my" ? "Enterprise စာရွက်စာတမ်းအခြေအနေကို ဖွင့်နေသည်..." : "Loading Enterprise document status...");
 const [loading,setLoading]=useState(false);

 async function load(){
  setLoading(true);
  const {data,error}=await (supabase as any).rpc("be_rider_document_snapshot");
  if(error){setMsg(error.message);setLoading(false);return;}
  setDocuments(Array.isArray(data?.documents)?data.documents:[]);
  setMsg(tx("Documents synchronized with Enterprise verification records.","စာရွက်စာတမ်းများကို Enterprise စစ်ဆေးအတည်ပြုမှတ်တမ်းနှင့် ချိတ်ဆက်ပြီးပါပြီ။"));
  setLoading(false);
 }
 function selectFile(file?:File){
  if(!file)return;
  if(file.size>6*1024*1024){setMsg("File is too large. Maximum 6 MB.");return;}
  const reader=new FileReader();
  reader.onload=()=>setForm(c=>({...c,file_name:file.name,file_data_url:String(reader.result||"")}));
  reader.readAsDataURL(file);
 }
 async function save(){
  if(!form.file_data_url)return setMsg("Select a document first.");
  setLoading(true);
  const {data,error}=await (supabase as any).rpc("be_rider_document_save",{p_payload:form});
  if(error){setMsg(error.message);setLoading(false);return;}
  setMsg("Document submitted to Enterprise Operations for verification.");
  setForm({...form,file_name:"",file_data_url:""});
  await load();
 }
 useEffect(()=>{load();},[]);

 return <div className="min-h-screen bg-slate-50 p-4 sm:p-6"><div className="mx-auto max-w-5xl space-y-5">
  <section className="rounded-3xl border bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-4"><div><h1 className="text-3xl font-black">Document Management</h1><p className="mt-2 font-semibold text-slate-600">Submit Rider identity/vehicle documents and track Enterprise verification status.</p></div><button onClick={load} disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/>{tx("Refresh","ပြန်ဖွင့်ရန်")}</button></div><div className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-900">{msg}</div></section>
  <section className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
   <div className="rounded-3xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Submit Document</h2><select className="mt-5 w-full rounded-2xl border p-3 font-bold" value={form.document_type} onChange={e=>setForm({...form,document_type:e.target.value})}><option value="driver_license">Driver License</option><option value="national_id">National ID / NRC</option><option value="vehicle_registration">Vehicle Registration</option><option value="insurance">Insurance</option></select><input className="mt-4 w-full rounded-2xl border p-3" type="file" accept="image/*,.pdf" onChange={e=>selectFile(e.target.files?.[0])}/>{form.file_name&&<p className="mt-3 font-bold text-slate-600">Selected: {form.file_name}</p>}<button onClick={save} disabled={loading||!form.file_data_url} className="mt-5 w-full rounded-2xl bg-blue-700 p-4 font-black text-white disabled:opacity-50">Submit to Operations</button></div>
   <div className="rounded-3xl border bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xl font-black">Verification Status</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{documents.length} documents</span></div><div className="mt-4 space-y-3">{documents.length===0?<p className="rounded-2xl bg-slate-50 p-6 text-center font-bold text-slate-500">No submitted documents.</p>:documents.map(d=><div key={d.id} className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-black">{String(d.document_type||"document").replaceAll("_"," ")}</p><p className="mt-1 text-sm font-semibold text-slate-500">{d.file_name||"-"}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{d.verification_status||"PENDING"}</span></div><p className="mt-2 text-xs text-slate-500">{d.created_at?new Date(d.created_at).toLocaleString():"-"}</p></div>)}</div></div>
  </section>
 </div></div>;
}
