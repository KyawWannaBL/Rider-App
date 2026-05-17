import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { JobsBoard } from '@/components/shared/JobsBoard';
export default function RiderJobsPage() {
  const [profileOpen, setProfileOpen] = useState(false);
  return (<><AppShell role="rider" onOpenProfile={() => setProfileOpen(true)}><JobsBoard role="rider" /></AppShell><ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} /></>);
}
