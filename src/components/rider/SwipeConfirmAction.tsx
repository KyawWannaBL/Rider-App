import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { motion, useMotionValue, useTransform } from "framer-motion";

export default function SwipeConfirmAction({ label, confirmedLabel = "Confirmed", onConfirm, tone = "emerald" }: { label: string; confirmedLabel?: string; onConfirm: () => Promise<void> | void; tone?: "emerald" | "blue" | "amber" | "rose" }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const x = useMotionValue(0);
  const opacity = useTransform(x, [0, 180], [1, .25]);
  const bg = { emerald: "bg-emerald-400 text-slate-950", blue: "bg-blue-500 text-white", amber: "bg-amber-400 text-slate-950", rose: "bg-rose-500 text-white" }[tone];

  async function complete() {
    if (busy || done) return;
    setBusy(true);
    try { await onConfirm(); setDone(true); } finally { setBusy(false); }
  }

  return (
    <div className="relative h-16 overflow-hidden rounded-[1.35rem] bg-white/10 p-1.5 ring-1 ring-white/10">
      <motion.div style={{ opacity }} className="absolute inset-0 grid place-items-center text-base font-black text-white">{done ? confirmedLabel : busy ? "Saving..." : label}</motion.div>
      <motion.button type="button" disabled={busy || done} drag="x" dragConstraints={{ left: 0, right: 220 }} dragElastic={0.05} style={{ x }} onDragEnd={(_, info) => { if (info.offset.x > 150) void complete(); else x.set(0); }} className={`absolute left-1.5 top-1.5 grid h-13 w-20 place-items-center rounded-[1.1rem] ${bg} shadow-xl disabled:opacity-80`}>
        {done ? <Check className="h-7 w-7" /> : <ChevronRight className="h-8 w-8" />}
      </motion.button>
    </div>
  );
}
