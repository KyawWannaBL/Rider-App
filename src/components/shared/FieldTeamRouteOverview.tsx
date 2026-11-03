import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Stop = { wayId:string; sequence:number; address:string; lat:number|null; lng:number|null };
const OFFICES = [
  { code:"YGN", label:"Yangon Head Office", lat:16.8409, lng:96.1735 },
  { code:"MDY", label:"Mandalay Branch Office", lat:21.920487832867, lng:96.1161929959684 },
  { code:"NPT", label:"Naypyidaw Branch Office", lat:19.7353744598781, lng:96.1527056747248 },
];
function valid(lat:unknown,lng:unknown){
  return lat!=null && lng!=null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
    && Math.abs(Number(lat))<=90 && Math.abs(Number(lng))<=180
    && !(Number(lat)===0 && Number(lng)===0);
}
function mapUrl(origin:string,stops:Stop[]) {
  const points=stops.map(s=>`${s.lat},${s.lng}`);
  const p=new URLSearchParams({ api:"1", travelmode:"driving", origin, destination:points[points.length-1] });
  if(points.length>1)p.set("waypoints",points.slice(0,-1).join("|"));
  return "https://www.google.com/maps/dir/?"+p.toString();
}

export function FieldTeamRouteOverview() {
  const [open,setOpen]=useState(false);
  const [plans,setPlans]=useState<Record<string,Stop[]>>({});
  const [planId,setPlanId]=useState("");
  const [officeCode,setOfficeCode]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  useEffect(()=>{
    if(!open)return;
    let cancelled=false;setLoading(true);setError("");
    void (async()=>{
      try {
        const response=await (supabase as any).rpc("be_rider_delivery_wayplan_jobs_v187",{p_rider_code:null,p_limit:300});
        if(response.error)throw response.error;
        if(response.data?.ok===false)throw Error(response.data.error||"Route not available");
        const jobs:any[]=Array.isArray(response.data?.jobs)?response.data.jobs:[];
        const ids=[...new Set(jobs.map(row=>String(row.delivery_way_id||"").toUpperCase()).filter(Boolean))];
        const locations=new Map<string,any>();
        if(ids.length){
          const loc=await (supabase as any).rpc("be_delivery_location_batch_v10",{p_delivery_way_ids:ids});
          if(!loc.error&&Array.isArray(loc.data)) {
            for(const row of loc.data)locations.set(String(row.delivery_way_id||"").toUpperCase(),row);
          }
        }
        const grouped:Record<string,Stop[]>={};
        for(const row of jobs){
          const wayId=String(row.delivery_way_id||"");
          if(!wayId)continue;
          const loc=locations.get(wayId.toUpperCase());
          const latitude=loc?.latitude??row.latitude??row.metadata?.latitude;
          const longitude=loc?.longitude??row.longitude??row.metadata?.longitude;
          const id=String(row.wayplan_id||"ACTIVE");
          (grouped[id] ||= []).push({
            wayId, sequence:Number(row.stop_sequence||0),
            address:String(row.recipient_address||row.delivery_address||row.recipient_township||""),
            lat:valid(latitude,longitude)?Number(latitude):null,
            lng:valid(latitude,longitude)?Number(longitude):null,
          });
        }
        Object.values(grouped).forEach(stops=>stops.sort((a,b)=>a.sequence-b.sequence));
        if(!cancelled){
          setPlans(grouped);
          setPlanId(previous=>grouped[previous]?previous:Object.keys(grouped)[0]||"");
          if(!Object.keys(grouped).length)setError("No active assigned delivery stops were found.");
        }
      }catch(e:any){if(!cancelled)setError(e?.message||"Could not load the assigned route.");}
      finally{if(!cancelled)setLoading(false);}
    })();
    return ()=>{cancelled=true;};
  },[open]);
  const stops=plans[planId]||[];
  const office=OFFICES.find(item=>item.code===officeCode);
  const complete=stops.length>0&&stops.every(stop=>stop.lat!==null&&stop.lng!==null);
  const segments:{from:number;to:number;url:string}[]=[];
  if(office&&complete){
    for(let i=0;i<stops.length;i+=9){
      const batch=stops.slice(i,i+9);
      const origin=i===0?`${office.lat},${office.lng}`:`${stops[i-1].lat},${stops[i-1].lng}`;
      segments.push({from:i+1,to:i+batch.length,url:mapUrl(origin,batch)});
    }
  }
  return <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" data-field-route-overview="true">
    <button type="button" onClick={()=>setOpen(value=>!value)}
      className="min-h-12 w-full rounded-xl bg-blue-100 px-4 text-left font-black text-blue-950">
      Full Assigned Route Map · {open?"Hide":"View"}
    </button>
    {open&&<div className="mt-3 space-y-3 text-sm">
      <p className="text-xs text-slate-600">Supervisor-approved stop sequence. Viewing directions does not change assignments or dispatch.</p>
      {loading&&<p>Loading assigned route…</p>}
      {error&&<p className="rounded-xl bg-amber-50 p-3 font-semibold text-amber-900">{error}</p>}
      {Object.keys(plans).length>1&&<label className="block font-bold">Wayplan
        <select value={planId} onChange={e=>setPlanId(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border p-2">
          {Object.keys(plans).map(id=><option key={id} value={id}>{id}</option>)}
        </select>
      </label>}
      <label className="block font-bold">Departure office
        <select value={officeCode} onChange={e=>setOfficeCode(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border p-2">
          <option value="">Select head office / branch</option>
          {OFFICES.map(item=><option key={item.code} value={item.code}>{item.label}</option>)}
        </select>
      </label>
      <p className="text-xs text-amber-800">Office reference coordinates must be confirmed before travel; the app does not infer your departure office.</p>
      {!complete&&stops.length>0&&<p className="rounded-xl bg-amber-50 p-3 font-semibold text-amber-900">
        {stops.filter(s=>s.lat===null||s.lng===null).length} stop(s) have no precise pin. Complete locations before opening the full map.
      </p>}
      {segments.map(part=><a key={part.from} href={part.url} target="_blank" rel="noopener noreferrer"
        className="block min-h-12 rounded-xl bg-blue-900 p-3 font-black text-white">
        Open Google Maps · stops {part.from}–{part.to}
      </a>)}
      <ol className="max-h-80 space-y-2 overflow-y-auto">
        {stops.map((stop,index)=><li key={stop.wayId} className="rounded-xl border p-3">
          <b>#{stop.sequence||index+1} · {stop.wayId}</b>
          <div>{stop.address||"Address pending"}</div>
          {stop.lat===null&&<span className="text-amber-700">Pin pending</span>}
        </li>)}
      </ol>
    </div>}
  </section>;
}
