import { MapPin, Navigation, Phone, ScanLine, WalletCards } from "lucide-react";
import SwipeConfirmAction from "@/components/rider/SwipeConfirmAction";

export default function RiderTaskBottomSheet({ task, onNavigate, onCall, onScan, onConfirmDelivered, onFailed }: { task: any; onNavigate?: () => void; onCall?: () => void; onScan?: () => void; onConfirmDelivered?: () => void | Promise<void>; onFailed?: () => void | Promise<void> }) {
  return (
    <section className="fixed inset-x-0 bottom-0 z-30 rounded-t-[2rem] border-t border-white/20 bg-slate-950 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-white shadow-2xl">
      <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/25" />
      <div className="flex items-start justify-between gap-4">
        <div><p className="font-mono text-sm font-black text-cyan-300">{task?.waybill_no || task?.pickup_id || "NO-WAY"}</p><h2 className="mt-1 text-2xl font-black">{task?.recipient_name || task?.customer_name || "Customer"}</h2><p className="mt-1 flex items-start gap-2 text-sm font-semibold text-slate-300"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />{task?.delivery_address || task?.address || "No address"}</p></div>
        <div className="rounded-2xl bg-amber-300 px-3 py-2 text-right text-slate-950"><p className="text-[10px] font-black uppercase">COD</p><p className="text-lg font-black">{Number(task?.cod_amount || 0).toLocaleString()}</p></div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        <button onClick={onNavigate} className="be-rider-tap rounded-2xl bg-white/10 p-3 font-black"><Navigation className="mx-auto h-6 w-6" /><span className="mt-1 block text-xs">Map</span></button>
        <button onClick={onCall} className="be-rider-tap rounded-2xl bg-white/10 p-3 font-black"><Phone className="mx-auto h-6 w-6" /><span className="mt-1 block text-xs">Call</span></button>
        <button onClick={onScan} className="be-rider-tap rounded-2xl bg-white/10 p-3 font-black"><ScanLine className="mx-auto h-6 w-6" /><span className="mt-1 block text-xs">Scan</span></button>
        <button className="be-rider-tap rounded-2xl bg-white/10 p-3 font-black"><WalletCards className="mx-auto h-6 w-6" /><span className="mt-1 block text-xs">COD</span></button>
      </div>
      <div className="mt-4 space-y-3">
        <SwipeConfirmAction label="Swipe to confirm delivered" confirmedLabel="Delivered" tone="emerald" onConfirm={onConfirmDelivered || (() => {})} />
        <SwipeConfirmAction label="Swipe to mark failed delivery" confirmedLabel="Failed marked" tone="rose" onConfirm={onFailed || (() => {})} />
      </div>
    </section>
  );
}
