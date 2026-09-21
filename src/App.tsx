// @ts-nocheck
import React from 'react';
import { RefreshCw, LogOut, WifiOff } from "lucide-react";
import { useAppState } from "@/hooks/useAppState";
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Layout    from '@/components/Layout';
import Login     from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Jobs      from '@/pages/Jobs';
import JobDetail from '@/pages/JobDetail';
import History   from '@/pages/History';
import Profile   from '@/pages/Profile';
import RiderPickupPhotoQrPortal from "./pages/RiderPickupPhotoQrPortal";
import DeliveryPage from "./pages/DeliveryPage";
import CodSettlementPage from "./pages/CodSettlementPageForVercel";
import WalletPage from "./pages/WalletPage";
import DocumentsPage from "./pages/DocumentsPage";
import AvailabilityPage from "./pages/AvailabilityPage";
import SupportPage from "./pages/SupportPage";
import BranchOfficeSyncPage from "./pages/BranchOfficeSyncPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";

function Splash() {
  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: 'linear-gradient(135deg,#f59e0b,#d97706)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, fontWeight: 900, color: '#0f172a',
        boxShadow: '0 8px 32px rgba(245,158,11,0.4)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}>B</div>
      <p style={{ color: '#475569', fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', margin: 0 }}>
        BRITIUM RIDER
      </p>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}

function ConnectionIssue() {
  const { authError, refreshProfile, signOut } = useAuth();
  const { language, toggleLanguage } = useAppState();
  const tx = (en: string, my: string) => language === "my" ? my : en;

  return (
    <div className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center">
        <section className="relative w-full rounded-3xl border border-white/10 bg-white/5 p-7 text-center shadow-2xl">
          <button type="button" onClick={toggleLanguage} className="absolute right-4 top-4 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-black">
            {language === "my" ? "English" : "မြန်မာ"}
          </button>
          <div className="mx-auto mt-4 grid h-20 w-20 place-items-center rounded-3xl bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/20">
            <WifiOff className="h-10 w-10" />
          </div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.3em] text-blue-300">BRITIUM EXPRESS</p>
          <h1 className="mt-2 text-2xl font-black">{tx("Enterprise Connection Error","Enterprise ချိတ်ဆက်မှု အမှား")}</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
            {authError || tx("Unable to connect to Britium Enterprise.","Britium Enterprise နှင့် ချိတ်ဆက်မရပါ။")}
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            {tx("Your approval status has not been changed. Retry the connection or sign in again.","သင့်အကောင့်အတည်ပြုမှုအခြေအနေ မပြောင်းလဲသေးပါ။ ချိတ်ဆက်မှုကို ပြန်စမ်းပါ သို့မဟုတ် ပြန်ဝင်ပါ။")}
          </p>
          <div className="mt-6 grid gap-3">
            <button onClick={refreshProfile} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 font-black">
              <RefreshCw className="h-4 w-4" /> {tx("Retry Enterprise Connection","Enterprise ချိတ်ဆက်မှု ပြန်စမ်းရန်")}
            </button>
            <button onClick={signOut} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 font-black text-rose-200">
              <LogOut className="h-4 w-4" /> {tx("Sign Out","အကောင့်မှထွက်ရန်")}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Guard({ children }) {
  const { user, profile, profileState, loading } = useAuth();
  if (loading || profileState === "checking") return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (profileState === "error") return <ConnectionIssue />;
  if (profileState === "unapproved") return <Navigate to="/pending-approval" replace />;
  if (!profile) return <ConnectionIssue />;
  return children;
}

function LoginPage() {
  const { user, profile, profileState, loading } = useAuth();
  if (loading || (user && profileState === "checking")) return <Splash />;
  if (user && profileState === "approved" && profile) return <Navigate to="/dashboard" replace />;
  if (user && profileState === "error") return <ConnectionIssue />;
  if (user && profileState === "unapproved") return <Navigate to="/pending-approval" replace />;
  return <Login />;
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/pending-approval" element={<PendingApprovalPage />} />
          <Route path="/" element={<Guard><Layout /></Guard>}>
            <Route index               element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"    element={<Dashboard />} />
            <Route path="jobs"         element={<RiderPickupPhotoQrPortal />} />
            <Route path="jobs/:pickupId" element={<RiderPickupPhotoQrPortal />} />
            <Route path="pickup-verification" element={<RiderPickupPhotoQrPortal />} />
            <Route path="history"      element={<History />} />
            <Route path="profile"      element={<Profile />} />
            <Route path="delivery" element={<DeliveryPage />} />
            <Route path="branch-sync" element={<BranchOfficeSyncPage />} />
            <Route path="cod-settlement" element={<CodSettlementPage />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="availability" element={<AvailabilityPage />} />
            <Route path="support" element={<SupportPage />} />

          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}
