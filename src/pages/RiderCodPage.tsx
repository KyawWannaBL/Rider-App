import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { CodPanel } from '@/components/shared/CodPanel';
import { useAppState } from '@/hooks/useAppState';
import { useRiderDriverData } from '@/hooks/useRiderDriverData';
export default function RiderCodPage() {
  const [profileOpen, setProfileOpen] = useState(false);
  const { currentUser } = useAppState();
  const { codRecords, handoverCod } = useRiderDriverData(currentUser?.id);
  return (<><AppShell role="rider" onOpenProfile={() => setProfileOpen(true)}>
    <div className="p-4"><h1 className="text-2xl font-black text-foreground mb-1">COD Management</h1><p className="text-sm text-muted-foreground mb-5">Manage cash on delivery collections</p><CodPanel role="rider" records={codRecords} onHandover={handoverCod} /></div>
  </AppShell><ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} /></>);
}
