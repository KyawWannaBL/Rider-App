import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

export function FinishAssignmentsButton({ onFinished }: { onFinished?: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmedWorker, setConfirmedWorker] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [blockedWays, setBlockedWays] = useState<string[]>([]);


  async function finish() {
    setBusy(true);
    setMessage("");
    setConfirmedWorker("");
    try {
      const { data, error } = await (supabase as any).rpc("be_field_finish_assignments_v196");
      if (error) throw error;

      if (data?.ok === false) {
        const blocked = Array.isArray(data?.blocked_wayplans) ? data.blocked_wayplans : [];
        const detail = blocked
          .map((row: any) => `${row.wayplan_id}: ${row.open_stops} unfinished stop(s)`)
          .join(", ");
        setMessage(detail || data?.message || "Some assignments are still unfinished.");
        setBlockedWays(blocked.map((row: any) => String(row.wayplan_id || "")).filter(Boolean));
        return;
      }

      // A successful RPC alone is insufficient: the returned workforce status
      // must be AVAILABLE before we tell the user they can accept more work.
      const availability = String(data?.availability || "").toUpperCase();
      if (availability !== "AVAILABLE") {
        setMessage(`Finish returned ${availability || "no availability status"}. Refresh and check remaining assignments before taking another job.`);
        await onFinished?.();
        return;
      }
      // Confirm that the workforce status was actually persisted.
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user?.id) throw new Error("Session expired during workforce verification.");
      const { data: worker, error: readError } = await (supabase as any)
        .from("be_mobile_workforce_accounts")
        .select("metadata")
        .eq("auth_user_id", auth.user.id)
        .maybeSingle();
      if (readError) throw readError;
      if (!worker) throw new Error("Unable to verify your workforce record.");
      const persisted = String(worker.metadata?.assignment_availability || "").toUpperCase();
      if (persisted !== "AVAILABLE") {
        setMessage("Completion response was AVAILABLE, but saved workforce status is " + (persisted || "UNKNOWN") + ". Ask Operations to review active wayplans.");
        await onFinished?.();
        return;
      }
      await onFinished?.();
      setConfirmedWorker(String(data?.worker_code || "Worker"));
      setMessage(`Assignments finished. Workforce ${data?.worker_code || ""} is AVAILABLE for new jobs. If another screen still shows BUSY, refresh its workforce list.`);
    } catch (error: any) {
      setMessage(error?.message || "Unable to finish assignments.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPreparedHelperStops() {
    if (busy || reviewBusy) return;
    setReviewBusy(true);
    setReviewMessage("");
    try {
      // List is scoped to the logged-in field worker by the server RPC.
      const {data,error} = await (supabase as any).rpc("be_rider_delivery_wayplan_jobs_v187",{
        p_rider_code:null,p_limit:500
      });
      if(error || data?.ok===false) throw new Error(error?.message||data?.error||"Unable to load assigned deliveries.");
      const identityRole=String(data?.identity?.role||"").toLowerCase();
      if(identityRole!=="driver") throw new Error("Only the assigned Driver can confirm Helper-completed stops.");
      const jobs=Array.isArray(data?.jobs)?data.jobs:[];
      const pending=jobs.filter((job:any)=>String(job.rider_status||"").toUpperCase()==="HELPER_COMPLETED_PENDING_DRIVER"
        && job.wayplan_id && job.delivery_way_id);
      if(!pending.length) {
        setReviewMessage("No Helper-completed stops are ready for Driver confirmation. Other arrived or unresolved parcels must be completed individually.");
        return;
      }
      if(!window.confirm(`Confirm ${pending.length} Helper-prepared deliveries? Each stop will be validated independently by the server. No payment will be collected again.`)) return;
      let confirmed=0;
      const failures:string[]=[];
      for(const job of pending) {
        try {
          const {data:result,error:actionError}=await (supabase as any).rpc("be_driver_confirm_team_delivery_v176",{
            p_payload:{wayplan_id:job.wayplan_id,delivery_way_id:job.delivery_way_id}
          });
          if(actionError || result?.ok!==true || String(result?.mobile_status||"").toUpperCase()!=="DELIVERED") {
            throw new Error(actionError?.message||result?.message||result?.error||"Server did not confirm delivered.");
          }
          confirmed++;
        } catch(error:any) {
          failures.push(`${job.delivery_way_id}: ${error?.message||"Not confirmed"}`);
        }
      }
      setReviewMessage(`Driver confirmed ${confirmed} of ${pending.length} Helper-prepared deliveries. ${failures.length ? "Pending review: "+failures.join("; ") : "All prepared stops confirmed."} Use Finish Assignments again to check remaining stops.`);
      await onFinished?.();
    } catch(error:any) {
      setReviewMessage(error?.message||"Driver review could not complete.");
    } finally {
      setReviewBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            <h2 className="text-lg font-black text-slate-950">Finish Assignments / တာဝန်ပြီးဆုံး</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Use this after every assigned delivery stop is completed. Your status will change from BUSY to AVAILABLE so Operations can assign new work.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void finish()}
          disabled={busy}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black uppercase text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Finish Assignments
        </button>
      </div>
      {confirmedWorker && (
        <div role="status" aria-live="assertive" className="mt-4 rounded-2xl border-2 border-emerald-600 bg-emerald-100 p-5 text-center shadow-lg">
          <div className="flex items-center justify-center gap-2 text-2xl font-black text-emerald-900"><CheckCircle2 className="h-8 w-8" /> AVAILABLE / တာဝန်အသစ်လက်ခံနိုင်ပါပြီ</div>
          <div className="mt-2 text-lg font-bold text-emerald-900">{confirmedWorker}: BUSY → AVAILABLE</div>
          <p className="mt-1 text-sm font-semibold text-emerald-800">Confirmed by workforce system. Ready for new assignments.</p>
        </div>
      )}
      {message && !confirmedWorker && <div role="alert" aria-live="assertive" className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-700">{message}</div>}
      {message && !confirmedWorker && (
        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <p className="text-sm font-bold text-indigo-950">Helper-prepared deliveries can be confirmed by the assigned Driver without taking payment or uploading proof a second time. Arrived-at-customer parcels without Helper preparation still need their own confirmation.</p>
          {blockedWays.length>0 && <p className="mt-2 break-words text-xs text-indigo-900">Wayplans to review: {blockedWays.join(", ")}</p>}
          <button type="button" disabled={busy||reviewBusy} onClick={()=>void confirmPreparedHelperStops()} className="mt-3 min-h-12 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-black text-white disabled:opacity-60">
            {reviewBusy?"Reviewing…":"Driver: Confirm Helper-Prepared Deliveries"}
          </button>
          {reviewMessage && <p role="status" className="mt-2 break-words text-sm font-bold text-indigo-950">{reviewMessage}</p>}
        </div>
      )}
      {message && !confirmedWorker && <Link to="/delivery" className="mt-3 inline-flex rounded-xl bg-indigo-700 px-4 py-3 text-sm font-black text-white">Open Delivery — Review &amp; Confirm Pending Stops / ပို့ဆောင်မှု အတည်ပြုရန်</Link>}
    </section>
  );
}
