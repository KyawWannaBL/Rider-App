import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BellRing, CheckCircle2, Loader2, TriangleAlert, XCircle } from "lucide-react";
import clsx from "clsx";

export function V142Page({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function V142GlassCard({
  children,
  className = "",
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  const classes = clsx(
    "relative overflow-hidden rounded-[28px] border border-white/10",
    "bg-white/[0.055] shadow-[0_20px_55px_rgba(2,6,23,.26)] backdrop-blur-xl",
    interactive && "transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.075]",
    className,
  );

  if (!interactive) return <div className={classes}>{children}</div>;

  return (
    <motion.div whileTap={{ scale: 0.985 }} className={classes}>
      {children}
    </motion.div>
  );
}

export function V142ActionButton({
  children,
  icon,
  loading,
  disabled,
  onClick,
  variant = "gold",
  className = "",
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  variant?: "gold" | "cyan" | "success" | "danger" | "ghost";
  className?: string;
}) {
  const variants = {
    gold: "bg-gradient-to-r from-[#d4af37] via-[#f4d66d] to-[#d4af37] text-slate-950 shadow-[0_14px_36px_rgba(212,175,55,.20)]",
    cyan: "bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-[0_14px_36px_rgba(34,211,238,.18)]",
    success: "bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-[0_14px_36px_rgba(16,185,129,.18)]",
    danger: "bg-gradient-to-r from-rose-600 to-red-500 text-white shadow-[0_14px_36px_rgba(239,68,68,.18)]",
    ghost: "border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]",
  };

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 480, damping: 26 }}
      disabled={disabled || loading}
      onClick={onClick}
      className={clsx(
        "relative min-h-14 overflow-hidden rounded-2xl px-5 font-black tracking-wide",
        "inline-flex items-center justify-center gap-2 transition-[filter,opacity] duration-200",
        "disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 hover:translate-x-full" />
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}

export function V142Toast({
  show,
  type,
  title,
  message,
}: {
  show: boolean;
  type: "success" | "warning" | "error" | "info";
  title: string;
  message: string;
}) {
  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-300" />,
    warning: <TriangleAlert className="h-5 w-5 text-amber-300" />,
    error: <XCircle className="h-5 w-5 text-rose-300" />,
    info: <BellRing className="h-5 w-5 text-cyan-300" />,
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          className="fixed left-3 right-3 top-[max(.75rem,env(safe-area-inset-top))] z-[120] mx-auto max-w-md"
        >
          <div className="rounded-[24px] border border-white/10 bg-slate-950/94 p-4 text-white shadow-[0_26px_70px_rgba(2,6,23,.42)] backdrop-blur-2xl">
            <div className="flex gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/8">{icons[type]}</div>
              <div className="min-w-0 flex-1">
                <p className="font-black">{title}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-slate-300">{message}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function V142Skeleton({ className = "" }: { className?: string }) {
  return <div className={clsx("v142-shimmer rounded-2xl bg-white/8", className)} />;
}
