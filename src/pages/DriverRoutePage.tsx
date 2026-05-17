import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { RouteBoard } from '@/components/shared/RouteBoard';
import { useAppState } from '@/hooks/useAppState';
import { useRiderDriverData } from '@/hooks/useRiderDriverData';
import { t } from '@/lib/index';
import { Truck, Package, MapPin } from 'lucide-react';

export default function DriverRoutePage() {
  const [profileOpen, setProfileOpen] = useState(false);
  const { language: lang, currentUser } = useAppState();
  const { jobs } = useRiderDriverData(currentUser?.id);

  const vehiclePlate = currentUser?.role === 'driver' ? currentUser.vehiclePlate : 'YGN-1234';
  const totalStops = jobs.length;
  const completedStops = jobs.filter(j => j.status === 'delivered').length;

  return (
    <>
      <AppShell role="driver" onOpenProfile={() => setProfileOpen(true)}>
        <div className="flex flex-col h-full">
          {/* Route header card */}
          <div className="p-4 space-y-3 border-b border-border" style={{ background: 'oklch(0.12 0.030 258)' }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'oklch(0.55 0.18 240 / 0.15)', border: '1px solid oklch(0.55 0.18 240 / 0.30)' }}>
                <Truck className="w-5 h-5" style={{ color: 'oklch(0.55 0.18 240)' }} />
              </div>
              <div className="flex-1">
                <h1 className="text-base font-bold text-foreground">
                  {lang === 'en' ? 'Route A - North Zone' : 'လမ်းကြောင်း A - မြောက်ဇုန်'}
                </h1>
                <p className="text-xs text-muted-foreground">{t('driver.vehicleRoute', lang)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'oklch(0.14 0.035 258)', border: '1px solid oklch(0.20 0.038 260)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'oklch(0.55 0.18 240 / 0.15)' }}>
                  <Package className="w-4 h-4" style={{ color: 'oklch(0.55 0.18 240)' }} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">{t('driver.totalParcels', lang)}</p>
                  <p className="text-base font-bold text-foreground">{jobs.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'oklch(0.14 0.035 258)', border: '1px solid oklch(0.20 0.038 260)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'oklch(0.62 0.18 152 / 0.15)' }}>
                  <MapPin className="w-4 h-4" style={{ color: 'oklch(0.62 0.18 152)' }} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">{t('route.totalStops', lang)}</p>
                  <p className="text-base font-bold text-foreground">{completedStops}/{totalStops}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl p-3" style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">{lang === 'en' ? 'Vehicle' : 'ယာဉ်'}:</span>
                <span className="font-mono font-semibold text-foreground">{vehiclePlate}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{lang === 'en' ? 'Batch' : 'အစု'}:</span>
                <span className="font-mono font-semibold text-foreground">BATCH-2026-001</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <RouteBoard role="driver" />
          </div>
        </div>
      </AppShell>
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}
