import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { RiderDashboard } from '@/components/rider/RiderDashboard';
export default function RiderHomePage() {
  const [profileOpen, setProfileOpen] = useState(false);
  return (<><AppShell role="rider" onOpenProfile={() => setProfileOpen(true)}><RiderDashboard /></AppShell><ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} /></>);
}
