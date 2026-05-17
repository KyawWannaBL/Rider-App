import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import PortalSyncCenter from '@/components/shared/PortalSyncCenter';
export default function RiderSyncPage() {
  const [profileOpen, setProfileOpen] = useState(false);
  return (<><AppShell role="rider" onOpenProfile={() => setProfileOpen(true)}><PortalSyncCenter role="rider" /></AppShell><ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} /></>);
}
