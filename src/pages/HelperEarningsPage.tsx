import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { EarningsPanel } from '@/components/shared/EarningsPanel';
import { useAppState } from '@/hooks/useAppState';
import { ROUTE_PATHS, t } from '@/lib/index';

export default function HelperEarningsPage() {
  const { language: lang } = useAppState();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <>
      <AppShell role="helper" onOpenProfile={() => setOpen(true)}>
        <div className="w-full h-full overflow-y-auto">
          <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
            <button onClick={() => navigate(ROUTE_PATHS.HELPER)} className="text-muted-foreground hover:text-foreground text-sm">←</button>
            <h1 className="text-2xl font-bold text-foreground">{t('nav.earnings', lang)}</h1>
          </div>
          <div className="p-4 pb-24">
            <EarningsPanel role="helper" />
          </div>
        </div>
      </AppShell>
      <ProfileDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
