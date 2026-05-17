import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { ProofCapture } from '@/components/shared/ProofCapture';
import { useAppState } from '@/hooks/useAppState';
import { useToast } from '@/hooks/use-toast';
import { t } from '@/lib/index';

export default function HelperProofPage() {
  const { language: lang } = useAppState();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const handleSubmit = (_data: { trackingNumbers: string[]; count: number; proofType: string }) => {
    toast({ title: t('common.success', lang), description: lang === 'en' ? 'Proof submitted successfully' : 'သက်သေ တင်ပြပြီး' });
  };

  return (
    <>
      <AppShell role="helper" onOpenProfile={() => setOpen(true)}>
        <div className="w-full h-full overflow-y-auto">
          <div className="px-4 py-4 border-b border-border">
            <h1 className="text-2xl font-bold text-foreground">{t('nav.proof', lang)}</h1>
          </div>
          <div className="p-4 pb-24">
            <ProofCapture title={lang === 'en' ? 'Submit Proof' : 'သက်သေ တင်မည်'} onSubmit={handleSubmit} />
          </div>
        </div>
      </AppShell>
      <ProfileDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
