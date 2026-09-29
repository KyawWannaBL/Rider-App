import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
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
import { useAppState } from "../hooks/useAppState";
import { riderFeedback } from "../lib/riderFeedback";

type View = "password" | "forgot" | "request";

const SUPABASE_CONFIGURED = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

function getRememberedEmail() {
  return localStorage.getItem("britium.rider.remember.email") || "";
}

function setRememberedEmail(value: string) {
  if (value.trim()) localStorage.setItem("britium.rider.remember.email", value.trim());
  else localStorage.removeItem("britium.rider.remember.email");
}

function getRememberMe() {
  return localStorage.getItem("britium.rider.remember") === "true";
}

function setRememberMe(value: boolean) {
  localStorage.setItem("britium.rider.remember", value ? "true" : "false");
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage } = useAppState();
  const initialView: View = new URLSearchParams(location.search).get("view") === "request" ? "request" : "password";
  const [view, setView] = useState<View>(initialView);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(getRememberMe());
  const [email, setEmail] = useState(getRememberedEmail());
  const [phone, setPhone] = useState("+959");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [logoFailed, setLogoFailed] = useState(false);

  const t = (en: string, my: string) => (language === "en" ? en : my);

  const pageTitle = useMemo(() => {
    if (view === "forgot") return t("Secure Password Recovery", "စကားဝှက် ပြန်လည်ရယူခြင်း");
    if (view === "request") return t("Request Rider Access", "Rider ဝင်ရောက်ခွင့် တောင်းမည်");
    return t("Rider Sign In", "Rider အကောင့်ဝင်မည်");
  }, [view, language]);

  function clearMessages() {
    setErrorMsg("");
    setSuccessMsg("");
  }

  function switchView(next: View) {
    clearMessages();
    setView(next);
  }

  async function loginWithPassword(event: React.FormEvent) {
    event.preventDefault();
    clearMessages();

    if (!SUPABASE_CONFIGURED) {
      setErrorMsg(t("Authentication configuration is missing.", "Authentication config မပြည့်စုံပါ။"));
      return;
    }

    setLoading(true);
    try {
      setRememberMe(remember);
      setRememberedEmail(remember ? email : "");

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;

      riderFeedback("success");
      setSuccessMsg(t("Login successful. Opening Rider jobs…", "အောင်မြင်ပါပြီ။ Rider jobs ဖွင့်နေသည်…"));
      window.setTimeout(() => navigate("/jobs", { replace: true }), 250);
    } catch (error: any) {
      riderFeedback("error");
      setErrorMsg(error?.message || t("Invalid login credentials.", "အကောင့်ဝင် အချက်အလက်မှားနေသည်။"));
    } finally {
      setLoading(false);
    }
  }

  async function sendRecovery(event: React.FormEvent) {
    event.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/#/login`,
      });
      if (error) throw error;
      riderFeedback("success");
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
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            requested_app: "rider_app",
            requested_role: "rider",
            phone: phone.trim(),
          },
        },
      });
      if (error) throw error;

      riderFeedback("success");
      setSuccessMsg(t(
        "Request submitted. Admin approval may be required.",
        "Request တင်ပြီးပါပြီ။ Admin approval လိုနိုင်ပါသည်။"
      ));
    } catch (error: any) {
      setErrorMsg(error?.message || t("Access request failed.", "Access request မအောင်မြင်ပါ။"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="v142-shell-bg be-screen-shell relative min-h-screen min-h-[100dvh] overflow-x-hidden overflow-y-auto text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,#020617_0%,#07111f_42%,#082f49_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(2,6,23,.96),rgba(7,17,31,.88)_45%,rgba(8,47,73,.78))]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(34,211,238,.16),transparent_35%)]" />

      <button
        type="button"
        onClick={() => setLanguage(language === "en" ? "my" : "en")}
        className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 text-xs font-black uppercase tracking-wider text-slate-100 backdrop-blur-md hover:bg-white/10 sm:right-6 sm:top-6 sm:px-4"
      >
        <Globe className="h-4 w-4" />
        {language === "en" ? "MY" : "EN"}
      </button>

      <div className="rider-login-grid relative z-10 mx-auto grid min-h-screen min-h-[100dvh] w-full max-w-6xl items-center gap-5 px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(4rem,env(safe-area-inset-top))] sm:px-5 sm:py-8 md:px-6 lg:grid-cols-[1.05fr_.95fr] lg:gap-8 lg:px-8 lg:py-10">
        <motion.section initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .5 }} className="rider-login-desktop-intro hidden lg:block">
          <div className="max-w-xl">
            <div className="mb-7 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md">
              {!logoFailed ? (
                <img
                  src="/logo.png"
                  alt="Britium"
                  className="h-12 w-12 rounded-xl bg-white object-contain p-1"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-500/15 text-xl font-black text-emerald-300">B</div>
              )}
              <div>
                <div className="text-xl font-black tracking-wide">BRITIUM</div>
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Rider Operations</div>
              </div>
            </div>

            <h1 className="text-5xl font-black leading-tight text-white">
              {t("Fast, secure field operations.", "မြန်ဆန် လုံခြုံသော Rider လုပ်ငန်းစနစ်")}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
              {t(
                "Sign in with your approved Britium Rider account to access pickup verification, delivery workflow, route controls and COD handover.",
                "Approved Britium Rider account ဖြင့် ဝင်ရောက်ပြီး pickup verification, delivery workflow, route controls နှင့် COD handover ကို အသုံးပြုနိုင်ပါသည်။"
              )}
            </p>

            <div className="mt-8 grid max-w-lg grid-cols-2 gap-3 text-sm">
              {[
                t("Pickup verification", "Pickup စစ်ဆေးခြင်း"),
                t("Strict delivery proof", "Delivery proof"),
                t("GPS arrival control", "GPS arrival control"),
                t("COD settlement", "COD settlement"),
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-bold text-slate-200 backdrop-blur-sm">
                  <CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 18, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .42, delay: .06 }} className="rider-login-card mx-auto w-full max-w-md px-0 sm:max-w-lg lg:max-w-md">
          <div className="rider-login-mobile-brand mb-4 text-center sm:mb-6 lg:hidden">
            {!logoFailed ? (
              <img
                src="/logo.png"
                alt="Britium"
                className="mx-auto h-16 w-16 rounded-2xl bg-white object-contain p-2 shadow-2xl sm:h-20 sm:w-20"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-emerald-500/15 text-3xl font-black text-emerald-300">B</div>
            )}
            <h1 className="mt-3 text-2xl font-black tracking-tight sm:mt-4 sm:text-3xl">BRITIUM</h1>
            <p className="mt-1 text-sm font-semibold text-slate-300">{t("Rider App", "Rider App")}</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">UI V181 · Responsive Tablet Build</p>
          </div>

          <div className="v142-panel overflow-hidden rounded-[30px] border border-white/10 shadow-2xl backdrop-blur-xl">
            <div className="h-1.5 bg-gradient-to-r from-[#d4af37] via-[#f4d66d] to-cyan-400" />
            <div className="p-4 min-[360px]:p-5 sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">{pageTitle}</h2>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    {t("Approved Britium accounts only", "Approved Britium account များသာ")}
                  </p>
                </div>
              </div>

              {errorMsg && (
                <div className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm font-bold text-rose-200">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-200">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {view === "password" && (
                <form onSubmit={loginWithPassword} className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">
                      {t("Rider Email", "Rider အီးမေးလ်")}
                    </span>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                      <input
                        type="email"
                        required
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 pl-12 pr-4 text-sm text-white outline-none transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10"
                        placeholder="rider@britiumventures.com"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">
                      {t("Password", "စကားဝှက်")}
                    </span>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                      <input
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 pl-12 pr-4 text-sm text-white outline-none transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10"
                        placeholder="••••••••"
                      />
                    </div>
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-3 py-1">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-300">
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
                      onClick={() => switchView("forgot")}
                      className="min-h-0 text-right text-xs font-black text-cyan-300 hover:text-cyan-200"
                    >
                      {t("Forgot password?", "စကားဝှက် မေ့နေပါသလား")}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="v142-button-sheen v142-jelly flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#d4af37] via-[#f4d66d] to-[#d4af37] px-4 font-black uppercase tracking-wider text-slate-950 shadow-[0_16px_38px_rgba(212,175,55,.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                    {loading ? t("Authenticating…", "စစ်ဆေးနေသည်…") : t("Login", "အကောင့်ဝင်မည်")}
                  </button>
                </form>
              )}

              {view === "forgot" && (
                <form onSubmit={sendRecovery} className="space-y-4">
                  <p className="text-sm leading-6 text-slate-300">
                    {t("Enter your approved Rider email to receive a secure password recovery link.", "Password recovery link ရယူရန် approved Rider အီးမေးလ် ထည့်ပါ။")}
                  </p>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none focus:border-cyan-400/60"
                    placeholder="rider@britiumventures.com"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-700 px-4 font-black text-white hover:bg-slate-600 disabled:opacity-60"
                  >
                    {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                    {t("Send Recovery Link", "Recovery Link ပို့မည်")}
                  </button>
                  <button type="button" onClick={() => switchView("password")} className="flex h-10 w-full items-center justify-center gap-2 text-xs font-black text-slate-400 hover:text-white">
                    <ArrowLeft className="h-4 w-4" />
                    {t("Back to Login", "Login သို့ ပြန်မည်")}
                  </button>
                </form>
              )}

              {view === "request" && (
                <form onSubmit={requestAccess} className="space-y-4">
                  <p className="text-sm leading-6 text-slate-300">
                    {t("Submit a Rider account request for admin approval.", "Admin approval အတွက် Rider account request တင်ပါ။")}
                  </p>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none focus:border-cyan-400/60"
                    placeholder={t("Work Email", "အလုပ်အီးမေးလ်")}
                  />
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                    <input
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 pl-12 pr-4 text-sm text-white outline-none focus:border-cyan-400/60"
                      placeholder="+959..."
                    />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none focus:border-cyan-400/60"
                    placeholder={t("New Password (min 8 characters)", "စကားဝှက်အသစ် (အနည်းဆုံး ၈ လုံး)")}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#d4af37] px-4 font-black text-slate-950 hover:bg-[#e3c45f] disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
                    {t("Create Account", "အကောင့်ဖန်တီးမည်")}
                  </button>
                  <button type="button" onClick={() => switchView("password")} className="flex h-10 w-full items-center justify-center gap-2 text-xs font-black text-slate-400 hover:text-white">
                    <ArrowLeft className="h-4 w-4" />
                    {t("Back to Login", "Login သို့ ပြန်မည်")}
                  </button>
                </form>
              )}

              {view === "password" && (
                <>
                  <div className="my-6 h-px bg-white/10" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => switchView("request")}
                      className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#d4af37]/30 bg-[#d4af37]/10 px-3 text-xs font-black text-[#f4d66d] hover:bg-[#d4af37]/15"
                    >
                      <UserPlus className="h-4 w-4" />
                      {t("Create Account", "အကောင့်အသစ်ဖန်တီးရန်")}
                    </button>
                    <a
                      href="/downloads/Britium-Express-Rider.apk?v=5458a4a-v181-tablet"
                      download="Britium-Express-Rider.apk"
                      className="v142-jelly flex h-11 items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 text-xs font-black text-cyan-100 transition hover:-translate-y-0.5 hover:bg-cyan-400/15 hover:shadow-[0_12px_28px_rgba(34,211,238,.12)]"
                    >
                      <Download className="h-4 w-4 text-cyan-300" />
                      {t("Download Rider APK", "Rider APK ဒေါင်းလုဒ်")}
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>

          <p className="mt-5 text-center text-[11px] font-semibold text-slate-500">
            © {new Date().getFullYear()} Britium Express · {t("Field Operations Platform", "Field Operations Platform")}
          </p>
        </motion.section>
      </div>
    </main>
  );
}
