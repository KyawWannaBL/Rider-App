import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { SupportPanel } from '@/components/shared/SupportPanel';
export default function DriverSupportPage() {
  const [profileOpen, setProfileOpen] = useState(false);
  return (<><AppShell role="driver" onOpenProfile={() => setProfileOpen(true)}>
    <div className="p-4 md:p-6"><h1 className="text-2xl font-bold text-foreground mb-1">Support</h1><p className="text-sm text-muted-foreground mb-5">Get help and manage support requests</p><SupportPanel role="driver" /></div>
  </AppShell><ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} /></>);
}
