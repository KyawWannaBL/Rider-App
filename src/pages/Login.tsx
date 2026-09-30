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
import { supabase, isSupabaseConfigured } from "../integrations/supabase/client";
import { useAppState } from "../hooks/useAppState";
import { riderFeedback } from "../lib/riderFeedback";

type View = "password" | "forgot" | "request";

const SUPABASE_CONFIGURED = isSupabaseConfigured;

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
    <main
      style={{
        minHeight: "100vh",
        minHeight: "100dvh",
        width: "100%",
        boxSizing: "border-box",
        overflowX: "hidden",
        overflowY: "auto",
        margin: 0,
        padding: "64px 16px 24px",
        background: "#07111f",
        color: "#f8fafc",
        fontFamily: "Arial, Helvetica, sans-serif",
        position: "relative",
      }}
    >
      <button
        type="button"
        onClick={() => setLanguage(language === "en" ? "my" : "en")}
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          minWidth: 72,
          minHeight: 44,
          borderRadius: 14,
          border: "1px solid #334155",
          background: "#0f172a",
          color: "#ffffff",
          fontWeight: 800,
          fontSize: 13,
          padding: "8px 12px",
          zIndex: 10,
        }}
      >
        {language === "en" ? "MY" : "EN"}
      </button>

      <div
        style={{
          width: "100%",
          maxWidth: 520,
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          {!logoFailed ? (
            <img
              src="/logo.png"
              alt="Britium"
              onError={() => setLogoFailed(true)}
              style={{
                display: "block",
                width: 72,
                height: 72,
                objectFit: "contain",
                margin: "0 auto",
                borderRadius: 16,
                background: "#ffffff",
                padding: 6,
                boxSizing: "border-box",
              }}
            />
          ) : (
            <div
              style={{
                width: 72,
                height: 72,
                margin: "0 auto",
                borderRadius: 16,
                background: "#0f766e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                fontWeight: 900,
              }}
            >
              B
            </div>
          )}
          <h1 style={{ margin: "12px 0 2px", fontSize: 28, lineHeight: 1.15, color: "#ffffff" }}>BRITIUM</h1>
          <p style={{ margin: 0, color: "#cbd5e1", fontSize: 14, fontWeight: 700 }}>{t("Rider App", "Rider App")}</p>
          <p style={{ margin: "6px 0 0", color: "#22d3ee", fontSize: 10, fontWeight: 900, letterSpacing: "1.5px" }}>
            UI V185 · LEGACY-SAFE TABLET BUILD
          </p>
        </div>

        <section
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "#0b1424",
            border: "1px solid #334155",
            borderRadius: 22,
            boxShadow: "0 16px 38px rgba(0,0,0,.28)",
            overflow: "hidden",
          }}
        >
          <div style={{ height: 6, background: "#f4d66d" }} />
          <div style={{ padding: 22, boxSizing: "border-box" }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ margin: 0, color: "#ffffff", fontSize: 22, lineHeight: 1.25 }}>{pageTitle}</h2>
              <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>
                {t("Approved Britium accounts only", "Approved Britium account များသာ")}
              </p>
            </div>

            {errorMsg && (
              <div style={{ marginBottom: 14, border: "1px solid #be123c", borderRadius: 12, background: "#4c0519", color: "#fecdd3", padding: 12, fontSize: 13, fontWeight: 700 }}>
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div style={{ marginBottom: 14, border: "1px solid #047857", borderRadius: 12, background: "#052e16", color: "#bbf7d0", padding: 12, fontSize: 13, fontWeight: 700 }}>
                {successMsg}
              </div>
            )}

            {view === "password" && (
              <form onSubmit={loginWithPassword}>
                <label style={{ display: "block", marginBottom: 16 }}>
                  <span style={{ display: "block", marginBottom: 7, color: "#cbd5e1", fontSize: 12, fontWeight: 800 }}>
                    {t("Rider Email", "Rider အီးမေးလ်")}
                  </span>
                  <input
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="rider@britiumventures.com"
                    style={{
                      display: "block",
                      width: "100%",
                      minHeight: 52,
                      boxSizing: "border-box",
                      border: "1px solid #64748b",
                      borderRadius: 12,
                      background: "#ffffff",
                      color: "#0f172a",
                      padding: "0 14px",
                      fontSize: 16,
                    }}
                  />
                </label>

                <label style={{ display: "block", marginBottom: 14 }}>
                  <span style={{ display: "block", marginBottom: 7, color: "#cbd5e1", fontSize: 12, fontWeight: 800 }}>
                    {t("Password", "စကားဝှက်")}
                  </span>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      display: "block",
                      width: "100%",
                      minHeight: 52,
                      boxSizing: "border-box",
                      border: "1px solid #64748b",
                      borderRadius: 12,
                      background: "#ffffff",
                      color: "#0f172a",
                      padding: "0 14px",
                      fontSize: 16,
                    }}
                  />
                </label>

                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1", fontSize: 12, fontWeight: 700 }}>
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 18, height: 18 }} />
                    {t("Remember me", "မှတ်ထားမည်")}
                  </label>
                  <button
                    type="button"
                    onClick={() => switchView("forgot")}
                    style={{ minHeight: 40, border: 0, background: "transparent", color: "#67e8f9", fontSize: 12, fontWeight: 800, padding: "6px 0" }}
                  >
                    {t("Forgot password?", "စကားဝှက် မေ့နေပါသလား")}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    display: "block",
                    width: "100%",
                    minHeight: 54,
                    border: 0,
                    borderRadius: 12,
                    background: loading ? "#a78b3f" : "#f4d66d",
                    color: "#07111f",
                    fontWeight: 900,
                    fontSize: 15,
                    padding: "10px 14px",
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? t("Authenticating…", "စစ်ဆေးနေသည်…") : t("Login", "အကောင့်ဝင်မည်")}
                </button>
              </form>
            )}

            {view === "forgot" && (
              <form onSubmit={sendRecovery}>
                <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 }}>
                  {t("Enter your approved Rider email to receive a secure password recovery link.", "Password recovery link ရယူရန် approved Rider အီးမေးလ် ထည့်ပါ။")}
                </p>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rider@britiumventures.com"
                  style={{ display: "block", width: "100%", minHeight: 52, boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 12, background: "#ffffff", color: "#0f172a", padding: "0 14px", fontSize: 16, marginBottom: 14 }}
                />
                <button type="submit" disabled={loading} style={{ width: "100%", minHeight: 52, border: 0, borderRadius: 12, background: "#334155", color: "#ffffff", fontWeight: 900 }}>
                  {t("Send Recovery Link", "Recovery Link ပို့မည်")}
                </button>
                <button type="button" onClick={() => switchView("password")} style={{ width: "100%", minHeight: 44, marginTop: 8, border: 0, background: "transparent", color: "#cbd5e1", fontWeight: 800 }}>
                  {t("Back to Login", "Login သို့ ပြန်မည်")}
                </button>
              </form>
            )}

            {view === "request" && (
              <form onSubmit={requestAccess}>
                <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 }}>
                  {t("Submit a Rider account request for admin approval.", "Admin approval အတွက် Rider account request တင်ပါ။")}
                </p>
                <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder={t("Work Email","အလုပ်အီးမေးလ်")} style={{display:"block",width:"100%",minHeight:52,boxSizing:"border-box",border:"1px solid #64748b",borderRadius:12,background:"#fff",color:"#0f172a",padding:"0 14px",fontSize:16,marginBottom:12}}/>
                <input required value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="+959..." style={{display:"block",width:"100%",minHeight:52,boxSizing:"border-box",border:"1px solid #64748b",borderRadius:12,background:"#fff",color:"#0f172a",padding:"0 14px",fontSize:16,marginBottom:12}}/>
                <input type="password" required minLength={8} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder={t("New Password (min 8 characters)","စကားဝှက်အသစ် (အနည်းဆုံး ၈ လုံး)")} style={{display:"block",width:"100%",minHeight:52,boxSizing:"border-box",border:"1px solid #64748b",borderRadius:12,background:"#fff",color:"#0f172a",padding:"0 14px",fontSize:16,marginBottom:14}}/>
                <button type="submit" disabled={loading} style={{width:"100%",minHeight:52,border:0,borderRadius:12,background:"#f4d66d",color:"#07111f",fontWeight:900}}>
                  {t("Create Account","အကောင့်ဖန်တီးမည်")}
                </button>
                <button type="button" onClick={()=>switchView("password")} style={{width:"100%",minHeight:44,marginTop:8,border:0,background:"transparent",color:"#cbd5e1",fontWeight:800}}>
                  {t("Back to Login","Login သို့ ပြန်မည်")}
                </button>
              </form>
            )}

            {view === "password" && (
              <div style={{ borderTop: "1px solid #334155", marginTop: 20, paddingTop: 16 }}>
                <button
                  type="button"
                  onClick={() => switchView("request")}
                  style={{ width: "100%", minHeight: 46, borderRadius: 12, border: "1px solid #a78b3f", background: "#1f2937", color: "#f4d66d", fontWeight: 800, marginBottom: 10 }}
                >
                  {t("Create Account", "အကောင့်အသစ်ဖန်တီးရန်")}
                </button>
                <a
                  href="/downloads/Britium-Express-Rider.apk?v=v185-legacy-safe"
                  download="Britium-Express-Rider.apk"
                  style={{ display: "flex", width: "100%", minHeight: 46, boxSizing: "border-box", alignItems: "center", justifyContent: "center", borderRadius: 12, border: "1px solid #0891b2", background: "#083344", color: "#cffafe", fontWeight: 800, textDecoration: "none" }}
                >
                  {t("Download Rider APK", "Rider APK ဒေါင်းလုဒ်")}
                </a>
              </div>
            )}
          </div>
        </section>

        <p style={{ margin: "16px 0 0", textAlign: "center", color: "#64748b", fontSize: 11, fontWeight: 700 }}>
          © {new Date().getFullYear()} Britium Express · Field Operations Platform
        </p>
      </div>
    </main>
  );
}
