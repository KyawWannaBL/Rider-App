import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { ProofCapture } from '@/components/shared/ProofCapture';
import { RouteBoard } from '@/components/shared/RouteBoard';
import { useAppState } from '@/hooks/useAppState';
import { useRiderDriverData } from '@/hooks/useRiderDriverData';
import { t } from '@/lib/index';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Package, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DriverProofPage() {
  const { language: lang, currentUser } = useAppState();
  const { jobs } = useRiderDriverData(currentUser?.id);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('scan');

  const handleProofSubmit = (data: { trackingNumbers: string[]; count: number; proofType: string }) => {
    console.log('Handover proof submitted:', data);
  };

  const completedStops = jobs.filter(j => j.status === 'delivered').length;
  const totalStops = jobs.length;
  const completionRate = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

  return (
    <>
      <AppShell role="driver" onOpenProfile={() => setProfileOpen(true)}>
        <div className="w-full h-full overflow-y-auto">
          <div className="max-w-4xl mx-auto p-4 pb-24">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground mb-1">{t('driver.scanHandover', lang)}</h1>
                <p className="text-sm text-muted-foreground">{t('driver.confirmHandover', lang)}</p>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="scan" className="gap-2">
                    <Package className="h-4 w-4" />{t('pickup.scan', lang)}
                  </TabsTrigger>
                  <TabsTrigger value="complete" className="gap-2">
                    <CheckCircle2 className="h-4 w-4" />{t('route.completeRoute', lang)}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="scan" className="space-y-4">
                  <Card className="rounded-2xl p-5 space-y-4" style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground mb-1">{t('driver.scanHandover', lang)}</h2>
                      <p className="text-sm text-muted-foreground">Scan parcels to handover to branch or rider</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                        <MapPin className="h-5 w-5" style={{ color: 'oklch(0.55 0.18 240)' }} />
                        <span className="text-sm font-medium">{t('driver.toBranch', lang)}</span>
                      </Button>
                      <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                        <Package className="h-5 w-5" style={{ color: 'oklch(0.55 0.18 240)' }} />
                        <span className="text-sm font-medium">{t('driver.toRider', lang)}</span>
                      </Button>
                    </div>
                    <ProofCapture title="Handover Scan" onSubmit={handleProofSubmit} />
                  </Card>
                </TabsContent>

                <TabsContent value="complete" className="space-y-4">
                  <Card className="rounded-2xl p-5 space-y-5" style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground mb-1">{t('route.completeRoute', lang)}</h2>
                      <p className="text-sm text-muted-foreground">Review all stops before completing route</p>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground">Route Progress</span>
                        <span className="text-sm font-bold" style={{ color: 'oklch(0.55 0.18 240)' }}>{completedStops}/{totalStops} stops</span>
                      </div>
                      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{ background: 'linear-gradient(90deg, oklch(0.55 0.18 240), oklch(0.62 0.18 152))' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${completionRate}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs text-muted-foreground">{completionRate}% Complete</span>
                        <span className="text-xs text-muted-foreground">{totalStops - completedStops} remaining</span>
                      </div>
                    </div>

                    <RouteBoard role="driver" />

                    {/* Checklist */}
                    <div className="rounded-xl p-4 space-y-2" style={{ background: 'oklch(0.62 0.18 152 / 0.08)', border: '1px solid oklch(0.62 0.18 152 / 0.20)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                        <p className="text-sm font-medium text-foreground">Route Completion Checklist</p>
                      </div>
                      {['All stops visited', 'All parcels accounted for', 'COD collected and recorded', 'Vehicle inspection completed'].map(item => (
                        <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
                          {item}
                        </div>
                      ))}
                    </div>

                    <Button
                      className="w-full py-4 font-black text-sm uppercase tracking-wide"
                      style={{ background: 'oklch(0.55 0.18 240)', color: '#fff' }}
                      disabled={totalStops > 0 && completedStops !== totalStops}
                    >
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      {t('route.completeRoute', lang)}
                    </Button>
                    {totalStops > 0 && completedStops !== totalStops && (
                      <p className="text-xs text-center text-muted-foreground">Complete all stops to finish route</p>
                    )}
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          </div>
        </div>
      </AppShell>
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}
