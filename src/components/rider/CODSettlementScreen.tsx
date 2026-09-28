import { Banknote, CheckCircle2, ChevronRight, CircleDollarSign, ReceiptText, ShieldCheck, TriangleAlert, WalletCards } from "lucide-react";
import type { Settlement, SettlementLine } from "@/types/rider";
import { MobileCard } from "@/components/rider/MobileUI";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

export function CODSettlementScreen({
  settlement,
  onSelectLine,
}: {
  settlement: Settlement;
  onSelectLine?: (line: SettlementLine) => void;
}) {
  const balanced = Math.abs(settlement.summary.totalVariance) < 0.01;

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-5 text-white shadow-[0_22px_60px_rgba(15,23,42,.22)]">
        <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-cyan-400/10 blur-2xl" /><div className="absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-blue-500/10 blur-2xl" /><div className="relative flex items-center gap-2 text-slate-300">
          <WalletCards className="h-5 w-5" />
          <span className="text-sm font-semibold">Cash to Deposit</span>
        </div>
        <div className="relative mt-3">
          <span className="text-4xl font-black tracking-tight">{money(settlement.summary.cashToDeposit)}</span>
          <span className="ml-2 text-sm font-bold text-slate-300">MMK</span>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-2">
          <DarkMetric label="Delivered" value={String(settlement.summary.deliveredCount)} />
          <DarkMetric label="Collected" value={`${money(settlement.summary.collectedCod)} MMK`} />
        </div>
      </section>

      <MobileCard className="border-0 p-4 shadow-[0_14px_36px_rgba(15,23,42,.07)]">
        <div className="flex items-center gap-3">
          <div className={["grid h-12 w-12 place-items-center rounded-full", balanced ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"].join(" ")}>
            {balanced ? <ShieldCheck className="h-6 w-6" /> : <TriangleAlert className="h-6 w-6" />}
          </div>
          <div className="flex-1">
            <p className="font-black">{balanced ? "Settlement Balanced" : "Variance Detected"}</p>
            <p className="text-sm text-slate-500">
              {balanced ? "Expected and collected COD match." : `${money(settlement.summary.totalVariance)} MMK requires Finance review.`}
            </p>
          </div>
        </div>
      </MobileCard>

      <MobileCard className="overflow-hidden border-0 shadow-[0_14px_36px_rgba(15,23,42,.07)]">
        <div className="border-b border-slate-200 p-4">
          <h2 className="font-black">Daily Summary</h2>
        </div>
        <div className="divide-y divide-slate-200">
          <SummaryRow icon={<CircleDollarSign className="h-5 w-5" />} label="Expected COD" value={`${money(settlement.summary.expectedCod)} MMK`} />
          <SummaryRow icon={<Banknote className="h-5 w-5" />} label="Collected COD" value={`${money(settlement.summary.collectedCod)} MMK`} />
          <SummaryRow icon={<ReceiptText className="h-5 w-5" />} label="Delivery Fees" value={`${money(settlement.summary.deliveryFees)} MMK`} />
          <SummaryRow icon={<CheckCircle2 className="h-5 w-5" />} label="Rider Commission" value={`${money(settlement.summary.riderCommission)} MMK`} />
        </div>
      </MobileCard>

      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="font-black">Collection Ledger</h2>
          <span className="text-sm font-semibold text-slate-500">{settlement.lines.length} ways</span>
        </div>
        <div className="space-y-2">
          {settlement.lines.map((line) => (
            <button
              type="button"
              key={line.id}
              onClick={() => onSelectLine?.(line)}
              className="w-full rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-[0_10px_28px_rgba(15,23,42,.05)] transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className={["grid h-11 w-11 place-items-center rounded-xl", Math.abs(line.variance) < 0.01 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"].join(" ")}>
                  <Banknote className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{line.deliveryWayId}</p>
                  <p className="mt-0.5 text-xs text-slate-500">Expected {money(line.expectedCod)} MMK</p>
                </div>
                <div className="text-right">
                  <p className="font-black">{money(line.collectedCod)}</p>
                  <p className={["text-xs font-semibold", Math.abs(line.variance) < 0.01 ? "text-emerald-700" : "text-red-600"].join(" ")}>
                    {Math.abs(line.variance) < 0.01 ? "Balanced" : `${money(line.variance)} variance`}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-h-16 items-center gap-3 px-4">
      <div className="text-slate-500">{icon}</div>
      <span className="flex-1 text-sm text-slate-600">{label}</span>
      <strong className="text-sm">{value}</strong>
    </div>
  );
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <p className="text-xs text-slate-300">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}
