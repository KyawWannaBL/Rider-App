import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function FinishAssignmentsButton({ onFinished }: { onFinished?: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmedWorker, setConfirmedWorker] = useState("");

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
    </section>
  );
}
