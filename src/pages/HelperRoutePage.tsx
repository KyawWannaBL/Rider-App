import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { RouteBoard } from '@/components/shared/RouteBoard';
export default function HelperRoutePage() {
  const [o, setO] = useState(false);
  return (<><AppShell role="helper" onOpenProfile={() => setO(true)}>
    <div className="w-full h-full"><RouteBoard role="helper" /></div>
  </AppShell><ProfileDrawer open={o} onClose={() => setO(false)} /></>);
}
