import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Camera, CheckCircle2, CircleDollarSign, ClipboardCheck, HelpCircle, Loader2,
  MapPinned, PackageCheck, RefreshCw, Route, Send, ShieldCheck, Truck, WalletCards
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProfileDrawer } from "@/components/ProfileDrawer";
import {
  formatMMK, handoverGoLiveCod, loadGoLiveSnapshot, sendGoLiveSupportRequest, statusLabel,
  updateGoLiveWaybillStatus, verifyGoLivePickupParcel,
  type GoLiveJob, type GoLivePickup, type GoLiveSnapshot, type WorkforceRole
} from "@/lib/driverHelperGoLiveApi";

type PageMode = "home" | "jobs" | "route" | "proof" | "cod" | "earnings" | "sync" | "support" | "pickup" | "pickupForm";

const emptySnapshot: GoLiveSnapshot = {
  ok: false, account: {}, pickup_ids: [], pickups: [], jobs: [], assignments: [], cod_records: [], notifications: [], summary: {},
};

function roleTitle(role: WorkforceRole) {
  return role === "driver" ? "Driver" : role === "helper" ? "Helper" : "Rider";
}

function pageTitle(mode: PageMode) {
  return ({
    home: "Go-Live Dashboard",
    jobs: "Assigned Jobs",
    route: "Route Board",
    proof: "Proof of Delivery",
    cod: "COD Center",
    earnings: "Earnings",
    sync: "Enterprise Sync",
    support: "Support",
    pickup: "Field Pickup Verification",
    pickupForm: "Pickup Delivery Form",
  } as Record<PageMode, string>)[mode];
}

function readFileAsDataUrl(file?: File | null): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file selected."));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read selected file."));
    reader.readAsDataURL(file);
  });
}

