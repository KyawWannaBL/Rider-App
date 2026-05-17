import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import PortalSyncCenter from '@/components/shared/PortalSyncCenter';
export default function HelperSyncPage() {
  const [o, setO] = useState(false);
  return (<><AppShell role="helper" onOpenProfile={() => setO(true)}><PortalSyncCenter role="helper" /></AppShell><ProfileDrawer open={o} onClose={() => setO(false)} /></>);
}
