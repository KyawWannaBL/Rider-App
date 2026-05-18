import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Award,
  Bell,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Headphones,
  Loader2,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Route,
  Send,
  ShieldCheck,
  Truck,
  UserRound,
  Wallet,
  Wifi,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProfileDrawer } from "@/components/ProfileDrawer";
import { supabase } from "@/integrations/supabase/client";

type RiderTab = "dashboard" | "jobs" | "route" | "cod" | "earnings" | "support" | "sync";

type MobileNotification = {
  id?: string;
  pickup_id?: string;
  title?: string;
  body?: string;
  message?: string;
  status?: string;
  created_at?: string;
  payload?: Record<string, unknown>;
};

type RiderAccount = {
  workforce_code?: string;
  workforce_type?: string;
  display_name?: string;
  email?: string;
  phone?: string;
  branch_code?: string;
  assigned_branch?: string;
};

type RiderPickup = {
  pickup_id: string;
  pickup_way_id?: string;
  merchant_code?: string;
  merchant_name?: string;
  sender_name?: string;
  sender_phone?: string;
  pickup_address?: string;
  township?: string;
  city?: string;
  parcel_count?: number;
  status?: string;
  assignment_status?: string;
  assigned_rider_name?: string;
  assigned_driver_name?: string;
  assigned_helper_name?: string;
  assigned_vehicle_plate?: string;
  assigned_at?: string;
};

type RiderJob = {
  id?: string;
  pickup_id: string;
  pickup_way_id?: string;
  deliver_way_id: string;
  tracking_no?: string;
  line_no?: number;
  merchant_code?: string;
  merchant_name?: string;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_town?: string;
  delivery_address?: string;
  delivery_city?: string;
  status?: string;
  cod_amount?: number;
  final_cod?: number;
  delivery_fee?: number;
  item_price?: number;
  weight_kg?: number;
  field_pickup_checked?: boolean;
  data_entry_registration_checked?: boolean;
  pickup_verification_status?: string;
  photo_url?: string;
  proof_photo_url?: string;
  updated_at?: string;
  created_at?: string;
};

type Snapshot = {
  ok?: boolean;
  account?: RiderAccount;
  pickups?: RiderPickup[];
  jobs?: RiderJob[];
  assignments?: RiderJob[];
  cod_records?: RiderJob[];
  notifications?: MobileNotification[];
  stats?: Record<string, number>;
  generated_at?: string;
};

const tabs: Array<{ key: RiderTab; label: string; icon: typeof Package }> = [
  { key: "dashboard", label: "Home", icon: Package },
  { key: "jobs", label: "Jobs", icon: ClipboardList },
  { key: "route", label: "Route", icon: Route },
  { key: "cod", label: "COD", icon: Wallet },
  { key: "earnings", label: "Earnings", icon: Award },
  { key: "support", label: "Support", icon: Headphones },
  { key: "sync", label: "Sync", icon: Wifi },
];

function money(value: unknown) {
  const n = Number(value || 0);
  return `${n.toLocaleString()} MMK`;
}