export default function MobileWorkforceGoLivePage({ role, mode }: { role: WorkforceRole; mode: PageMode }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<GoLiveSnapshot>(emptySnapshot);
  const [selectedPickupId, setSelectedPickupId] = useState("");
  const [selectedWayId, setSelectedWayId] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setNotice(null);
    try {
      const data = await loadGoLiveSnapshot(role);
      setSnapshot(data);
      setSelectedPickupId((prev) => prev || data.pickups[0]?.pickup_id || "");
      setSelectedWayId((prev) => prev || data.jobs[0]?.deliver_way_id || data.jobs[0]?.tracking_no || "");
      if (data.pickups.length === 0 && data.jobs.length === 0) {
        setNotice({ type: "error", text: `No assigned work found for this ${role}. Ask Supervisor to assign pickup/jobs in Enterprise Portal.` });
      }
    } catch (err: any) {
      setNotice({ type: "error", text: err?.message || "Enterprise sync failed." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [role]);

  const selectedPickup = useMemo(
    () => snapshot.pickups.find((p) => p.pickup_id === selectedPickupId) || snapshot.pickups[0],
    [snapshot.pickups, selectedPickupId]
  );

  const selectedJob = useMemo(
    () => snapshot.jobs.find((j) => (j.deliver_way_id || j.tracking_no) === selectedWayId) || snapshot.jobs[0],
    [snapshot.jobs, selectedWayId]
  );

  return (
    <>
      <AppShell role={role as any} onOpenProfile={() => setProfileOpen(true)}>
        <main className="min-h-screen bg-slate-50 p-4 pb-28">
          <section className="mb-5 rounded-3xl bg-gradient-to-br from-slate-950 to-blue-950 p-5 text-white shadow-lg">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-200">
                  {roleTitle(role)} App · Enterprise Portal Sync
                </p>
                <h1 className="mt-2 text-2xl font-black tracking-tight">{pageTitle(mode)}</h1>
                <p className="mt-1 text-sm text-blue-100">
                  CS → Data Entry → Supervisor → {roleTitle(role)} App, using the same pickup and delivery way IDs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refresh()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/20"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Sync
              </button>
            </div>
          </section>

          {notice && (
            <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-bold ${
              notice.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"
            }`}>
              {notice.text}
            </div>
          )}

          {mode === "home" && <HomePanel snapshot={snapshot} role={role} selectedPickup={selectedPickup} />}
          {mode === "jobs" && <JobsPanel jobs={snapshot.jobs} refresh={refresh} setLoading={setLoading} setNotice={setNotice} snapshot={snapshot} />}
          {mode === "route" && <RoutePanel jobs={snapshot.jobs} pickups={snapshot.pickups} />}
          {mode === "proof" && (
            <ProofPanel
              jobs={snapshot.jobs}
              selectedWayId={selectedWayId}
              setSelectedWayId={setSelectedWayId}
              selectedJob={selectedJob}
              actorCode={snapshot.workforce_code}
              actorName={snapshot.account?.display_name}
              refresh={refresh}
              setLoading={setLoading}
              setNotice={setNotice}
            />
          )}
          {mode === "cod" && (
            <CodPanel
              codRecords={snapshot.cod_records}
              actorCode={snapshot.workforce_code}
              actorName={snapshot.account?.display_name}
              refresh={refresh}
              setLoading={setLoading}
              setNotice={setNotice}
            />
          )}
          {mode === "earnings" && <EarningsPanel snapshot={snapshot} role={role} />}
          {mode === "sync" && <SyncPanel snapshot={snapshot} loading={loading} refresh={() => void refresh()} />}
          {mode === "support" && (
            <SupportPanel
              role={role}
              pickups={snapshot.pickups}
              jobs={snapshot.jobs}
              actorCode={snapshot.workforce_code}
              actorName={snapshot.account?.display_name}
              refresh={refresh}
              setLoading={setLoading}
              setNotice={setNotice}
            />
          )}
          {(mode === "pickup" || mode === "pickupForm") && (
            <PickupPanel
              role={role}
              pickups={snapshot.pickups}
              jobs={snapshot.jobs}
              selectedPickupId={selectedPickupId}
              setSelectedPickupId={setSelectedPickupId}
              actorCode={snapshot.workforce_code}
              actorName={snapshot.account?.display_name}
              refresh={refresh}
              setLoading={setLoading}
              setNotice={setNotice}
            />
          )}
        </main>
      </AppShell>
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

async function runAction(
  setLoading: (value: boolean) => void,
  setNotice: (value: { type: "success" | "error"; text: string } | null) => void,
  action: () => Promise<string>
) {
  setLoading(true);
  setNotice(null);
  try {
    setNotice({ type: "success", text: await action() });
  } catch (err: any) {
    setNotice({ type: "error", text: err?.message || "Action failed." });
  } finally {
    setLoading(false);
  }
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="rounded-2xl bg-blue-50 p-3 text-blue-700"><Icon className="h-5 w-5" /></div>
        <div className="text-right"><div className="text-2xl font-black text-slate-950">{value}</div><div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div></div>
      </div>
    </div>
  );
}

function HomePanel({ snapshot, role, selectedPickup }: { snapshot: GoLiveSnapshot; role: WorkforceRole; selectedPickup?: GoLivePickup }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Truck} label="Assigned pickups" value={String(snapshot.pickups.length)} />
        <StatCard icon={PackageCheck} label="Jobs" value={String(snapshot.jobs.length)} />
        <StatCard icon={CheckCircle2} label="Delivered" value={String(snapshot.summary.delivered_count || 0)} />
        <StatCard icon={CircleDollarSign} label="COD" value={formatMMK(snapshot.summary.cod_total || 0)} />
      </div>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-blue-700" /><h2 className="text-lg font-black text-slate-950">Current Assignment</h2></div>
        {selectedPickup ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Info label="Pickup Way ID" value={selectedPickup.pickup_id} mono />
            <Info label="Merchant" value={selectedPickup.merchant_name || selectedPickup.merchant_code || "-"} />
            <Info label="Vehicle" value={selectedPickup.assigned_vehicle_plate || "-"} />
            <div className="md:col-span-3 rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-black uppercase tracking-wide text-slate-500">Pickup Address</div>
              <div className="mt-1 text-sm font-bold text-slate-900">{selectedPickup.pickup_address || "-"}</div>
            </div>
          </div>
        ) : <EmptyState text={`No pickup assigned to this ${role} yet.`} />}
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-black text-slate-950">Latest Notifications</h2>
        <div className="space-y-3">
          {snapshot.notifications.slice(0, 5).map((n: any) => (
            <div key={n.id || n.event_key} className="rounded-2xl bg-slate-50 p-4">
              <div className="font-black text-slate-900">{n.title || "Notification"}</div>
              <div className="text-sm text-slate-600">{n.message || n.body}</div>
            </div>
          ))}
          {snapshot.notifications.length === 0 && <EmptyState text="No enterprise notifications yet." />}
        </div>
      </section>
    </div>
  );
}

function JobsPanel({
  jobs, refresh, setLoading, setNotice, snapshot
}: {
  jobs: GoLiveJob[];
  refresh: () => Promise<void>;
  setLoading: (value: boolean) => void;
  setNotice: (value: { type: "success" | "error"; text: string } | null) => void;
  snapshot: GoLiveSnapshot;
}) {
  async function onStatus(job: GoLiveJob, status: string) {
    await runAction(setLoading, setNotice, async () => {
      await updateGoLiveWaybillStatus({
        pickup_id: job.pickup_id,
        deliver_way_id: job.deliver_way_id || job.tracking_no || "",
        status,
        actor_code: snapshot.workforce_code,
        actor_name: snapshot.account?.display_name,
      });
      await refresh();
      return `Updated ${job.deliver_way_id || job.tracking_no} to ${statusLabel(status)}.`;
    });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-blue-700" /><h2 className="text-lg font-black text-slate-950">Delivery Jobs</h2></div>
      <div className="space-y-4">
        {jobs.map((job) => (
          <JobCard key={`${job.pickup_id}-${job.deliver_way_id || job.tracking_no}`} job={job}>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-black text-white" onClick={() => void onStatus(job, "in_transit")}>In Transit</button>
              <button className="rounded-xl bg-green-600 px-3 py-2 text-xs font-black text-white" onClick={() => void onStatus(job, "delivered")}>Delivered</button>
              <button className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white" onClick={() => void onStatus(job, "failed")}>Failed</button>
            </div>
          </JobCard>
        ))}
        {jobs.length === 0 && <EmptyState text="No delivery jobs. Data Entry rows must exist and Supervisor must assign the field team." />}
      </div>
    </section>
  );
}

function RoutePanel({ jobs, pickups }: { jobs: GoLiveJob[]; pickups: GoLivePickup[] }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2"><Route className="h-5 w-5 text-blue-700" /><h2 className="text-lg font-black text-slate-950">Route Stops</h2></div>
      {pickups.length > 0 && <div className="mb-4 rounded-2xl bg-blue-50 p-4 text-sm font-bold text-blue-900">Start from pickup: {pickups[0].pickup_id} · {pickups[0].pickup_address || pickups[0].township || "-"}</div>}
      <div className="space-y-3">
        {jobs.map((job, index) => (
          <div key={`${job.pickup_id}-${job.deliver_way_id || job.tracking_no}`} className="flex gap-3 rounded-2xl border border-slate-200 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">{index + 1}</div>
            <div>
              <div className="font-mono text-sm font-black text-blue-700">{job.deliver_way_id || job.tracking_no}</div>
              <div className="text-sm font-bold text-slate-900">{job.recipient_name || "-"}</div>
              <div className="text-sm text-slate-600">{job.delivery_address || job.recipient_town || "-"}</div>
            </div>
          </div>
        ))}
        {jobs.length === 0 && <EmptyState text="No route stops yet." />}
      </div>
    </section>
  );
}

function ProofPanel({
  jobs, selectedWayId, setSelectedWayId, selectedJob, actorCode, actorName, refresh, setLoading, setNotice,
}: {
  jobs: GoLiveJob[];
  selectedWayId: string;
  setSelectedWayId: (id: string) => void;
  selectedJob?: GoLiveJob;
  actorCode?: string;
  actorName?: string;
  refresh: () => Promise<void>;
  setLoading: (value: boolean) => void;
  setNotice: (value: { type: "success" | "error"; text: string } | null) => void;
}) {
  const [photo, setPhoto] = useState("");
  const [signature, setSignature] = useState("");
  const [note, setNote] = useState("");

  async function submit(status: "delivered" | "failed") {
    if (!selectedJob) return setNotice({ type: "error", text: "Select a delivery job first." });
    if (status === "delivered" && !photo) return setNotice({ type: "error", text: "Proof photo is required for delivery." });
    await runAction(setLoading, setNotice, async () => {
      await updateGoLiveWaybillStatus({
        pickup_id: selectedJob.pickup_id,
        deliver_way_id: selectedJob.deliver_way_id || selectedJob.tracking_no || "",
        status,
        proof_photo_url: photo,
        proof_signature_url: signature,
        note,
        cod_collected_amount: selectedJob.cod_amount,
        actor_code: actorCode,
        actor_name: actorName,
      });
      await refresh();
      return `${selectedJob.deliver_way_id || selectedJob.tracking_no} marked ${statusLabel(status)}.`;
    });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-black text-slate-950">Proof Capture</h2>
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Delivery Way ID</span>
        <select value={selectedWayId} onChange={(event) => setSelectedWayId(event.target.value)} className="h-12 w-full rounded-xl border border-slate-300 px-4 font-mono text-sm font-bold">
          {jobs.map((job) => {
            const id = job.deliver_way_id || job.tracking_no || "";
            return <option key={`${job.pickup_id}-${id}`} value={id}>{id} · {job.recipient_name || "-"}</option>;
          })}
        </select>
      </label>
      {selectedJob && <div className="mt-4"><JobCard job={selectedJob} /></div>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <FileCapture label="Proof Photo" onDataUrl={setPhoto} ok={Boolean(photo)} />
        <SignatureBox value={signature} onChange={setSignature} />
      </div>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Delivery note / exception reason..." className="mt-4 min-h-24 w-full rounded-2xl border border-slate-300 p-3 text-sm" />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button className="rounded-2xl bg-green-600 px-4 py-3 text-sm font-black text-white" onClick={() => void submit("delivered")}>Confirm Delivered</button>
        <button className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white" onClick={() => void submit("failed")}>Mark Failed</button>
      </div>
    </section>
  );
}

function CodPanel({
  codRecords, actorCode, actorName, refresh, setLoading, setNotice,
}: {
  codRecords: any[];
  actorCode?: string;
  actorName?: string;
  refresh: () => Promise<void>;
  setLoading: (value: boolean) => void;
  setNotice: (value: { type: "success" | "error"; text: string } | null) => void;
}) {
  const total = codRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div><h2 className="text-lg font-black text-slate-950">COD Center</h2><p className="text-sm text-slate-500">Collected COD must match Finance records.</p></div>
        <div className="text-right"><div className="text-xl font-black text-slate-950">{formatMMK(total)}</div><div className="text-xs font-black uppercase text-slate-500">Total COD</div></div>
      </div>
      <div className="space-y-3">
        {codRecords.map((record) => (
          <div key={`${record.pickup_id}-${record.deliver_way_id}`} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div><div className="font-mono text-sm font-black text-blue-700">{record.deliver_way_id}</div><div className="text-sm text-slate-600">{record.recipient_name || "-"}</div></div>
              <div className="text-right"><div className="font-black text-slate-950">{formatMMK(record.amount)}</div><div className="text-xs text-slate-500">{record.handed_over ? "Handed over" : record.collected ? "Collected" : "Pending"}</div></div>
            </div>
            <button className="mt-3 w-full rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white" onClick={() => void runAction(setLoading, setNotice, async () => {
              await handoverGoLiveCod({ pickup_id: record.pickup_id, deliver_way_id: record.deliver_way_id, amount: record.amount, actor_code: actorCode, actor_name: actorName });
              await refresh();
              return `${record.deliver_way_id} COD handed over.`;
            })}>Handover COD</button>
          </div>
        ))}
        {codRecords.length === 0 && <EmptyState text="No COD records from Data Entry yet." />}
      </div>
    </section>
  );
}

function EarningsPanel({ snapshot, role }: { snapshot: GoLiveSnapshot; role: WorkforceRole }) {
  const delivered = Number(snapshot.summary.delivered_count || 0);
  const estimated = delivered * (role === "driver" ? 1000 : 500);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard icon={PackageCheck} label="Delivered jobs" value={String(delivered)} />
      <StatCard icon={WalletCards} label="Estimated allowance" value={formatMMK(estimated)} />
      <StatCard icon={Truck} label="Assigned pickups" value={String(snapshot.pickups.length)} />
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-3">
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />Earnings shown here are operational estimates. Final payroll/settlement should be approved in Enterprise Portal Finance.</div>
      </section>
    </div>
  );
}

function SyncPanel({ snapshot, loading, refresh }: { snapshot: GoLiveSnapshot; loading: boolean; refresh: () => void }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">Enterprise Sync Health</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <Info label="Workforce Code" value={snapshot.workforce_code || "-"} mono />
        <Info label="Workforce Type" value={snapshot.workforce_type || "-"} />
        <Info label="Pickup IDs" value={String(snapshot.pickup_ids.length)} />
        <Info label="Notifications" value={String(snapshot.notifications.length)} />
      </div>
      <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 py-3 text-sm font-black text-white" onClick={refresh}>
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Reload from Enterprise Portal
      </button>
    </section>
  );
}

function SupportPanel({
  role, pickups, jobs, actorCode, actorName, refresh, setLoading, setNotice,
}: {
  role: WorkforceRole; pickups: GoLivePickup[]; jobs: GoLiveJob[]; actorCode?: string; actorName?: string; refresh: () => Promise<void>;
  setLoading: (value: boolean) => void; setNotice: (value: { type: "success" | "error"; text: string } | null) => void;
}) {
  const [pickupId, setPickupId] = useState("");
  const [wayId, setWayId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setPickupId((prev) => prev || pickups[0]?.pickup_id || "");
    setWayId((prev) => prev || jobs[0]?.deliver_way_id || "");
  }, [pickups, jobs]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2"><HelpCircle className="h-5 w-5 text-blue-700" /><h2 className="text-lg font-black text-slate-950">Support Request</h2></div>
      <div className="grid gap-3 md:grid-cols-2">
        <select value={pickupId} onChange={(event) => setPickupId(event.target.value)} className="h-12 rounded-xl border border-slate-300 px-3 font-mono text-sm">
          <option value="">Pickup ID...</option>{pickups.map((p) => <option key={p.pickup_id} value={p.pickup_id}>{p.pickup_id}</option>)}
        </select>
        <select value={wayId} onChange={(event) => setWayId(event.target.value)} className="h-12 rounded-xl border border-slate-300 px-3 font-mono text-sm">
          <option value="">Delivery Way ID...</option>{jobs.map((j) => <option key={`${j.pickup_id}-${j.deliver_way_id}`} value={j.deliver_way_id}>{j.deliver_way_id}</option>)}
        </select>
      </div>
      <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Describe issue..." className="mt-4 min-h-32 w-full rounded-2xl border border-slate-300 p-3 text-sm" />
      <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50" disabled={!message.trim()} onClick={() => void runAction(setLoading, setNotice, async () => {
        await sendGoLiveSupportRequest({ workforce_type: role, title: `${roleTitle(role)} Support Request`, message, pickup_id: pickupId, deliver_way_id: wayId, actor_code: actorCode, actor_name: actorName });
        setMessage(""); await refresh(); return "Support request synchronized to Enterprise Portal.";
      })}><Send className="h-4 w-4" />Send Support Request</button>
    </section>
  );
}

function PickupPanel({
  role, pickups, jobs, selectedPickupId, setSelectedPickupId, actorCode, actorName, refresh, setLoading, setNotice,
}: {
  role: WorkforceRole; pickups: GoLivePickup[]; jobs: GoLiveJob[]; selectedPickupId: string; setSelectedPickupId: (value: string) => void; actorCode?: string; actorName?: string;
  refresh: () => Promise<void>; setLoading: (value: boolean) => void; setNotice: (value: { type: "success" | "error"; text: string } | null) => void;
}) {
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const pickup = pickups.find((p) => p.pickup_id === selectedPickupId) || pickups[0];
  const pickupJobs = jobs.filter((j) => j.pickup_id === pickup?.pickup_id);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2"><MapPinned className="h-5 w-5 text-blue-700" /><h2 className="text-lg font-black text-slate-950">Field Pickup Verification</h2></div>
      <select value={pickup?.pickup_id || ""} onChange={(event) => setSelectedPickupId(event.target.value)} className="h-12 w-full rounded-xl border border-slate-300 px-4 font-mono text-sm font-bold">
        {pickups.map((p) => <option key={p.pickup_id} value={p.pickup_id}>{p.pickup_id} · {p.merchant_name || p.merchant_code || "-"} · Count {p.parcel_count || 1}</option>)}
      </select>
      {pickup ? <div className="mt-4 rounded-2xl bg-slate-50 p-4"><div className="font-mono text-sm font-black text-blue-700">{pickup.pickup_id}</div><div className="font-bold text-slate-950">{pickup.merchant_name || pickup.merchant_code}</div><div className="text-sm text-slate-600">{pickup.pickup_address || pickup.township || "-"}</div></div> : <EmptyState text={`No pickup assigned to this ${role}.`} />}
      <div className="mt-4 space-y-4">
        {pickupJobs.map((job) => {
          const id = job.deliver_way_id || job.tracking_no || "";
          return (
            <div key={`${job.pickup_id}-${id}`} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div><div className="font-mono text-sm font-black text-blue-700">{id}</div><div className="text-sm font-bold text-slate-900">{job.recipient_name || "Recipient pending"}</div><div className="text-xs text-slate-500">{job.pickup_verification_status || "pending"}</div></div>
                {job.field_pickup_checked ? <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">Verified</span> : <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">Need Check</span>}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <input value={weights[id] ?? String(job.weight_kg || "")} onChange={(event) => setWeights((prev) => ({ ...prev, [id]: event.target.value }))} placeholder="Actual weight KG" type="number" className="h-11 rounded-xl border border-slate-300 px-3 text-sm" />
                <FileCapture label={photos[id] ? "Photo OK" : "Cargo Photo"} ok={Boolean(photos[id] || job.proof_photo_url)} onDataUrl={(value) => setPhotos((prev) => ({ ...prev, [id]: value }))} />
                <input value={notes[id] || ""} onChange={(event) => setNotes((prev) => ({ ...prev, [id]: event.target.value }))} placeholder="Note" className="h-11 rounded-xl border border-slate-300 px-3 text-sm" />
              </div>
              <button className="mt-3 w-full rounded-xl bg-blue-700 px-4 py-3 text-xs font-black uppercase text-white" onClick={() => void runAction(setLoading, setNotice, async () => {
                await verifyGoLivePickupParcel({ pickup_id: job.pickup_id, deliver_way_id: id, weight_kg: Number(weights[id] || job.weight_kg || 0), photo_url: photos[id] || job.proof_photo_url || "", note: notes[id], actor_code: actorCode, actor_name: actorName });
                await refresh(); return `${id} field pickup verified. Data Entry can now check/register it.`;
              })}>Verify Parcel Pickup</button>
            </div>
          );
        })}
        {pickupJobs.length === 0 && <EmptyState text="No Data Entry waybill rows found for this pickup yet. Ask Data Entry to prepare the parcel template." />}
      </div>
    </section>
  );
}

function JobCard({ job, children }: { job: GoLiveJob; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="font-mono text-sm font-black text-blue-700">{job.deliver_way_id || job.tracking_no}</div>
          <div className="mt-1 text-base font-black text-slate-950">{job.recipient_name || "Recipient pending"}</div>
          <div className="text-sm text-slate-600">{job.recipient_phone || "-"}</div>
          <div className="mt-1 text-sm text-slate-600">{job.delivery_address || job.recipient_town || "-"}</div>
        </div>
        <div className="text-left md:text-right"><div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase text-slate-700">{statusLabel(job.status)}</div><div className="mt-2 font-black text-slate-950">{formatMMK(job.cod_amount || 0)}</div></div>
      </div>
      {children}
    </div>
  );
}

function FileCapture({ label, onDataUrl, ok }: { label: string; onDataUrl: (value: string) => void; ok: boolean }) {
  return (
    <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 text-xs font-black uppercase text-slate-600">
      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (event) => onDataUrl(await readFileAsDataUrl(event.target.files?.[0]))} />
      <Camera className={`h-4 w-4 ${ok ? "text-green-600" : "text-slate-500"}`} />{label}
    </label>
  );
}

function SignatureBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(value);
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">Receiver Signature / Name</span>
      <input value={text} onChange={(event) => { setText(event.target.value); onChange(event.target.value); }} placeholder="Type receiver name as signature" className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" />
    </label>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div><div className={`mt-1 font-black text-slate-950 ${mono ? "font-mono text-blue-700" : ""}`}>{value}</div></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500">{text}</div>;
}
