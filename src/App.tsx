// @ts-nocheck
import React from 'react';
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
import CodSettlementPage from "./pages/CodSettlementPage";
import WalletPage from "./pages/WalletPage";
import DocumentsPage from "./pages/DocumentsPage";
import AvailabilityPage from "./pages/AvailabilityPage";
import SupportPage from "./pages/SupportPage";

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

function Guard({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user)   return <Navigate to="/login" replace />;
  return children;
}

function LoginPage() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user)    return <Navigate to="/dashboard" replace />;
  return <Login />;
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Guard><Layout /></Guard>}>
            <Route index               element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"    element={<Dashboard />} />
            <Route path="jobs"         element={<RiderPickupPhotoQrPortal />} />
            <Route path="jobs/:pickupId" element={<RiderPickupPhotoQrPortal />} />
            <Route path="pickup-verification" element={<RiderPickupPhotoQrPortal />} />
            <Route path="history"      element={<History />} />
            <Route path="profile"      element={<Profile />} />
            <Route path="delivery" element={<DeliveryPage />} />
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
