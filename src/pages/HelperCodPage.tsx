import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { CodPanel } from '@/components/shared/CodPanel';
import { useAppState } from '@/hooks/useAppState';
import { useRiderDriverData } from '@/hooks/useRiderDriverData';
import { t } from '@/lib/index';

export default function HelperCodPage() {
  const { currentUser, language: lang } = useAppState();
  const { codRecords, handoverCod } = useRiderDriverData(currentUser?.id);
  const [open, setOpen] = useState(false);

  return (
    <>
      <AppShell role="helper" onOpenProfile={() => setOpen(true)}>
        <div className="w-full h-full overflow-y-auto">
          <div className="px-4 py-4 border-b border-border">
            <h1 className="text-2xl font-bold text-foreground">{t('nav.cod', lang)}</h1>
          </div>
          <div className="p-4 pb-24">
            <CodPanel role="helper" records={codRecords} onHandover={handoverCod} />
          </div>
        </div>
      </AppShell>
      <ProfileDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
