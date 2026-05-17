import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { SupportPanel } from '@/components/shared/SupportPanel';
export default function HelperSupportPage() {
  const [o, setO] = useState(false);
  return (<><AppShell role="helper" onOpenProfile={() => setO(true)}>
    <div className="w-full h-full overflow-y-auto"><div className="p-4 pb-24"><SupportPanel role="helper" /></div></div>
  </AppShell><ProfileDrawer open={o} onClose={() => setO(false)} /></>);
}
