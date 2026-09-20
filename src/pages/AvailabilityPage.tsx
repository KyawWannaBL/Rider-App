// @ts-nocheck
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../integrations/supabase/client";

const emptyForm={is_online:false,shift_date:"",shift_start:"",shift_end:"",vehicle_type:"Motorbike",vehicle_plate:"",preferred_language:"English"};

export default function AvailabilityPage() {
  const [form,setForm]=useState(emptyForm);
  const [msg,setMsg]=useState("Loading Enterprise availability...");
  const [loading,setLoading]=useState(false);

  async function load(){
    setLoading(true);
    const {data,error}=await (supabase as any).rpc("be_rider_availability_snapshot");
    if(error){setMsg(error.message);setLoading(false);return;}
    const a=data?.availability||{};
    setForm({
      is_online:Boolean(a.is_online),
      shift_date:a.shift_date||"",
      shift_start:a.shift_start?.slice?.(0,5)||"",
      shift_end:a.shift_end?.slice?.(0,5)||"",
      vehicle_type:a.vehicle_type||"Motorbike",
      vehicle_plate:a.vehicle_plate||"",
      preferred_language:a.preferred_language||"English",
    });
    setMsg("Availability synchronized with Enterprise workforce.");
    setLoading(false);
  }

  async function save(){
    setLoading(true);
    const {data,error}=await (supabase as any).rpc("be_rider_availability_save",{p_payload:form});
    setMsg(error?error.message:"Availability, shift and vehicle details synchronized with Enterprise workforce.");
    if(!error&&data?.availability) await load(); else setLoading(false);
  }

  useEffect(()=>{load();},[]);

  return <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
    <div className="mx-auto max-w-4xl space-y-5">
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div><h1 className="text-3xl font-black">Availability & Schedule</h1><p className="mt-2 font-semibold text-slate-600">Enterprise-synchronized online status, shift, vehicle and language settings.</p></div>
          <button onClick={load} disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/>Refresh</button>
        </div>
        <div className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-900">{msg}</div>
      </section>
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <label className="flex items-center gap-3 rounded-2xl border p-4 font-black"><input type="checkbox" checked={form.is_online} onChange={e=>setForm({...form,is_online:e.target.checked})}/>Online / Available for Orders</label>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="font-bold">Shift date<input type="date" className="mt-2 w-full rounded-2xl border p-3" value={form.shift_date} onChange={e=>setForm({...form,shift_date:e.target.value})}/></label>
          <label className="font-bold">Shift start<input type="time" className="mt-2 w-full rounded-2xl border p-3" value={form.shift_start} onChange={e=>setForm({...form,shift_start:e.target.value})}/></label>
          <label className="font-bold">Shift end<input type="time" className="mt-2 w-full rounded-2xl border p-3" value={form.shift_end} onChange={e=>setForm({...form,shift_end:e.target.value})}/></label>
          <label className="font-bold">Vehicle plate<input className="mt-2 w-full rounded-2xl border p-3" value={form.vehicle_plate} onChange={e=>setForm({...form,vehicle_plate:e.target.value})}/></label>
          <label className="font-bold">Vehicle type<select className="mt-2 w-full rounded-2xl border p-3" value={form.vehicle_type} onChange={e=>setForm({...form,vehicle_type:e.target.value})}><option>Motorbike</option><option>Car</option><option>Van</option><option>Truck</option></select></label>
          <label className="font-bold">Preferred language<select className="mt-2 w-full rounded-2xl border p-3" value={form.preferred_language} onChange={e=>setForm({...form,preferred_language:e.target.value})}><option>English</option><option>Myanmar</option><option>Chinese</option></select></label>
        </div>
        <button onClick={save} disabled={loading} className="mt-5 w-full rounded-2xl bg-blue-700 p-4 font-black text-white disabled:opacity-50">Save & Sync Availability</button>
      </section>
    </div>
  </div>;
}
