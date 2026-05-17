import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import PortalSyncCenter from '@/components/shared/PortalSyncCenter';
export default function DriverSyncPage() {
  const [profileOpen, setProfileOpen] = useState(false);
  return (<><AppShell role="driver" onOpenProfile={() => setProfileOpen(true)}><PortalSyncCenter role="driver" /></AppShell><ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} /></>);
}
