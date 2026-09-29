import { Barcode, ChevronRight, MapPin, MessageCircle, Navigation, Package, Phone, Route, UserRound } from "lucide-react";
import type { Dispatch, Waybill } from "@/types/rider";
import { MobileCard, PrimaryButton } from "@/components/rider/MobileUI";
import { DropoffPinEditor } from "@/components/rider/DropoffPinEditor";
import { InteractivePinMap } from "@/components/rider/InteractivePinMap";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

export function ActiveRouteScreen({
  dispatch,
  waybill,
  onNavigate,
  onOpenDelivery,
  onPinSaved,
}: {
  dispatch: Dispatch;
  waybill: Waybill;
  onNavigate: (waybill: Waybill) => void;
  onOpenDelivery: (waybill: Waybill) => void;
  onPinSaved?: () => void;
}) {
  const stop = dispatch.stops.find((item) => item.waybillId === waybill.id);
  const arrived = ["ARRIVED", "DELIVERED"].includes(waybill.status);
  const loc = waybill.customer.location;
  return (
    <div className="be-page min-h-dvh pb-28">
      <section className="relative h-[40vh] min-h-[320px] overflow-hidden bg-gradient-to-br from-slate-950 via-slate-800 to-blue-900">
        {loc?.latitude && loc?.longitude ? (
          <InteractivePinMap
            point={{ latitude: loc.latitude, longitude: loc.longitude }}
            interactive={false}
            className="absolute inset-0"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-slate-950 via-slate-800 to-blue-900 text-center text-white">
            <div className="px-8">
              <MapPin className="mx-auto h-12 w-12 text-cyan-300" />
              <p className="mt-3 text-lg font-black">Precise drop-off pin is not set</p>
              <p className="mt-2 text-sm font-semibold text-slate-300">Use the pin editor below to save the exact entrance or handover point.</p>
            </div>
          </div>
        )}

        <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
          <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white shadow-xl backdrop-blur-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">Active Route</p>
            <p className="mt-1 font-mono text-sm font-black">{dispatch.dispatchNo}</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/95 px-4 py-3 text-sm font-black text-slate-950 shadow-xl backdrop-blur-xl">
            Stop #{stop?.sequence || waybill.sequenceNo || "-"}
          </div>
        </div>

        <div className="absolute inset-x-4 bottom-4">
          <MobileCard className="be-surface p-3 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-700 text-white">
                <Route className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-500">Next destination</p>
                <p className="truncate text-sm font-black text-slate-950">{waybill.customer.address || waybill.customer.township || "-"}</p>
              </div>
              <MapPin className="h-5 w-5 text-blue-700" />
            </div>
          </MobileCard>
        </div>
      </section>

      <main className="mx-auto max-w-lg space-y-3 p-4">
        <DropoffPinEditor waybill={waybill} onSaved={() => onPinSaved?.()} />
        <MobileCard className="overflow-hidden border-0 shadow-[0_16px_42px_rgba(15,23,42,.08)]">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-100">
                <UserRound className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-black text-slate-950">{waybill.customer.name}</h2>
                <p className="mt-1 text-sm font-semibold leading-5 text-slate-600">
                  {[waybill.customer.address, waybill.customer.township].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 border-t border-slate-200">
            <a
              href={waybill.customer.phone ? `tel:${waybill.customer.phone}` : undefined}
              className="flex min-h-14 items-center justify-center gap-2 border-r border-slate-200 font-black active:bg-slate-100"
            >
              <Phone className="h-5 w-5" /> Call
            </a>
            <a
              href={waybill.customer.phone ? `sms:${waybill.customer.phone}` : undefined}
              className="flex min-h-14 items-center justify-center gap-2 font-black active:bg-slate-100"
            >
              <MessageCircle className="h-5 w-5" /> Message
            </a>
          </div>
        </MobileCard>

        <div className="grid grid-cols-2 gap-3">
          <MobileCard className="p-4">
            <Package className="h-5 w-5 text-slate-500" />
            <p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-500">Way ID</p>
            <p className="mt-1 truncate font-mono text-sm font-black text-blue-700">{waybill.deliveryWayId}</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">{waybill.weightKg || 0} KG · {waybill.parcelCount} parcel</p>
          </MobileCard>

          <MobileCard className="p-4">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">Expected Collection</p>
            <p className="mt-3 text-2xl font-black text-slate-950">{money(waybill.tariff.expectedCod)}</p>
            <p className="text-xs font-black text-slate-500">MMK · {waybill.paymentType}</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Fee {money(waybill.tariff.totalDeliveryFee)} MMK
            </p>
          </MobileCard>
        </div>

        <MobileCard className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Delivery State</p>
              <p className="mt-1 text-lg font-black text-slate-950">{waybill.status.replaceAll("_", " ")}</p>
            </div>
            <div className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-blue-800">
              Attempt {waybill.deliveryAttemptCount}/{waybill.maximumDeliveryAttempts || 3}
            </div>
          </div>
        </MobileCard>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/60 bg-white/92 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-18px_50px_rgba(15,23,42,.12)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-lg gap-2">
          <button
            type="button"
            onClick={() => onOpenDelivery(waybill)}
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-950 active:scale-95"
            title="Scan / delivery verification"
          >
            <Barcode className="h-6 w-6" />
          </button>

          {!arrived ? (
            <PrimaryButton onClick={() => onNavigate(waybill)}>
              <Navigation className="h-5 w-5" />
              Start Navigation
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => onOpenDelivery(waybill)}>
              ပို့ဆောင်ပြီး / Deliver
              <ChevronRight className="h-5 w-5" />
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}
