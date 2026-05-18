import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Headphones,
  Loader2,
  MapPinned,
  PackageCheck,
  RefreshCw,
  Route as RouteIcon,
  Send,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { ProfileDrawer } from "@/components/ProfileDrawer";
import {
  asMoney,
  codHandover,
  loadMobileSnapshot,
  MobileJob,
  MobileMode,
  MobilePickup,
  MobileRole,
  submitSupportRequest,
  updateWaybillStatus,
  verifyPickupParcel,
} from "@/lib/mobileGoLiveApi";

const roleLabels: Record<MobileRole, string> = {
  rider: "Rider",
  driver: "Driver",
  helper: "Helper",
};

const modeTitles: Record<MobileMode, string> = {
  home: "Go-Live Dashboard",
  jobs: "Assigned Jobs",
  route: "Route Stops",
  proof: "Delivery Proof",
  cod: "COD Center",
  earnings: "Earnings",
  sync: "Enterprise Sync",
  support: "Support",
  pickup: "Field Pickup Verification",
  pickupForm: "Pickup Delivery Form",
};

function jobWayId(job: MobileJob) {
  return String(job.deliver_way_id || job.tracking_no || "").toUpperCase();
}

function pickupWayId(pickup: MobilePickup) {
  return String(pickup.pickup_way_id || pickup.pickup_id || "").toUpperCase();
}

