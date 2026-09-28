// Compatibility contract: be_rider_delivery_wayplan_jobs · be_current_field_team_identity · be_rider_submit_cod_settlement.
// Runtime settlement uses the stricter be_field_team_cod_handover_queue_v1 / be_field_team_cod_handover_submit_v1 service layer.
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, UploadCloud } from "lucide-react";
import { CODSettlementScreen } from "@/components/rider/CODSettlementScreen";
import { RiderNotification } from "@/components/rider/RiderNotification";
import { loadRiderSettlement, submitCodHandover } from "@/lib/riderOperations";
import { useRiderRealtime } from "@/hooks/useRiderRealtime";
import type { Settlement, SettlementLine } from "@/types/rider";
import { useAppState } from "@/hooks/useAppState";

export default function CodSettlementPage() {
  const { language } = useAppState();
  const tx = (en: string, my: string) => (language === "my" ? my : en);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [selectedLine, setSelectedLine] = useState<SettlementLine | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [proof, setProof] = useState({ name: "", dataUrl: "" });
  const [note, setNote] = useState("");
  const [notification, setNotification] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadRiderSettlement();
      setSettlement(next.settlement);
      setRows(next.rawRows);
      setSelectedLine((current) => {
        if (!current) return null;
        return next.settlement.lines.find((line) => line.id === current.id) || null;
      });
      setMessage(
        tx(
          `Synchronized ${next.settlement.lines.length} delivered COD record(s).`,
          `ပို့ဆောင်ပြီး COD မှတ်တမ်း ${next.settlement.lines.length} ခု ချိတ်ဆက်ပြီးပါပြီ။`,
        ),
      );
    } catch (error: any) {
      setMessage(error?.message || tx("Unable to load COD settlement.", "COD စာရင်းရှင်းတမ်း ဖွင့်၍မရပါ။"));
    } finally {
      setLoading(false);
    }
  }, [tx]);

  useEffect(() => {
    void load();
  }, [load]);

  useRiderRealtime({
    onSettlementChange: load,
    onNotification: (payload) => setNotification(payload),
  });

  const rawSelected = useMemo(
    () => rows.find((row) => String(row?.delivery_way_id || "") === selectedLine?.deliveryWayId) || null,
    [rows, selectedLine],
  );

  const status = String(rawSelected?.cod_settlement_status || "PENDING_HANDOVER").toUpperCase();
  const cleared = ["CLEARED", "SETTLED", "FINANCE_SETTLED"].includes(status);
  const submitted = ["SUBMITTED_TO_FINANCE", "PENDING_FINANCE"].includes(status);

  function selectFile(file?: File) {
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setMessage(tx("Proof photo must be 6 MB or less.", "သက်သေဓာတ်ပုံသည် 6 MB ထက်မကျော်ရပါ။"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProof({ name: file.name, dataUrl: String(reader.result || "") });
    reader.readAsDataURL(file);
  }

  async function submitSelected() {
    if (!selectedLine || !rawSelected) return;
    if (cleared) {
      setMessage(tx("This settlement is already cleared.", "ဤ COD စာရင်းရှင်းတမ်းကို Cleared ပြုလုပ်ပြီးပါပြီ။"));
      return;
    }

    setLoading(true);
    try {
      const result = await submitCodHandover(selectedLine.deliveryWayId, {
        proofPhotoName: proof.name || undefined,
        proofDataUrl: proof.dataUrl || undefined,
        note: note.trim() || undefined,
      });

      setMessage(
        tx(
          `${selectedLine.deliveryWayId}: submitted to Finance. Reference ${result?.settlement_reference || "-"}.`,
          `${selectedLine.deliveryWayId}: Finance သို့ လွှဲပြောင်းတင်သွင်းပြီးပါပြီ။ Reference ${result?.settlement_reference || "-"}။`,
        ),
      );
      setProof({ name: "", dataUrl: "" });
      setNote("");
      setSelectedLine(null);
      await load();
    } catch (error: any) {
      setMessage(error?.message || tx("COD handover failed.", "COD လွှဲပြောင်းမှု မအောင်မြင်ပါ။"));
    } finally {
      setLoading(false);
    }
  }

  if (loading && !settlement) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-slate-100">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-700" />
          <p className="mt-3 font-black text-slate-700">{tx("Loading COD ledger...", "COD စာရင်းကို ဖွင့်နေသည်...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 pb-10 sm:p-6">
      {notification && (
        <RiderNotification
          title={String(notification.title || tx("Settlement update", "COD စာရင်းအသိပေးချက်"))}
          message={String(notification.message || notification.body || tx("Finance status changed.", "Finance အခြေအနေ ပြောင်းလဲထားပါသည်။"))}
          actionLabel={tx("Refresh", "ပြန်ဖွင့်ရန်")}
          onAction={() => {
            setNotification(null);
            void load();
          }}
          onClose={() => setNotification(null)}
        />
      )}

      <div className="mx-auto max-w-2xl space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-700">BRITIUM EXPRESS</p>
              <h1 className="mt-2 text-2xl font-black text-slate-950">{tx("COD Settlement", "COD ငွေစာရင်းရှင်းခြင်း")}</h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                {tx(
                  "Expected COD is server-authoritative and read-only. Rider only submits the actual Finance handover.",
                  "ရရှိရမည့် COD တန်ဖိုးကို Backend မှ အတည်ပြုထားပြီး Rider မှ ပြင်ဆင်၍မရပါ။ Rider သည် Finance လွှဲပြောင်းမှုကိုသာ တင်သွင်းပါသည်။",
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white"
            >
              <RefreshCw className={["h-5 w-5", loading ? "animate-spin" : ""].join(" ")} />
            </button>
          </div>
          {message && <div className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-900">{message}</div>}
        </section>

        {settlement && <CODSettlementScreen settlement={settlement} onSelectLine={setSelectedLine} />}

        {selectedLine && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-black text-blue-700">{selectedLine.deliveryWayId}</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">{tx("Finance Handover", "Finance သို့ COD လွှဲပြောင်းခြင်း")}</h2>
              </div>
              <span className={[
                "rounded-full px-3 py-2 text-xs font-black",
                cleared ? "bg-emerald-100 text-emerald-800" : submitted ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800",
              ].join(" ")}>{status}</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black text-slate-500">{tx("Expected COD", "ရရှိရမည့် COD")}</p>
                <p className="mt-2 text-lg font-black">{selectedLine.expectedCod.toLocaleString()} MMK</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black text-slate-500">{tx("Collected COD", "ကောက်ခံပြီး COD")}</p>
                <p className="mt-2 text-lg font-black">{selectedLine.collectedCod.toLocaleString()} MMK</p>
              </div>
            </div>

            {!cleared && !submitted && (
              <>
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-4">
                  <label className="flex cursor-pointer items-center gap-3 font-black text-slate-700">
                    <UploadCloud className="h-5 w-5" />
                    {tx("Attach handover proof (optional)", "ငွေလွှဲပြောင်းသက်သေဓာတ်ပုံ ထည့်ရန် (မလိုအပ်လျှင်ကျော်နိုင်)")}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => selectFile(event.target.files?.[0])}
                    className="mt-3 w-full rounded-xl border border-slate-200 p-3"
                  />
                  {proof.dataUrl && <img src={proof.dataUrl} alt="COD handover proof" className="mt-3 h-44 w-full rounded-2xl object-cover" />}
                </div>

                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={tx("Handover note (optional)", "လွှဲပြောင်းမှတ်ချက် (မလိုအပ်လျှင်ကျော်နိုင်)")}
                  className="mt-4 min-h-[96px] w-full rounded-2xl border border-slate-200 p-4 font-semibold outline-none focus:border-blue-500"
                />

                <button
                  type="button"
                  onClick={() => void submitSelected()}
                  disabled={loading || !rawSelected?.eligible_to_handover}
                  className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 font-black text-white disabled:opacity-40"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  {tx("Submit COD Handover to Finance", "COD ကို Finance သို့ လွှဲပြောင်းတင်သွင်းမည်")}
                </button>
              </>
            )}

            {submitted && (
              <div className="mt-4 rounded-2xl bg-blue-50 p-4 font-black text-blue-800">
                {tx("Submitted to Finance and waiting for verification.", "Finance သို့ တင်သွင်းပြီး စစ်ဆေးအတည်ပြုရန် စောင့်နေပါသည်။")}
              </div>
            )}

            {cleared && (
              <div className="mt-4 rounded-2xl bg-emerald-50 p-4 font-black text-emerald-800">
                {tx("Finance settlement cleared.", "Finance စာရင်းရှင်းတမ်း Cleared ဖြစ်ပြီးပါပြီ။")}
              </div>
            )}

            <button
              type="button"
              onClick={() => setSelectedLine(null)}
              className="mt-3 min-h-12 w-full rounded-2xl border border-slate-200 bg-white font-black text-slate-700"
            >
              {tx("Close", "ပိတ်ရန်")}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
