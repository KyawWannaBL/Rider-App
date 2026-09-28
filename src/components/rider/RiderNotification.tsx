import { BellRing, ChevronRight, X } from "lucide-react";

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
  return (
    <div className="fixed left-3 right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[90] mx-auto max-w-md">
      <div className="rounded-2xl bg-slate-950 p-4 text-white shadow-2xl">
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
                className="mt-3 flex min-h-11 items-center gap-1 rounded-xl bg-white px-4 text-sm font-black text-slate-950"
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
    </div>
  );
}
