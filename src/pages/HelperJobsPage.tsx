import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { JobsBoard } from '@/components/shared/JobsBoard';
import { useAppState } from '@/hooks/useAppState';
import { t } from '@/lib/index';
export default function HelperJobsPage() {
  const { language: lang } = useAppState();
  const [o, setO] = useState(false);
  return (<><AppShell role="helper" onOpenProfile={() => setO(true)}>
    <div className="w-full h-full flex flex-col">
      <div className="px-4 py-4 border-b border-border"><h1 className="text-2xl font-bold text-foreground">{t('nav.jobs', lang)}</h1></div>
      <div className="flex-1 overflow-auto"><JobsBoard role="helper" /></div>
    </div>
  </AppShell><ProfileDrawer open={o} onClose={() => setO(false)} /></>);
}