function dateTime(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function normalizeJobs(snapshot: Snapshot): RiderJob[] {
  const jobs = Array.isArray(snapshot.jobs) ? snapshot.jobs : Array.isArray(snapshot.assignments) ? snapshot.assignments : [];
  return jobs.map((job) => ({
    ...job,
    pickup_id: String(job.pickup_id || ""),
    pickup_way_id: job.pickup_way_id || job.pickup_id,
    deliver_way_id: String(job.deliver_way_id || job.tracking_no || ""),
    cod_amount: Number(job.final_cod ?? job.cod_amount ?? 0),
    status: job.status || "assigned",
  })).filter((job) => job.pickup_id && job.deliver_way_id);
}

function statusClass(status?: string) {
  const s = String(status || "").toLowerCase();
  if (["delivered", "completed", "settled", "cod_handed_over"].includes(s)) return "bg-green-100 text-green-700";
  if (["failed", "cancelled", "exception"].includes(s)) return "bg-red-100 text-red-700";
  if (["pickup_verified", "in_transit", "out_for_delivery"].includes(s)) return "bg-blue-100 text-blue-700";
  return "bg-amber-100 text-amber-700";
}

async function rpcSnapshot(): Promise<Snapshot> {
  const { data, error } = await (supabase as any).rpc("be_mobile_rider_portal_snapshot", {
    p_workforce_code: null,
    p_workforce_type: null,
    p_limit: 200,
  });

  if (error) throw error;
  return data || { ok: true, pickups: [], jobs: [], notifications: [] };
}

async function updateWaybillStatus(job: RiderJob, nextStatus: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await (supabase as any).rpc("be_mobile_update_waybill_status", {
    p_tracking_no: job.deliver_way_id || job.tracking_no,
    p_status: nextStatus,
    p_payload: {
      pickup_id: job.pickup_id,
      deliver_way_id: job.deliver_way_id,
      ...payload,
    },
  });

  if (error) throw error;
  return data;
}

async function submitCodHandover(payload: Record<string, unknown>) {
  const { data, error } = await (supabase as any).rpc("be_mobile_cod_handover", {
    p_payload: payload,
  });

  if (error) throw error;
  return data;
}

async function submitSupport(payload: Record<string, unknown>) {
  const { data, error } = await (supabase as any).rpc("be_mobile_support_request", {
    p_payload: payload,
  });

  if (error) throw error;
  return data;
}

export default function RiderDashboard() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<RiderTab>("dashboard");
  const [snapshot, setSnapshot] = useState<Snapshot>({ ok: true, pickups: [], jobs: [], notifications: [] });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const jobs = useMemo(() => normalizeJobs(snapshot), [snapshot]);
  const pickups = Array.isArray(snapshot.pickups) ? snapshot.pickups : [];
  const notifications = Array.isArray(snapshot.notifications) ? snapshot.notifications : [];

  const stats = useMemo(() => {
    const delivered = jobs.filter((j) => String(j.status).toLowerCase() === "delivered").length;
    const pending = jobs.filter((j) => !["delivered", "failed", "cancelled"].includes(String(j.status).toLowerCase())).length;
    const cod = jobs.reduce((sum, job) => sum + Number(job.cod_amount || job.final_cod || 0), 0);
    const verified = jobs.filter((j) => j.field_pickup_checked || j.pickup_verification_status === "verified").length;

    return {
      pickups: pickups.length,
      jobs: jobs.length,
      pending,
      delivered,
      cod,
      verified,
      notifications: notifications.filter((n) => String(n.status || "unread") === "unread").length,
    };
  }, [jobs, pickups, notifications]);

  async function refresh() {
    setLoading(true);
    setNotice(null);

    try {
      const next = await rpcSnapshot();
      setSnapshot(next);
    } catch (err: any) {
      setNotice({ type: "error", text: err?.message || "Enterprise sync failed." });
    } finally {
      setLoading(false);
    }
  }

  async function handleStatus(job: RiderJob, nextStatus: string, payload: Record<string, unknown> = {}) {
    setLoading(true);
    setNotice(null);

    try {
      await updateWaybillStatus(job, nextStatus, payload);
      await refresh();
      setNotice({ type: "success", text: `${job.deliver_way_id} updated to ${nextStatus}.` });
    } catch (err: any) {
      setNotice({ type: "error", text: err?.message || "Status update failed." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const tabProps = { snapshot, jobs, pickups, notifications, stats, loading, refresh, handleStatus, setNotice };

  return (
    <>
      <AppShell role="rider" onOpenProfile={() => setProfileOpen(true)}>
        <main className="min-h-screen bg-slate-50 pb-28">
          <section className="border-b border-slate-200 bg-white px-4 py-4">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700">
                    Enterprise Sync
                  </span>
                  <span className="text-xs font-bold text-slate-500">{dateTime(snapshot.generated_at)}</span>
                </div>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                  {snapshot.account?.display_name || "Rider Portal"}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Jobs, COD, route and proof are synchronized with Enterprise Portal.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void refresh()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 shadow-sm"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Sync
              </button>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 py-4">
            {notice && (
              <div
                className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-bold ${
                  notice.type === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-green-200 bg-green-50 text-green-700"
                }`}
              >
                {notice.text}
              </div>
            )}

            <nav className="mb-4 grid grid-cols-4 gap-2 md:grid-cols-7">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`rounded-2xl border px-2 py-3 text-xs font-black transition ${
                      active
                        ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-200"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    <Icon className="mx-auto mb-1 h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {activeTab === "dashboard" && <DashboardTab {...tabProps} />}
            {activeTab === "jobs" && <JobsTab {...tabProps} />}
            {activeTab === "route" && <RouteTab {...tabProps} />}
            {activeTab === "cod" && <CodTab {...tabProps} />}
            {activeTab === "earnings" && <EarningsTab {...tabProps} />}
            {activeTab === "support" && <SupportTab {...tabProps} />}
            {activeTab === "sync" && <SyncTab {...tabProps} />}
          </section>
        </main>
      </AppShell>

      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

type TabProps = {
  snapshot: Snapshot;
  jobs: RiderJob[];
  pickups: RiderPickup[];
  notifications: MobileNotification[];
  stats: Record<string, number>;
  loading: boolean;
  refresh: () => Promise<void>;
  handleStatus: (job: RiderJob, nextStatus: string, payload?: Record<string, unknown>) => Promise<void>;
  setNotice: (notice: { type: "success" | "error"; text: string } | null) => void;
};

function DashboardTab({ snapshot, jobs, pickups, notifications, stats, handleStatus }: TabProps) {
  const nextJobs = jobs.slice(0, 4);
  const nextNotifications = notifications.slice(0, 4);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric icon={Truck} label="Assigned Pickups" value={stats.pickups} />
        <Metric icon={Package} label="Delivery Jobs" value={stats.jobs} />
        <Metric icon={ShieldCheck} label="Verified by Picker" value={stats.verified} />
        <Metric icon={DollarSign} label="COD to Handle" value={money(stats.cod)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Assigned Pickups" icon={Truck}>
          {pickups.length === 0 ? (
            <EmptyState text="No assigned pickup from Enterprise Portal." />
          ) : (
            <div className="space-y-3">
              {pickups.slice(0, 5).map((pickup) => (
                <div key={pickup.pickup_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-mono text-sm font-black text-blue-700">{pickup.pickup_id}</div>
                      <div className="mt-1 text-sm font-bold text-slate-900">{pickup.merchant_name || pickup.merchant_code}</div>
                    </div>
                    <StatusPill status={pickup.status || pickup.assignment_status} />
                  </div>
                  <div className="mt-3 text-sm text-slate-600">{pickup.pickup_address || "-"}</div>
                  <div className="mt-2 text-xs font-bold text-slate-500">Parcels: {pickup.parcel_count || 0}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Notifications" icon={Bell}>
          {nextNotifications.length === 0 ? (
            <EmptyState text="No unread assignment or operation notification." />
          ) : (
            <div className="space-y-3">
              {nextNotifications.map((n) => (
                <div key={n.id || `${n.pickup_id}-${n.created_at}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="font-black text-slate-950">{n.title || "Notification"}</div>
                  <div className="mt-1 text-sm text-slate-600">{n.message || n.body || "-"}</div>
                  <div className="mt-2 text-xs font-bold text-slate-400">{dateTime(n.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Next Jobs" icon={ClipboardList}>
        <JobList jobs={nextJobs} onStatus={handleStatus} compact />
      </Card>
    </div>
  );
}

function JobsTab({ jobs, handleStatus }: TabProps) {
  const [search, setSearch] = useState("");
  const filtered = jobs.filter((job) => {
    const text = `${job.deliver_way_id} ${job.pickup_id} ${job.recipient_name} ${job.recipient_phone} ${job.recipient_town} ${job.delivery_address}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <Card title="Delivery Jobs from Data Entry" icon={ClipboardList}>
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by D way ID, recipient, phone or township..."
        className="mb-4 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm"
      />
      <JobList jobs={filtered} onStatus={handleStatus} />
    </Card>
  );
}

function RouteTab({ jobs, handleStatus }: TabProps) {
  const routeJobs = jobs.filter((job) => !["delivered", "cancelled"].includes(String(job.status || "").toLowerCase()));

  return (
    <Card title="Route Stops" icon={Route}>
      {routeJobs.length === 0 ? (
        <EmptyState text="No active route stop." />
      ) : (
        <div className="space-y-3">
          {routeJobs.map((job, index) => (
            <div key={job.deliver_way_id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-black text-blue-700">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-mono text-sm font-black text-blue-700">{job.deliver_way_id}</div>
                    <StatusPill status={job.status} />
                  </div>
                  <div className="mt-2 font-black text-slate-950">{job.recipient_name || "Recipient pending"}</div>
                  <div className="mt-1 flex items-center gap-1 text-sm text-slate-600">
                    <MapPin className="h-4 w-4" />
                    {job.delivery_address || job.recipient_town || "-"}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {job.recipient_phone && (
                      <a href={`tel:${job.recipient_phone}`} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">
                        <Phone className="mr-1 inline h-3.5 w-3.5" />
                        Call
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleStatus(job, "out_for_delivery")}
                      className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white"
                    >
                      Start Stop
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStatus(job, "delivered")}
                      className="rounded-xl bg-green-600 px-3 py-2 text-xs font-black text-white"
                    >
                      Delivered
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function CodTab({ jobs, loading, refresh, setNotice }: TabProps) {
  const codJobs = jobs.filter((job) => Number(job.cod_amount || job.final_cod || 0) > 0);
  const total = codJobs.reduce((sum, job) => sum + Number(job.cod_amount || job.final_cod || 0), 0);

  async function handoverAll() {
    try {
      await submitCodHandover({
        tracking_numbers: codJobs.map((job) => job.deliver_way_id),
        total_amount: total,
        remarks: "Mobile COD handover submitted by rider.",
      });
      await refresh();
      setNotice({ type: "success", text: "COD handover submitted to Finance." });
    } catch (err: any) {
      setNotice({ type: "error", text: err?.message || "COD handover failed." });
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
        <div className="text-xs font-black uppercase tracking-widest text-slate-400">COD Balance</div>
        <div className="mt-2 text-4xl font-black">{money(total)}</div>
        <button
          type="button"
          disabled={loading || total <= 0}
          onClick={() => void handoverAll()}
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-green-500 px-4 text-sm font-black text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          Submit COD Handover
        </button>
      </div>

      <Card title="COD Jobs" icon={Wallet}>
        <JobList jobs={codJobs} compact />
      </Card>
    </div>
  );
}

function EarningsTab({ jobs }: TabProps) {
  const delivered = jobs.filter((j) => String(j.status || "").toLowerCase() === "delivered");
  const verified = jobs.filter((j) => j.field_pickup_checked || j.pickup_verification_status === "verified");
  const estimatedDeliveryEarning = delivered.length * 1000;
  const estimatedPickupEarning = verified.length * 500;
  const total = estimatedDeliveryEarning + estimatedPickupEarning;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Metric icon={CheckCircle2} label="Delivered" value={delivered.length} />
        <Metric icon={ShieldCheck} label="Pickup Verified" value={verified.length} />
        <Metric icon={Award} label="Estimated Earnings" value={money(total)} />
      </div>

      <Card title="Earning Basis" icon={Award}>
        <div className="space-y-3 text-sm text-slate-700">
          <Line label="Delivery completion earning" value={money(estimatedDeliveryEarning)} />
          <Line label="Pickup verification earning" value={money(estimatedPickupEarning)} />
          <Line label="Total estimated earning" value={money(total)} strong />
        </div>
        <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">
          Final payroll should be confirmed from Finance/HR rules. This screen derives operational earnings from synchronized waybill status only.
        </div>
      </Card>
    </div>
  );
}

function SupportTab({ snapshot, setNotice }: TabProps) {
  const [topic, setTopic] = useState("delivery_issue");
  const [message, setMessage] = useState("");
  const [pickupId, setPickupId] = useState("");

  async function sendSupport() {
    try {
      await submitSupport({
        topic,
        message,
        pickup_id: pickupId,
        account: snapshot.account,
      });
      setMessage("");
      setPickupId("");
      setNotice({ type: "success", text: "Support request sent to Enterprise Portal." });
    } catch (err: any) {
      setNotice({ type: "error", text: err?.message || "Support request failed." });
    }
  }

  return (
    <Card title="Support Request" icon={Headphones}>
      <div className="grid gap-3">
        <select value={topic} onChange={(e) => setTopic(e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm">
          <option value="delivery_issue">Delivery issue</option>
          <option value="cod_issue">COD issue</option>
          <option value="pickup_issue">Pickup issue</option>
          <option value="app_issue">App issue</option>
          <option value="emergency">Emergency</option>
        </select>
        <input
          value={pickupId}
          onChange={(e) => setPickupId(e.target.value)}
          placeholder="Pickup/Delivery ID, e.g. P0518-MEL-010 or D0518-MEL-001"
          className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Explain the issue..."
          className="min-h-32 rounded-xl border border-slate-200 bg-white p-4 text-sm"
        />
        <button
          type="button"
          onClick={() => void sendSupport()}
          disabled={!message.trim()}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          Send to Operations
        </button>
      </div>
    </Card>
  );
}

function SyncTab({ snapshot, jobs, pickups, notifications, loading, refresh }: TabProps) {
  return (
    <div className="space-y-4">
      <Card title="Sync Health" icon={Wifi}>
        <div className="grid gap-3 md:grid-cols-4">
          <Metric icon={Truck} label="Pickups" value={pickups.length} />
          <Metric icon={Package} label="Jobs" value={jobs.length} />
          <Metric icon={Bell} label="Notifications" value={notifications.length} />
          <Metric icon={UserRound} label="Account" value={snapshot.account?.workforce_code || "-"} />
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Force Enterprise Sync
        </button>
      </Card>

      <Card title="Data Source" icon={AlertCircle}>
        <div className="space-y-2 text-sm font-bold text-slate-600">
          <Line label="Pickup assignments" value="be_portal_pickup_requests" />
          <Line label="Delivery waybills" value="be_portal_cargo_events" />
          <Line label="Workforce account" value="be_mobile_workforce_accounts" />
          <Line label="Notifications" value="be_app_notifications" />
        </div>
      </Card>
    </div>
  );
}

function JobList({
  jobs,
  onStatus,
  compact = false,
}: {
  jobs: RiderJob[];
  onStatus?: (job: RiderJob, nextStatus: string, payload?: Record<string, unknown>) => Promise<void>;
  compact?: boolean;
}) {
  if (jobs.length === 0) return <EmptyState text="No synchronized jobs found." />;

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <div key={`${job.pickup_id}-${job.deliver_way_id}`} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-mono text-sm font-black text-blue-700">{job.deliver_way_id}</div>
              <div className="mt-1 text-xs font-bold text-slate-400">{job.pickup_id}</div>
            </div>
            <StatusPill status={job.status} />
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <InfoRow label="Recipient" value={job.recipient_name || "Pending Data Entry"} />
            <InfoRow label="Phone" value={job.recipient_phone || "-"} />
            <InfoRow label="Township" value={job.recipient_town || "-"} />
            <InfoRow label="COD" value={money(job.cod_amount || job.final_cod || 0)} />
          </div>

          {!compact && (
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              {job.delivery_address || "No delivery address yet."}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${job.field_pickup_checked ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
              {job.field_pickup_checked ? "Picker Verified" : "Picker Pending"}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${job.data_entry_registration_checked ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              {job.data_entry_registration_checked ? "DE Registered" : "DE Check Pending"}
            </span>
          </div>

          {onStatus && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => void onStatus(job, "in_transit")} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white">
                In Transit
              </button>
              <button onClick={() => void onStatus(job, "delivered")} className="rounded-xl bg-green-600 px-3 py-2 text-xs font-black text-white">
                Delivered
              </button>
              <button onClick={() => void onStatus(job, "failed")} className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white">
                Failed
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Package; label: string; value: string | number }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</div>
        <Icon className="h-5 w-5 text-blue-700" />
      </div>
      <div className="mt-3 text-2xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Package; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-blue-700" />
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}

function StatusPill({ status }: { status?: string }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${statusClass(status)}`}>
      {status || "pending"}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-slate-800">{value}</div>
    </div>
  );
}

function Line({ label, value, strong = false }: { label: string; value: string | number; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3 ${strong ? "font-black text-slate-950" : ""}`}>
      <span>{label}</span>
      <span className="text-right font-black">{value}</span>
    </div>
  );
}
