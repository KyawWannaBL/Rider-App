import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { HelperDashboard } from '@/components/helper/HelperDashboard';
export default function HelperHomePage() {
  const [o, setO] = useState(false);
  return (<><AppShell role="helper" onOpenProfile={() => setO(true)}><HelperDashboard /></AppShell><ProfileDrawer open={o} onClose={() => setO(false)} /></>);
}