function statusBadge(status?: string) {
  const value = String(status || "assigned");
  const good = ["delivered", "pickup_verified", "cod_handed_over", "completed"].includes(value);
  const warn = ["assigned", "draft", "pending_assignment"].includes(value);
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
        good
          ? "bg-green-100 text-green-700"
          : warn
            ? "bg-amber-100 text-amber-700"
            : "bg-blue-100 text-blue-700"
      }`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

export default function MobileGoLivePage({ role, mode }: { role: MobileRole; mode: MobileMode }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadMobileSnapshot>> | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [supportText, setSupportText] = useState("");
  const [parcelDrafts, setParcelDrafts] = useState<Record<string, { weight_kg: string; photo_url: string; note: string }>>({});

  const pickups = snapshot?.pickups || [];
  const jobs = snapshot?.jobs || [];
  const codRecords = snapshot?.cod_records || [];
  const notifications = snapshot?.notifications || [];

  const outstandingJobs = jobs.filter((j) => !["delivered", "cancelled", "archived_test_data"].includes(String(j.status || "")));
  const verifiedJobs = jobs.filter((j) => j.field_pickup_checked || j.pickup_verification_status === "verified");
  const unverifiedJobs = jobs.filter((j) => !(j.field_pickup_checked || j.pickup_verification_status === "verified"));
  const codTotal = codRecords.reduce((sum, row) => sum + Number(row.final_cod || row.cod_amount || 0), 0);
  const deliveredCount = jobs.filter((j) => j.status === "delivered").length;

  const roleTitle = `${roleLabels[role]} ${modeTitles[mode]}`;

  async function sync() {
    setLoading(true);
    setMessage(null);
    try {
      const next = await loadMobileSnapshot(role, 150);
      setSnapshot(next);

      if (next.pickups.length === 0 && next.jobs.length === 0) {
        setMessage({
          type: "error",
          text: "No Enterprise Portal assignment found. Ask Supervisor to assign a pickup to this account.",
        });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Enterprise sync failed." });
    } finally {
      setLoading(false);
    }
  }

  async function doStatus(job: MobileJob, status: string) {
    setLoading(true);
    try {
      await updateWaybillStatus(job.id, status, {
        role,
        deliver_way_id: jobWayId(job),
        pickup_id: job.pickup_id,
      });
      setMessage({ type: "success", text: `${jobWayId(job)} updated to ${status.replaceAll("_", " ")}.` });
      await sync();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Status update failed." });
    } finally {
      setLoading(false);
    }
  }

  async function doCodHandover(job: MobileJob) {
    setLoading(true);
    try {
      await codHandover(job.id, {
        role,
        deliver_way_id: jobWayId(job),
        pickup_id: job.pickup_id,
        amount: Number(job.final_cod || job.cod_amount || 0),
      });
      setMessage({ type: "success", text: `${jobWayId(job)} COD handed over.` });
      await sync();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "COD handover failed." });
    } finally {
      setLoading(false);
    }
  }

  function setDraft(job: MobileJob, patch: Partial<{ weight_kg: string; photo_url: string; note: string }>) {
    const key = jobWayId(job);
    setParcelDrafts((prev) => ({
      ...prev,
      [key]: {
        weight_kg: prev[key]?.weight_kg || String(job.weight_kg || ""),
        photo_url: prev[key]?.photo_url || String(job.field_pickup_photo_url || job.photo_url || ""),
        note: prev[key]?.note || "",
        ...patch,
      },
    }));
  }

  function readPhoto(job: MobileJob, file?: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDraft(job, { photo_url: String(reader.result || "") });
    reader.readAsDataURL(file);
  }

  async function verifyParcel(job: MobileJob) {
    const key = jobWayId(job);
    const draft = parcelDrafts[key] || { weight_kg: String(job.weight_kg || ""), photo_url: "", note: "" };

    setLoading(true);
    try {
      await verifyPickupParcel({
        pickup_id: job.pickup_id,
        deliver_way_id: key,
        weight_kg: Number(draft.weight_kg || 0),
        photo_url: draft.photo_url,
        note: draft.note,
        role,
      });

      setMessage({ type: "success", text: `${key} pickup verification synchronized to Data Entry.` });
      await sync();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Pickup verification failed." });
    } finally {
      setLoading(false);
    }
  }

  async function sendSupport() {
    if (!supportText.trim()) {
      setMessage({ type: "error", text: "Enter support message first." });
      return;
    }

    setLoading(true);
    try {
      await submitSupportRequest(role, supportText, {
        page: mode,
        workforce_code: snapshot?.workforce_code,
      });
      setSupportText("");
      setMessage({ type: "success", text: "Support request sent to Enterprise Portal." });
      await sync();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Support request failed." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  return (
    <>
      <AppShell role={role} onOpenProfile={() => setProfileOpen(true)}>
        <main className="min-h-screen bg-slate-50 p-4 pb-28">
          <section className="mb-5 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">Britium Go-Live Mobile</div>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{roleTitle}</h1>
              <p className="mt-1 text-sm text-slate-500">
                Synced with Enterprise Portal. No mock data. Pickup IDs use P0518-MEL-010 and delivery IDs use D0518-MEL-001.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void sync()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black uppercase text-white shadow-sm disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync
            </button>
          </section>

          {message && (
            <div
              className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-bold ${
                message.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"
              }`}
            >
              {message.text}
            </div>
          )}

          {mode === "home" && (
            <>
              <StatsGrid
                pickups={pickups.length}
                jobs={jobs.length}
                outstanding={outstandingJobs.length}
                cod={codTotal}
                verified={verifiedJobs.length}
              />
              <PickupList pickups={pickups} />
              <NotificationList notifications={notifications} />
            </>
          )}

          {mode === "jobs" && (
            <JobList
              jobs={jobs}
              emptyText="No delivery waybills found. Data Entry must prepare parcel rows first, then Supervisor must assign this workforce account."
              actions={(job) => (
                <>
                  <ActionButton label="Picked Up" onClick={() => doStatus(job, "picked_up")} />
                  <ActionButton label="In Transit" onClick={() => doStatus(job, "in_transit")} />
                  <ActionButton label="Delivered" onClick={() => doStatus(job, "delivered")} />
                </>
              )}
            />
          )}

          {mode === "route" && (
            <JobList
              jobs={jobs}
              emptyText="No route stops yet."
              titleIcon={<RouteIcon className="h-5 w-5 text-blue-700" />}
              actions={(job) => <ActionButton label="Reached Stop" onClick={() => doStatus(job, "reached_stop")} />}
            />
          )}

          {mode === "pickup" && (
            <JobList
              jobs={jobs}
              emptyText="No parcels to verify. Data Entry must prepare waybill rows first."
              title="Field Pickup Verification"
              titleIcon={<ClipboardCheck className="h-5 w-5 text-blue-700" />}
              renderExtra={(job) => {
                const key = jobWayId(job);
                const draft = parcelDrafts[key] || {};
                const verified = job.field_pickup_checked || job.pickup_verification_status === "verified";
                return (
                  <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-black uppercase text-slate-500">Actual Weight KG</span>
                      <input
                        type="number"
                        value={draft.weight_kg ?? job.weight_kg ?? ""}
                        onChange={(event) => setDraft(job, { weight_kg: event.target.value })}
                        className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                      />
                    </label>

                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-3">
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => readPhoto(job, event.target.files?.[0])} />
                      <Camera className={`mb-1 h-5 w-5 ${draft.photo_url || job.photo_url ? "text-green-600" : "text-slate-500"}`} />
                      <span className="text-xs font-black uppercase">{draft.photo_url || job.photo_url ? "Photo Ready" : "Capture Cargo Photo"}</span>
                    </label>

                    <div className="flex items-end">
                      <button
                        type="button"
                        disabled={loading || verified}
                        onClick={() => void verifyParcel(job)}
                        className="h-11 w-full rounded-xl bg-green-700 px-4 text-sm font-black uppercase text-white disabled:opacity-50"
                      >
                        {verified ? "Verified" : "Verify Parcel"}
                      </button>
                    </div>
                  </div>
                );
              }}
            />
          )}

          {mode === "pickupForm" && (
            <JobList
              jobs={jobs}
              title="Pickup Delivery Form"
              titleIcon={<PackageCheck className="h-5 w-5 text-blue-700" />}
              emptyText="No active pickup delivery forms."
              actions={(job) => <ActionButton label="Mark Form Checked" onClick={() => doStatus(job, "form_checked")} />}
            />
          )}

          {mode === "proof" && (
            <JobList
              jobs={jobs}
              title="Proof of Delivery"
              titleIcon={<ShieldCheck className="h-5 w-5 text-blue-700" />}
              emptyText="No waybills requiring proof."
              actions={(job) => <ActionButton label="Submit Proof" onClick={() => doStatus(job, "proof_submitted")} />}
            />
          )}

          {mode === "cod" && (
            <>
              <section className="mb-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="h-5 w-5 text-blue-700" />
                  <h2 className="text-lg font-black text-slate-950">COD Summary</h2>
                </div>
                <div className="mt-4 text-3xl font-black text-slate-950">{asMoney(codTotal)} MMK</div>
                <p className="mt-1 text-sm text-slate-500">Amount from assigned COD waybills in Enterprise Portal.</p>
              </section>

              <JobList
                jobs={codRecords}
                title="COD Records"
                emptyText="No COD records."
                actions={(job) => <ActionButton label="Hand Over COD" onClick={() => doCodHandover(job)} />}
              />
            </>
          )}

          {mode === "earnings" && (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="h-5 w-5 text-blue-700" />
                <h2 className="text-lg font-black text-slate-950">Estimated Earnings</h2>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <Metric label="Delivered Jobs" value={String(deliveredCount)} />
                <Metric label="Verified Parcels" value={String(verifiedJobs.length)} />
                <Metric label="Estimated Incentive" value={`${asMoney(deliveredCount * 1000)} MMK`} />
              </div>
            </section>
          )}

          {mode === "sync" && (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-blue-700" />
                <h2 className="text-lg font-black text-slate-950">Enterprise Sync Health</h2>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <Metric label="Server Time" value={snapshot?.server_time ? new Date(snapshot.server_time).toLocaleString() : "-"} />
                <Metric label="Workforce Code" value={snapshot?.workforce_code || "-"} />
                <Metric label="Notifications" value={String(notifications.length)} />
              </div>

              {unverifiedJobs.length > 0 && (
                <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <b>{unverifiedJobs.length} parcel(s)</b> are not yet order-picker verified. Data Entry registration check will stay disabled for those rows.
                  </div>
                </div>
              )}
            </section>
          )}

          {mode === "support" && (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Headphones className="h-5 w-5 text-blue-700" />
                <h2 className="text-lg font-black text-slate-950">Enterprise Support</h2>
              </div>

              <textarea
                value={supportText}
                onChange={(event) => setSupportText(event.target.value)}
                rows={6}
                placeholder="Describe the issue, pickup ID, delivery ID, or COD problem..."
                className="mt-4 w-full rounded-2xl border border-slate-300 p-4 text-sm"
              />

              <button
                type="button"
                onClick={() => void sendSupport()}
                disabled={loading}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black uppercase text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Send Support Request
              </button>
            </section>
          )}
        </main>
      </AppShell>

      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

