import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function FinishAssignmentsButton({ onFinished }: { onFinished?: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function finish() {
    setBusy(true);
    setMessage("");
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

      setMessage("Assignments finished. Your status is now AVAILABLE for new jobs.");
      await onFinished?.();
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
      {message && <div className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-700">{message}</div>}
    </section>
  );
}
