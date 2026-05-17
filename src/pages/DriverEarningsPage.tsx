import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ROUTE_PATHS } from '@/lib/index';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { EarningsPanel } from '@/components/shared/EarningsPanel';
import { Button } from '@/components/ui/button';
export default function DriverEarningsPage() {
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  return (<><AppShell role="driver" onOpenProfile={() => setProfileOpen(true)}>
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border"><Button variant="ghost" size="icon" onClick={() => navigate(ROUTE_PATHS.DRIVER)}><ArrowLeft className="h-5 w-5"/></Button><h1 className="text-lg font-semibold text-foreground">Earnings</h1></div>
      <div className="flex-1 overflow-y-auto"><EarningsPanel role="driver" /></div>
    </div>
  </AppShell><ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} /></>);
}
