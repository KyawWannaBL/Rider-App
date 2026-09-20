import { useEffect, useState } from "react";
import { ChevronRight, HeadphonesIcon, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SupportPanelProps { role: "rider" | "driver" | "helper"; }

export function SupportPanel({ role }: SupportPanelProps) {
  const [subject,setSubject]=useState("");
  const [message,setMessage]=useState("");
  const [pickupId,setPickupId]=useState("");
  const [ticketType,setTicketType]=useState("delivery_issue");
  const [priority,setPriority]=useState("normal");
  const [tickets,setTickets]=useState<any[]>([]);
  const [status,setStatus]=useState("Loading Enterprise support...");
  const [sending,setSending]=useState(false);

  async function load(){
    const {data,error}=await (supabase as any).rpc("be_rider_support_snapshot",{p_limit:50});
    if(error){setStatus(error.message);return;}
    setTickets(Array.isArray(data?.tickets)?data.tickets:[]);
    setStatus("Support synchronized with Enterprise CS / Operations.");
  }

  async function handleSend(){
    if(!subject.trim()||!message.trim()){setStatus("Subject and message are required.");return;}
    setSending(true);
    const {data,error}=await (supabase as any).rpc("be_rider_support_ticket_save",{p_payload:{
      pickup_id:pickupId||null,
      ticket_type:ticketType,
      priority,
      subject:`[${role.toUpperCase()}] ${subject.trim()}`,
      message:message.trim(),
    }});
    if(error){setStatus(error.message);}else{
      setStatus(`Enterprise ticket submitted${data?.cs_ticket_no?` as ${data.cs_ticket_no}`:""}.`);
      setSubject("");setMessage("");setPickupId("");await load();
    }
    setSending(false);
  }

  useEffect(()=>{void load();},[]);

  const faqs=[
    ["How do I confirm a pickup?","Use Pickup Verification. Weight and approved photo are synchronized to Enterprise Data Entry review."],
    ["How do I report a failed delivery?","Open Delivery Verification, choose the exact failed reason, and submit. Warehouse, CS, Finance and Operations are synchronized automatically."],
    ["When do I hand over COD?","After a delivered COD parcel, use COD Settlement. Enterprise Finance keeps the authoritative amount and settlement state."],
  ];

  return <div className="space-y-5">
    <div className="flex items-center justify-between"><div className="flex items-center gap-3"><HeadphonesIcon className="h-5 w-5 text-muted-foreground"/><div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{role} · Enterprise</p><h1 className="text-xl font-black text-foreground">Support</h1></div></div><button onClick={load} className="rounded-xl bg-muted/20 p-2"><RefreshCw className="h-4 w-4"/></button></div>
    <div className="rounded-2xl bg-muted/20 p-3 text-xs font-bold text-muted-foreground">{status}</div>

    <div className="space-y-2.5">
      {faqs.map(([q,a])=><details key={q} className="group overflow-hidden rounded-2xl" style={{background:"oklch(0.13 0.032 258)",border:"1px solid oklch(0.19 0.036 260)"}}><summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5"><span className="text-sm font-semibold text-foreground">{q}</span><ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90"/></summary><div className="px-4 pb-4 text-sm text-muted-foreground">{a}</div></details>)}
    </div>

    <div className="space-y-3 rounded-2xl p-4" style={{background:"oklch(0.13 0.032 258)",border:"1px solid oklch(0.19 0.036 260)"}}>
      <input value={pickupId} onChange={e=>setPickupId(e.target.value)} placeholder="Pickup / Delivery Way ID" className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm"/>
      <div className="grid grid-cols-2 gap-3">
        <select value={ticketType} onChange={e=>setTicketType(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-3 text-sm"><option value="delivery_issue">Delivery Issue</option><option value="pickup_issue">Pickup Issue</option><option value="cod_issue">COD Issue</option><option value="emergency">Emergency</option><option value="app_error">App Error</option></select>
        <select value={priority} onChange={e=>setPriority(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-3 text-sm"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select>
      </div>
      <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Subject" className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm"/>
      <textarea value={message} onChange={e=>setMessage(e.target.value)} rows={4} placeholder="Describe the issue..." className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm"/>
      <button onClick={handleSend} disabled={sending} className="w-full rounded-2xl py-3 text-sm font-black uppercase disabled:opacity-50" style={{background:"oklch(0.83 0.175 96)",color:"oklch(0.09 0.028 256)"}}>{sending?"Sending...":"Send to Enterprise CS / Operations"}</button>
    </div>

    <section className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">My recent tickets</p>
      {tickets.slice(0,10).map(t=><div key={t.id} className="rounded-xl bg-muted/20 px-4 py-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-foreground">{t.subject||t.ticket_type}</p><span className="text-[10px] font-black uppercase text-muted-foreground">{t.status||"OPEN"}</span></div><p className="mt-1 text-xs text-muted-foreground">{t.pickup_id||""}</p></div>)}
    </section>
  </div>;
}
