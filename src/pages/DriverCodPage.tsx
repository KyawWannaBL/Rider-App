import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { CodPanel } from '@/components/shared/CodPanel';
import { useAppState } from '@/hooks/useAppState';
import { useRiderDriverData } from '@/hooks/useRiderDriverData';

export default function DriverCodPage() {
  const [profileOpen, setProfileOpen] = useState(false);
  const { currentUser } = useAppState();
  const { codRecords, handoverCod } = useRiderDriverData(currentUser?.id);

  return (
    <>
      <AppShell role="driver" onOpenProfile={() => setProfileOpen(true)}>
        <div className="w-full h-full overflow-y-auto">
          <div className="p-4 md:p-6">
            <div className="mb-5">
              <h1 className="text-2xl font-bold text-foreground">COD Management</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage cash on delivery collections</p>
            </div>
            <CodPanel role="driver" records={codRecords} onHandover={handoverCod} />
          </div>
        </div>
      </AppShell>
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}
