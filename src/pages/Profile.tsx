import { useEffect, useMemo, useState } from "react";
import { KeyRound, LogOut, RefreshCw, ShieldCheck, Truck, UserRound, WalletCards } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { useAppState } from "../hooks/useAppState";

function value(...items: any[]) {
  return items.find((item) => item !== null && item !== undefined && String(item).trim() !== "") || "-";
}

export default function Profile() {
  const { language } = useAppState();
  const tx = (en:string,my:string) => language === "my" ? my : en;
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<any>({ identity: {}, workforce: {}, profile: {}, counts: {} });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(language === "my" ? "Rider Profile ကို ဖွင့်နေသည်..." : "Loading Rider profile...");

  async function load() {
    setLoading(true);
    setMessage(tx("Refreshing Rider profile...","Rider Profile ကို ပြန်ဖွင့်နေသည်..."));
    const { data, error } = await (supabase as any).rpc("be_field_profile_snapshot_v91");
    if (error) {
      setMessage(`Unable to load profile: ${error.message}`);
      setLoading(false);
      return;
    }
    setSnapshot(data || { identity: {}, workforce: {}, profile: {}, counts: {} });
    setMessage(tx("Profile synchronized with the authenticated workforce account.","Profile ကို အတည်ပြုထားသော Workforce အကောင့်နှင့် ချိတ်ဆက်ပြီးပါပြီ။"));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  async function sendPasswordReset() {
    const email = value(snapshot.identity?.email, snapshot.workforce?.email, snapshot.profile?.email);
    if (!email || email === "-") {
      setMessage("No account email is available for password recovery.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(String(email), {
      redirectTo: `${window.location.origin}/#/login`,
    });
    setMessage(error ? `Unable to send password recovery: ${error.message}` : "Password recovery email sent.");
    setLoading(false);
  }

  const identity = snapshot.identity || {};
  const workforce = snapshot.workforce || {};
  const profile = snapshot.profile || {};
  const canonical = snapshot.canonical || {};
  const counts = snapshot.counts || {};

  const displayName = useMemo(
    () => value(canonical.display_name, identity.display_name, workforce.display_name, workforce.full_name, workforce.name, profile.full_name, identity.worker_code),
    [canonical, identity, workforce, profile]
  );

  const details = [
    [tx("Username","အသုံးပြုသူအမည်"), value(canonical.username, workforce.account, workforce.account_code, identity.worker_code)],
    [tx("Email","အီးမေးလ်"), value(canonical.email, identity.email, workforce.email, workforce.user_email, profile.email)],
    [tx("Workforce Code","ဝန်ထမ်းကုဒ်"), value(canonical.worker_code, identity.worker_code, workforce.workforce_code, workforce.worker_code, workforce.rider_code)],
    [tx("Role","တာဝန်"), value(canonical.role, identity.role, workforce.role, workforce.role_type, profile.role)],
    [tx("Phone","ဖုန်း"), value(workforce.phone_primary, workforce.phone_e164, workforce.phone, workforce.phone_number, profile.phone)],
    [tx("Branch","ဌာနခွဲ"), value(canonical.branch_code, identity.branch_code, workforce.branch_code, workforce.assigned_branch, profile.branch_name)],
    [tx("Assigned Zone","တာဝန်ပေးဇုန်"), value(canonical.assigned_zone, identity.assigned_zone, workforce.assigned_zone, workforce.zone_code, workforce.zone, profile.zone)],
    [tx("Employment Type","အလုပ်အကိုင်အမျိုးအစား"), value(workforce.employment_type)],
    [tx("Account Status","အကောင့်အခြေအနေ"), value(workforce.status, profile.status, workforce.is_active === false ? "INACTIVE" : "ACTIVE")],
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-blue-800 p-6 text-white sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-white/10 ring-1 ring-white/20">
                  <UserRound className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">BRITIUM EXPRESS</p>
                  <h1 className="mt-2 text-3xl font-black">{displayName}</h1>
                  <p className="mt-1 text-sm font-bold text-slate-300">
                    {value(identity.worker_code)} · {String(value(identity.role)).toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                onClick={load}
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 text-sm font-black ring-1 ring-white/20 hover:bg-white/15 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {tx("Refresh Profile","Profile ပြန်ဖွင့်ရန်")}
              </button>
            </div>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [tx("Assigned Jobs","တာဝန်ပေးထားသောအလုပ်"), counts.jobs],
              [tx("Pickup Jobs","Pickup အလုပ်"), counts.pickup_jobs],
              [tx("Delivery Jobs","ပို့ဆောင်ရေးအလုပ်"), counts.delivery_jobs],
              [tx("Notifications","အသိပေးချက်"), counts.notifications],
            ].map(([label, number]) => (
              <div key={label} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-black text-slate-950">{Number(number || 0).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-blue-700" />
              <div>
                <h2 className="text-xl font-black text-slate-950">{tx("Account & Assignment","အကောင့်နှင့် တာဝန်ပေးမှု")}</h2>
                <p className="text-sm font-semibold text-slate-500">{tx("Authenticated workforce identity and operational assignment.","အတည်ပြုထားသော ဝန်ထမ်းအချက်အလက်နှင့် လုပ်ငန်းတာဝန်ပေးမှု။")}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {details.map(([label, item]) => (
                <div key={label} className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
                  <p className="mt-2 break-words font-black text-slate-900">{String(item)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <Truck className="h-6 w-6 text-blue-700" />
                <h2 className="text-lg font-black text-slate-950">{tx("Vehicle","ယာဉ်")}</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4"><span className="font-bold text-slate-500">Type</span><b>{String(value(workforce.vehicle_type))}</b></div>
                <div className="flex justify-between gap-4"><span className="font-bold text-slate-500">Vehicle Code</span><b>{String(value(workforce.vehicle_code))}</b></div>
                <div className="flex justify-between gap-4"><span className="font-bold text-slate-500">Plate</span><b>{String(value(workforce.license_plate, profile.vehicle_plate))}</b></div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <WalletCards className="h-6 w-6 text-blue-700" />
                <h2 className="text-lg font-black text-slate-950">{tx("Account Actions","အကောင့်လုပ်ဆောင်ချက်များ")}</h2>
              </div>
              <div className="mt-4 grid gap-3">
                <button
                  onClick={() => navigate("/wallet")}
                  className="flex h-11 items-center justify-center rounded-2xl bg-blue-700 px-4 text-sm font-black text-white"
                >
                  {tx("Open Rider Wallet","Rider ငွေစာရင်း ဖွင့်ရန်")}
                </button>
                <button
                  onClick={sendPasswordReset}
                  disabled={loading}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-700 disabled:opacity-50"
                >
                  <KeyRound className="h-4 w-4" />
                  {tx("Send Password Recovery","စကားဝှက်ပြန်လည်ရယူရန် ပို့ရန်")}
                </button>
                <button
                  onClick={signOut}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 text-sm font-black text-white"
                >
                  <LogOut className="h-4 w-4" />
                  {tx("Sign Out","အကောင့်မှထွက်ရန်")}
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="rounded-2xl bg-blue-50 p-4 text-sm font-bold text-blue-900">{message}</div>
      </div>
    </div>
  );
}
