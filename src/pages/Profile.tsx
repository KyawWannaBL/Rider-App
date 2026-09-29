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
  const [editMode,setEditMode]=useState(false);
  const [identityDialog,setIdentityDialog]=useState<"same-person"|"new-account"|null>(null);
  const [editForm,setEditForm]=useState({full_name:"",phone:""});

  async function load() {
    setLoading(true);
    setMessage(tx("Refreshing Rider profile...","Rider Profile ကို ပြန်ဖွင့်နေသည်..."));
    const { data, error } = await (supabase as any).rpc("be_field_profile_snapshot_v91");
    if (error) {
      setMessage(`Unable to load profile: ${error.message}`);
      setLoading(false);
      return;
    }
    const next=data || { identity: {}, workforce: {}, profile: {}, counts: {} };
    setSnapshot(next);
    setEditForm({
      full_name:String(next?.canonical?.display_name || next?.identity?.display_name || next?.workforce?.display_name || next?.workforce?.full_name || next?.profile?.full_name || ""),
      phone:String(next?.workforce?.phone_primary || next?.workforce?.phone_e164 || next?.workforce?.phone || next?.profile?.phone || "")
    });
    setMessage(tx("Profile synchronized with the authenticated workforce account.","Profile ကို အတည်ပြုထားသော Workforce အကောင့်နှင့် ချိတ်ဆက်ပြီးပါပြီ။"));
    setLoading(false);
  }

  async function saveProfile(){
    setLoading(true);
    setMessage(tx("Saving profile changes...","Profile အပြောင်းအလဲများကို သိမ်းနေသည်..."));
    const {data,error}=await (supabase as any).rpc("be_field_profile_update_v1",{
      p_full_name:editForm.full_name.trim()||null,
      p_phone:editForm.phone.trim()||null,
    });
    if(error || data?.ok===false){
      setMessage(error?.message || data?.error || tx("Unable to update profile.","Profile အချက်အလက် ပြင်ဆင်၍မရပါ။"));
      setLoading(false);
      return;
    }
    setMessage(tx("Profile synchronized to the workforce master and assignment system.","Profile ကို Workforce Master နှင့် Assignment System သို့ ချိတ်ဆက်သိမ်းဆည်းပြီးပါပြီ။"));
    setEditMode(false);
    await load();
  }

  useEffect(() => { load(); }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  function beginEditFlow(){
    if(editMode){
      setEditMode(false);
      return;
    }
    setIdentityDialog("same-person");
  }

  function confirmSamePerson(){
    setIdentityDialog(null);
    setEditMode(true);
    setMessage("လက်ရှိအကောင့်၏ Worker Code / User ID ကို မပြောင်းဘဲ အမည်နှင့် ကိုယ်ရေးအချက်အလက်ကိုသာ ပြင်ဆင်ပါမည်။ ယခင်လုပ်ငန်းမှတ်တမ်းများကို မဖျက်ဘဲ ဤအကောင့်နှင့် ဆက်လက်ချိတ်ဆက်ထားပါမည်။");
  }

  function rejectSamePerson(){
    setIdentityDialog("new-account");
  }

  async function createSeparateAccount(){
    setIdentityDialog(null);
    setMessage("လက်ရှိအကောင့်နှင့် ယခင်မှတ်တမ်းများကို မပြောင်းလဲပါ။ လူအသစ်အတွက် အကောင့်အသစ်ဖန်တီးရန် Create Account စာမျက်နှာသို့ ပို့နေပါသည်။");
    await supabase.auth.signOut();
    navigate("/login?view=request", { replace: true });
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
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={beginEditFlow}
                  disabled={loading}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-4 text-sm font-black text-blue-900 disabled:opacity-50"
                >
                  {editMode?tx("Cancel Edit","ပြင်ဆင်မှု ပယ်ဖျက်ရန်"):tx("Edit Profile","အမည်/အချက်အလက် ပြင်ဆင်ရန်")}
                </button>
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
            {editMode && (
              <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <h3 className="font-black text-blue-950">{tx("Editable Personal Information","ပြင်ဆင်နိုင်သော ကိုယ်ရေးအချက်အလက်")}</h3>
                <p className="mt-1 text-xs font-bold text-blue-700">{tx("Name and phone synchronize to the same authenticated workforce identity. Historical operational records remain linked to the existing Worker Code/User ID.","အမည်နှင့် ဖုန်းနံပါတ်ကို လက်ရှိ Workforce Identity တစ်ခုတည်းအတွင်း ပြင်ဆင်ပါမည်။ ယခင်လုပ်ငန်းမှတ်တမ်းများကို မဖျက်ဘဲ လက်ရှိ Worker Code / User ID နှင့် ဆက်လက်ချိတ်ဆက်ထားပါမည်။")}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-black text-slate-600">{tx("Full Name","အမည်အပြည့်အစုံ")}<input value={editForm.full_name} onChange={(e)=>setEditForm({...editForm,full_name:e.target.value})} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-blue-500"/></label>
                  <label className="text-xs font-black text-slate-600">{tx("Phone","ဖုန်း")}<input value={editForm.phone} onChange={(e)=>setEditForm({...editForm,phone:e.target.value})} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-blue-500"/></label>
                </div>
                <button onClick={()=>void saveProfile()} disabled={loading || (!editForm.full_name.trim()&&!editForm.phone.trim())} className="mt-4 h-11 w-full rounded-xl bg-blue-700 px-4 text-sm font-black text-white disabled:opacity-50">{loading?tx("Saving...","သိမ်းနေသည်..."):tx("Save + Synchronize Profile","Profile သိမ်းပြီး ချိတ်ဆက်မည်")}</button>
              </div>
            )}
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

      {identityDialog === "same-person" && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[30px] border border-white/20 bg-white shadow-[0_30px_90px_rgba(2,6,23,.35)]">
            <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-5 text-white">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">အကောင့်အတည်ပြုခြင်း</p>
              <h2 className="mt-2 text-xl font-black">လက်ရှိလူတစ်ဦးတည်း၏ အချက်အလက်ပြင်ဆင်မှု ဟုတ်ပါသလား?</h2>
            </div>
            <div className="p-5">
              <p className="text-sm font-bold leading-6 text-slate-700">
                ယခု ပြင်ဆင်မည့် အမည်နှင့် အချက်အလက်များသည် <b>{String(displayName)}</b> ၏ လက်ရှိအကောင့်ကိုသာ ပြင်ဆင်ခြင်း ဖြစ်ပါသလား?
              </p>
              <p className="mt-3 rounded-2xl bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-800">
                “ဟုတ်ကဲ့” ကိုရွေးပါက Worker Code / User ID ကို မပြောင်းဘဲ အမည်အသစ်နှင့် အချက်အလက်အသစ်ကိုသာ ပြင်ဆင်မည်ဖြစ်ပြီး ယခင်လုပ်ငန်းမှတ်တမ်းများကို မဖျက်ဘဲ ဆက်လက်ထိန်းသိမ်းထားပါမည်။
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" onClick={rejectSamePerson} className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 font-black text-slate-700">
                  မဟုတ်ပါ
                </button>
                <button type="button" onClick={confirmSamePerson} className="min-h-12 rounded-2xl bg-gradient-to-r from-[#d4af37] to-[#f4d66d] px-4 font-black text-slate-950 shadow-lg">
                  ဟုတ်ကဲ့၊ ပြင်ဆင်မည်
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {identityDialog === "new-account" && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[30px] border border-white/20 bg-white shadow-[0_30px_90px_rgba(2,6,23,.35)]">
            <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-5 text-white">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f4d66d]">အကောင့်အသစ်</p>
              <h2 className="mt-2 text-xl font-black">လူအသစ်အတွက် အကောင့်အသစ် ဖန်တီးလိုပါသလား?</h2>
            </div>
            <div className="p-5">
              <p className="text-sm font-bold leading-6 text-slate-700">
                လူအသစ်ဖြစ်ပါက လက်ရှိအကောင့်၏ အမည်နှင့် အချက်အလက်များကို မပြောင်းပါ။ လက်ရှိအကောင့်နှင့် ယခင်သမိုင်းမှတ်တမ်းများကို မူလအတိုင်း ထိန်းသိမ်းထားပါမည်။
              </p>
              <p className="mt-3 rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
                အကောင့်အသစ်ကို ဤ Profile စာမျက်နှာမှ မဖန်တီးပါ။ “အကောင့်အသစ်ဖန်တီးရန်” ကိုနှိပ်ပြီး Create Account စာမျက်နှာတွင်သာ ဖန်တီးပါ။
              </p>
              <div className="mt-5 grid gap-3">
                <button type="button" onClick={createSeparateAccount} className="min-h-12 rounded-2xl bg-gradient-to-r from-[#d4af37] to-[#f4d66d] px-4 font-black text-slate-950 shadow-lg">
                  အကောင့်အသစ်ဖန်တီးရန်
                </button>
                <button type="button" onClick={()=>setIdentityDialog(null)} className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 font-black text-slate-700">
                  မဖန်တီးတော့ပါ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
