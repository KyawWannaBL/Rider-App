import React from "react";
import { motion } from "framer-motion";
import { riderFeedback } from "@/lib/riderFeedback";
import { AlertCircle, Check, Loader2, WifiOff, X } from "lucide-react";
import type { NetworkState } from "@/types/rider";

export function MobileCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={["rounded-[26px] border border-slate-200/80 bg-white shadow-[0_14px_36px_rgba(15,23,42,.07)]", className].join(" ")}>{children}</div>;
}

export function PrimaryButton({
  children,
  loading,
  disabled,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 500, damping: 26 }}
      disabled={disabled || loading}
      onClick={() => { riderFeedback("success"); onClick?.(); }}
      className={[
        "min-h-14 w-full rounded-2xl px-5",
        "flex items-center justify-center gap-2",
        "v142-button-sheen text-base font-black bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white shadow-[0_14px_32px_rgba(15,23,42,.18)]",
        "active:scale-[0.98] transition disabled:cursor-not-allowed disabled:bg-slate-300",
        className,
      ].join(" ")}
    >
      {loading && <Loader2 className="h-5 w-5 animate-spin" />}
      {children}
    </motion.button>
  );
}

export function NetworkToast({
  state,
  message,
  onClose,
}: {
  state: NetworkState;
  message: string;
  onClose?: () => void;
}) {
  if (state === "idle") return null;

  const icon = {
    loading: <Loader2 className="h-5 w-5 animate-spin" />,
    success: <Check className="h-5 w-5" />,
    error: <AlertCircle className="h-5 w-5" />,
    offline: <WifiOff className="h-5 w-5" />,
    idle: null,
  }[state];

  return (
    <div className="fixed left-4 right-4 top-4 z-[100] mx-auto max-w-md">
      <div className="flex min-h-14 items-center gap-3 rounded-[22px] border border-white/10 bg-slate-950/95 px-4 py-3 text-white shadow-[0_20px_55px_rgba(2,6,23,.30)] backdrop-blur-xl">
        {icon}
        <span className="flex-1 text-sm font-semibold">{message}</span>
        {onClose && (
          <button type="button" className="grid h-10 w-10 place-items-center rounded-full" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
