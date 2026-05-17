import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { SupportPanel } from '@/components/shared/SupportPanel';
export default function RiderSupportPage() {
  const [profileOpen, setProfileOpen] = useState(false);
  return (<><AppShell role="rider" onOpenProfile={() => setProfileOpen(true)}>
    <div className="p-4 pb-24"><SupportPanel role="rider" /></div>
  </AppShell><ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} /></>);
}
