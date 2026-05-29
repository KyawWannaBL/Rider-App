// @ts-nocheck
import { useState } from "react";
import { supabase } from "../integrations/supabase/client";

export default function SupportPage() {
  const [form, setForm] = useState({
    pickup_id: "",
    ticket_type: "delivery_issue",
    priority: "normal",
    subject: "",
    message: "",
  });
  const [msg, setMsg] = useState("");

  async function save() {
    const { error } = await supabase.rpc("be_rider_support_ticket_save", {
      p_payload: form,
    });

    setMsg(error ? error.message : "Support ticket submitted.");
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-3xl rounded-3xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-black">Rider Support</h1>
        <p className="font-semibold text-slate-600">
          Report emergency, delivery issue, COD issue, or app error.
        </p>

        <div className="mt-5 grid gap-3">
          <input className="rounded-2xl border p-3 font-bold" placeholder="Pickup ID" value={form.pickup_id} onChange={(e) => setForm({ ...form, pickup_id: e.target.value })} />
          <select className="rounded-2xl border p-3 font-bold" value={form.ticket_type} onChange={(e) => setForm({ ...form, ticket_type: e.target.value })}>
            <option value="delivery_issue">Delivery Issue</option>
            <option value="emergency">Emergency</option>
            <option value="cod_issue">COD Issue</option>
            <option value="app_error">App Error</option>
          </select>
          <select className="rounded-2xl border p-3 font-bold" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="normal">normal</option>
            <option value="high">high</option>
            <option value="urgent">urgent</option>
          </select>
          <input className="rounded-2xl border p-3 font-bold" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <textarea className="min-h-[140px] rounded-2xl border p-3 font-bold" placeholder="Message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        </div>

        {msg && <div className="mt-4 rounded-2xl bg-blue-50 p-3 font-bold text-blue-900">{msg}</div>}

        <button onClick={save} className="mt-5 w-full rounded-2xl bg-blue-700 p-4 font-black text-white">
          Submit Support Ticket
        </button>
      </div>
    </div>
  );
}
