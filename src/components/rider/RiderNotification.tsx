import { BellRing, ChevronRight, X } from "lucide-react";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { riderFeedback } from "@/lib/riderFeedback";

export function RiderNotification({
  title,
  message,
  actionLabel,
  onAction,
  onClose,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
}) {
  useEffect(() => { riderFeedback("dispatch"); }, [title, message]);

  return (
    <motion.div initial={{ opacity: 0, y: -22, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: .98 }} transition={{ type: "spring", stiffness: 420, damping: 28 }} className="fixed left-3 right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[90] mx-auto max-w-md">
      <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-4 text-white shadow-[0_28px_75px_rgba(2,6,23,.42)] backdrop-blur-2xl"><div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-400/10 blur-2xl" />
        <div className="flex gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10">
            <BellRing className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-black">{title}</p>
            <p className="mt-1 text-sm leading-5 text-slate-300">{message}</p>
            {actionLabel && (
              <button
                type="button"
                onClick={onAction}
                className="v142-button-sheen v142-jelly mt-3 flex min-h-11 items-center gap-1 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f4d66d] px-4 text-sm font-black text-slate-950"
              >
                {actionLabel}
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/10">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
