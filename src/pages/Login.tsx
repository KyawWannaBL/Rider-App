import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  Globe,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { supabase } from "../integrations/supabase/client";

type View = "password" | "phone_otp" | "email_link" | "otp_verify" | "forgot" | "request";
type Language = "en" | "my";

const SUPABASE_CONFIGURED = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

function getRememberedEmail() {
  return localStorage.getItem("britium.rider.remember.email") || "";
}

function setRememberedEmail(value: string) {
  if (value.trim()) {
    localStorage.setItem("britium.rider.remember.email", value.trim());
  } else {
    localStorage.removeItem("britium.rider.remember.email");
  }
}

function getRememberMe() {
  return localStorage.getItem("britium.rider.remember") === "true";
}

function setRememberMe(value: boolean) {
  localStorage.setItem("britium.rider.remember", value ? "true" : "false");
}

export default function Login() {
  const navigate = useNavigate();

  const [language, setLanguage] = useState<Language>("en");
  const t = (en: string, my: string) => (language === "en" ? en : my);

  const [view, setView] = useState<View>("password");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(getRememberMe());

  const [email, setEmail] = useState(getRememberedEmail());
  const [phone, setPhone] = useState("+959");
  const [password, setPassword] = useState("");
  const [otpToken, setOtpToken] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [logoFailed, setLogoFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const pageTitle = useMemo(() => {
    if (view === "forgot") return t("Secure Password Recovery", "စကားဝှက် ပြန်လည်ရယူခြင်း");
    if (view === "request") return t("Request Rider Access", "Rider ဝင်ရောက်ခွင့် တောင်းမည်");
    if (view === "phone_otp") return t("Phone OTP Login", "ဖုန်း OTP ဖြင့်ဝင်မည်");
    if (view === "email_link") return t("Email Link Login", "အီးမေးလ် Link ဖြင့်ဝင်မည်");
    if (view === "otp_verify") return t("Verify OTP", "OTP အတည်ပြုမည်");
    return t("Rider Sign In", "Rider အကောင့်ဝင်မည်");
  }, [view, language]);

  function clearMessages() {
    setErrorMsg("");
    setSuccessMsg("");
  }

  function goToApp() {
    navigate("/jobs", { replace: true });
  }

  async function loginWithPassword(event: React.FormEvent) {
    event.preventDefault();
    clearMessages();

    if (!SUPABASE_CONFIGURED) {
      setErrorMsg(t("Supabase configuration is missing.", "Supabase config မပြည့်စုံပါ။"));
      return;
    }

    setLoading(true);

    try {
      setRememberMe(remember);
      setRememberedEmail(remember ? email : "");

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setSuccessMsg(t("Login successful. Opening rider jobs…", "အောင်မြင်ပါပြီ။ Rider jobs ဖွင့်နေသည်…"));
      setTimeout(goToApp, 350);
    } catch (error: any) {
      setErrorMsg(error?.message || t("Invalid login credentials.", "အကောင့်ဝင် အချက်အလက်မှားနေသည်။"));
    } finally {
      setLoading(false);
    }
  }

  async function sendPhoneOtp(event: React.FormEvent) {
    event.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phone.trim(),
      });

      if (error) throw error;

      setSuccessMsg(t("OTP sent to your mobile number.", "OTP ကို သင့်ဖုန်းသို့ ပို့ပြီးပါပြီ။"));
      setView("otp_verify");
    } catch (error: any) {
      setErrorMsg(error?.message || t("Unable to send phone OTP.", "ဖုန်း OTP ပို့မရပါ။"));
    } finally {
      setLoading(false);
    }
  }

  async function sendEmailLink(event: React.FormEvent) {
    event.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/jobs`,
        },
      });

      if (error) throw error;

      setSuccessMsg(t("Secure login link sent. Check your email.", "လုံခြုံသော login link ကို ပို့ပြီးပါပြီ။"));
      setView("otp_verify");
    } catch (error: any) {
      setErrorMsg(error?.message || t("Unable to send login link.", "Login link ပို့မရပါ။"));
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(event: React.FormEvent) {
    event.preventDefault();
    clearMessages();

    if (!otpToken.trim()) {
      setErrorMsg(t("Enter OTP code.", "OTP ကုဒ် ထည့်ပါ။"));
      return;
    }

    setLoading(true);

    try {
      const verifyPayload =
        phone && view === "otp_verify" && phone.startsWith("+")
          ? { phone: phone.trim(), token: otpToken.trim(), type: "sms" as const }
          : { email: email.trim(), token: otpToken.trim(), type: "email" as const };

      const { error } = await supabase.auth.verifyOtp(verifyPayload);

      if (error) throw error;

      setSuccessMsg(t("OTP verified. Opening rider jobs…", "OTP အတည်ပြုပြီးပါပြီ။ Rider jobs ဖွင့်နေသည်…"));
      setTimeout(goToApp, 350);
    } catch (error: any) {
      setErrorMsg(error?.message || t("OTP verification failed.", "OTP အတည်ပြုမရပါ။"));
    } finally {
      setLoading(false);
    }
  }

  async function sendRecovery(event: React.FormEvent) {
    event.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) throw error;

      setSuccessMsg(t("Recovery link sent. Please check your email.", "Recovery link ပို့ပြီးပါပြီ။"));
    } catch (error: any) {
      setErrorMsg(error?.message || t("Unable to send recovery link.", "Recovery link ပို့မရပါ။"));
    } finally {
      setLoading(false);
    }
  }

  async function requestAccess(event: React.FormEvent) {
    event.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            requested_app: "rider_app",
            requested_role: "rider",
            phone,
          },
        },
      });

      if (error) throw error;

      setSuccessMsg(t("Request submitted. Admin approval may be required.", "Request တင်ပြီးပါပြီ။ Admin approval လိုနိုင်ပါသည်။"));
      setTimeout(() => setView("password"), 800);
    } catch (error: any) {
      setErrorMsg(error?.message || t("Access request failed.", "Access request မအောင်မြင်ပါ။"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#05080F] p-4 text-slate-100">
      {!videoFailed && (
        <video
          autoPlay
          loop
          muted
          playsInline
          onError={() => setVideoFailed(true)}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20 grayscale"
        >
          <source src="/background.mp4" type="video/mp4" />
        </video>
      )}

      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_20%,rgba(16,185,129,0.16),transparent_60%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,15,0.65),rgba(5,8,15,0.95))]" />

      <button
        type="button"
        onClick={() => setLanguage((current) => (current === "en" ? "my" : "en"))}
        className="absolute right-6 top-6 z-20 inline-flex items-center rounded-full border border-white/10 bg-black/40 px-4 py-2 text-slate-200 hover:bg-white/5"
      >
        <Globe className="mr-2 h-4 w-4" />
        <span className="text-xs font-black uppercase tracking-widest">
          {language === "en" ? "MY" : "EN"}
        </span>
      </button>

      <div className="relative z-10 w-full max-w-md space-y-6 py-10">
        <div className="space-y-2 text-center">
          <div className="mx-auto grid h-28 w-28 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-2xl">
            {!logoFailed ? (
              <img
                src="/logo.png"
                alt="Britium"
                className="h-20 w-20 object-contain"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div className="grid h-20 w-20 place-items-center rounded-2xl bg-emerald-500/10 text-3xl font-black text-emerald-300">
                B
              </div>
            )}
          </div>

          <h1 className="text-4xl font-black tracking-tight text-white">BRITIUM</h1>
          <p className="text-sm text-slate-300">
            {t("Rider App Login", "Rider App အကောင့်ဝင်ခြင်း")}
          </p>
        </div>

        <div className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0B101B]/85 shadow-2xl backdrop-blur-xl">
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-600 to-teal-400" />

          <div className="space-y-5 p-7 md:p-8">
            {errorMsg && (
              <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-300">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-xs font-bold leading-relaxed">{errorMsg}</p>
              </div>
            )}

            {successMsg && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-xs font-bold leading-relaxed">{successMsg}</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <div className="text-sm font-extrabold uppercase tracking-widest">{pageTitle}</div>
            </div>

            <div className="flex gap-2 rounded-2xl border border-white/5 bg-black/40 p-1.5">
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setView("password");
                }}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold ${
                  view === "password" ? "bg-emerald-600 text-white" : "text-slate-400"
                }`}
              >
                {t("Password", "စကားဝှက်")}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setView("phone_otp");
                }}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold ${
                  view === "phone_otp" || view === "otp_verify" ? "bg-[#D4AF37] text-black" : "text-slate-400"
                }`}
              >
                {t("Phone OTP", "ဖုန်း OTP")}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setView("email_link");
                }}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold ${
                  view === "email_link" ? "bg-slate-200 text-black" : "text-slate-400"
                }`}
              >
                {t("Email", "အီးမေးလ်")}
              </button>
            </div>

            {view === "password" && (
              <form onSubmit={loginWithPassword} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                  <input
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 w-full rounded-xl border border-white/10 bg-black/40 pl-12 pr-4 text-white outline-none focus:border-emerald-500/40"
                    placeholder={t("Rider Email", "Rider အီးမေးလ်")}
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 w-full rounded-xl border border-white/10 bg-black/40 pl-12 pr-4 text-white outline-none focus:border-emerald-500/40"
                    placeholder={t("Password", "စကားဝှက်")}
                  />
                </div>

                <div className="flex items-center justify-between px-1">
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold text-slate-300">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-4 w-4 accent-emerald-500"
                    />
                    {t("Remember me", "မှတ်ထားမည်")}
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      clearMessages();
                      setView("forgot");
                    }}
                    className="text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-300"
                  >
                    {t("Forgot?", "မေ့သွားလား")}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-emerald-600 font-black uppercase tracking-widest text-white hover:bg-emerald-500 disabled:opacity-70"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("Authenticating…", "စစ်ဆေးနေသည်…")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {t("Login", "အကောင့်ဝင်မည်")}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </button>
              </form>
            )}

            {view === "phone_otp" && (
              <form onSubmit={sendPhoneOtp} className="space-y-4">
                <div className="relative">
                  <Phone className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                  <input
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-12 w-full rounded-xl border border-white/10 bg-black/40 pl-12 pr-4 text-white outline-none focus:border-emerald-500/40"
                    placeholder="+959..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-[#D4AF37] font-black uppercase tracking-widest text-black hover:bg-[#b5952f] disabled:opacity-70"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Send OTP", "OTP ပို့မည်")}
                </button>
              </form>
            )}

            {view === "email_link" && (
              <form onSubmit={sendEmailLink} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 w-full rounded-xl border border-white/10 bg-black/40 pl-12 pr-4 text-white outline-none focus:border-emerald-500/40"
                    placeholder={t("Rider Email", "Rider အီးမေးလ်")}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-200 font-black uppercase tracking-widest text-black hover:bg-white disabled:opacity-70"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Send Secure Link", "လုံခြုံသော Link ပို့မည်")}
                </button>
              </form>
            )}

            {view === "otp_verify" && (
              <form onSubmit={verifyOtp} className="space-y-4">
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                  <input
                    required
                    maxLength={6}
                    value={otpToken}
                    onChange={(e) => setOtpToken(e.target.value)}
                    className="h-12 w-full rounded-xl border border-white/10 bg-black/40 pl-12 pr-4 text-center font-mono tracking-[0.5em] text-white outline-none"
                    placeholder="000000"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-emerald-600 font-black uppercase tracking-widest text-white hover:bg-emerald-500 disabled:opacity-70"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Verify & Login", "အတည်ပြုပြီး ဝင်မည်")}
                </button>
              </form>
            )}

            {view === "forgot" && (
              <form onSubmit={sendRecovery} className="space-y-4">
                <p className="text-sm text-slate-300">
                  {t("Enter your email to receive a secure recovery link.", "Recovery link ရယူရန် အီးမေးလ်ထည့်ပါ။")}
                </p>

                <div className="relative">
                  <Mail className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 w-full rounded-xl border border-white/10 bg-black/40 pl-12 pr-4 text-white outline-none"
                    placeholder={t("Rider Email", "Rider အီးမေးလ်")}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-700 font-black uppercase tracking-widest text-white hover:bg-slate-600 disabled:opacity-70"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Send Recovery Link", "Recovery Link ပို့မည်")}
                </button>

                <button
                  type="button"
                  onClick={() => setView("password")}
                  className="w-full text-xs font-black uppercase tracking-widest text-slate-400"
                >
                  {t("Back to Login", "Login သို့ ပြန်မည်")}
                </button>
              </form>
            )}

            {view === "request" && (
              <form onSubmit={requestAccess} className="space-y-4">
                <p className="text-sm text-slate-300">
                  {t("Submit a rider account request for admin approval.", "Admin approval အတွက် Rider account request တင်ပါ။")}
                </p>

                <div className="relative">
                  <Mail className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 w-full rounded-xl border border-white/10 bg-black/40 pl-12 pr-4 text-white outline-none"
                    placeholder={t("Work Email", "အလုပ်အီးမေးလ်")}
                  />
                </div>

                <div className="relative">
                  <Phone className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                  <input
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-12 w-full rounded-xl border border-white/10 bg-black/40 pl-12 pr-4 text-white outline-none"
                    placeholder="+959..."
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 w-full rounded-xl border border-white/10 bg-black/40 pl-12 pr-4 text-white outline-none"
                    placeholder={t("New Password", "စကားဝှက်အသစ်")}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-[#D4AF37] font-black uppercase tracking-widest text-black hover:bg-[#b5952f] disabled:opacity-70"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Submit Request", "Request တင်မည်")}
                </button>
              </form>
            )}

            <div className="flex items-center justify-between pt-1 text-[11px] font-black uppercase tracking-widest">
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setView("request");
                }}
                className="flex items-center gap-1 text-[#D4AF37] hover:text-[#b5952f]"
              >
                <UserPlus className="h-3 w-3" />
                {t("Request Access", "အကောင့်လုပ်မည်")}
              </button>

              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setView("password");
                }}
                className="text-slate-400 hover:text-emerald-300"
              >
                {t("Back to Sign In", "Login သို့")}
              </button>
            </div>

            <div className="h-px bg-white/10" />

            <a
              href="/android.apk"
              download="android.apk"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-[11px] font-black uppercase tracking-widest text-white transition-colors hover:bg-white/10"
            >
              <Download className="h-4 w-4 text-emerald-400" />
              {t("Download Android App APK", "Android App APK ဒေါင်းလုပ်")}
            </a>
          </div>
        </div>

        <div className="text-center text-[10px] font-bold text-slate-500 opacity-70">
          © {new Date().getFullYear()} Britium Express • {t("All rights reserved.", "မူပိုင်ခွင့် ရယူထားသည်။")}
        </div>
      </div>
    </div>
  );
}