function StatsGrid({ pickups, jobs, outstanding, cod, verified }: { pickups: number; jobs: number; outstanding: number; cod: number; verified: number }) {
  return (
    <section className="mb-5 grid gap-4 md:grid-cols-5">
      <Metric label="Pickups" value={String(pickups)} icon={<Truck className="h-5 w-5" />} />
      <Metric label="Jobs" value={String(jobs)} icon={<PackageCheck className="h-5 w-5" />} />
      <Metric label="Outstanding" value={String(outstanding)} icon={<Clock3 className="h-5 w-5" />} />
      <Metric label="COD" value={`${asMoney(cod)} MMK`} icon={<CircleDollarSign className="h-5 w-5" />} />
      <Metric label="Verified" value={String(verified)} icon={<CheckCircle2 className="h-5 w-5" />} />
    </section>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between text-blue-700">
        <span className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</span>
        {icon}
      </div>
      <div className="mt-3 text-2xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function PickupList({ pickups }: { pickups: MobilePickup[] }) {
  return (
    <section className="mb-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Truck className="h-5 w-5 text-blue-700" />
        <h2 className="text-lg font-black text-slate-950">Assigned Pickups</h2>
      </div>

      {pickups.length === 0 ? (
        <Empty text="No assigned pickup found." />
      ) : (
        <div className="mt-4 space-y-3">
          {pickups.map((pickup) => (
            <div key={pickup.pickup_id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-sm font-black text-blue-700">{pickupWayId(pickup)}</div>
                  <div className="text-sm font-bold text-slate-950">{pickup.merchant_name || pickup.merchant_code || "-"}</div>
                </div>
                {statusBadge(pickup.status)}
              </div>
              <div className="mt-2 text-sm text-slate-500">{pickup.pickup_address || "-"}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function JobList({
  jobs,
  emptyText,
  actions,
  title = "Delivery Waybills",
  titleIcon,
  renderExtra,
}: {
  jobs: MobileJob[];
  emptyText: string;
  title?: string;
  titleIcon?: React.ReactNode;
  actions?: (job: MobileJob) => React.ReactNode;
  renderExtra?: (job: MobileJob) => React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        {titleIcon || <MapPinned className="h-5 w-5 text-blue-700" />}
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
      </div>

      {jobs.length === 0 ? (
        <Empty text={emptyText} />
      ) : (
        <div className="mt-4 space-y-3">
          {jobs.map((job) => (
            <div key={job.id || jobWayId(job)} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-sm font-black text-blue-700">{jobWayId(job)}</div>
                  <div className="mt-1 text-sm font-bold text-slate-950">{job.recipient_name || "Recipient pending"}</div>
                  <div className="text-sm text-slate-500">{job.delivery_address || job.recipient_town || "-"}</div>
                </div>
                {statusBadge(job.status)}
              </div>

              <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
                <Info label="Pickup" value={job.pickup_id} mono />
                <Info label="Township" value={job.recipient_town || "-"} />
                <Info label="Weight" value={`${Number(job.weight_kg || 0).toFixed(1)} KG`} />
                <Info label="COD" value={`${asMoney(job.final_cod || job.cod_amount || 0)} MMK`} />
              </div>

              {job.field_pickup_checked && (
                <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs font-black uppercase text-green-700">
                  Order Picker Checked / Ready for Data Entry Registration
                </div>
              )}

              {renderExtra?.(job)}

              {actions && <div className="mt-4 flex flex-wrap gap-2">{actions(job)}</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function NotificationList({ notifications }: { notifications: Record<string, unknown>[] }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-blue-700" />
        <h2 className="text-lg font-black text-slate-950">Notifications</h2>
      </div>

      {notifications.length === 0 ? (
        <Empty text="No notifications." />
      ) : (
        <div className="mt-4 space-y-3">
          {notifications.slice(0, 8).map((notification, index) => (
            <div key={String(notification.id || index)} className="rounded-2xl bg-slate-50 p-4">
              <div className="text-sm font-black text-slate-950">{String(notification.title || "Notification")}</div>
              <div className="mt-1 text-sm text-slate-500">{String(notification.message || notification.body || "")}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`mt-1 font-bold text-slate-950 ${mono ? "font-mono text-blue-700" : ""}`}>{value}</div>
    </div>
  );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black uppercase text-blue-700">
      {label}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}
