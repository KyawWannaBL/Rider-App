import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { DriverDashboard } from '@/components/driver/DriverDashboard';
export default function DriverHomePage() {
  const [profileOpen, setProfileOpen] = useState(false);
  return (<><AppShell role="driver" onOpenProfile={() => setProfileOpen(true)}><DriverDashboard /></AppShell><ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} /></>);
}
