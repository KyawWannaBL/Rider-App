import { useState } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { JobsBoard } from '@/components/shared/JobsBoard';
import { useAppState } from '@/hooks/useAppState';
import { useRiderDriverData } from '@/hooks/useRiderDriverData';
import { t } from '@/lib/index';
import { Package, MapPin, TrendingUp } from 'lucide-react';

export default function DriverJobsPage() {
  const { currentUser, language: lang } = useAppState();
  const { jobs, loading } = useRiderDriverData(currentUser?.id);
  const [profileOpen, setProfileOpen] = useState(false);

  const vehiclePlate = currentUser?.role === 'driver' ? currentUser.vehiclePlate : 'N/A';
  const deliveredToday = jobs.filter(j => j.status === 'delivered').length;
  const pendingStops = jobs.filter(j => j.status === 'assigned' || j.status === 'picked_up').length;

  const statCards = [
    { label: t('driver.totalParcels', lang),      value: loading ? '…' : jobs.length,   icon: Package,    color: 'oklch(0.55 0.18 240)' },
    { label: t('driver.completedStops', lang),     value: loading ? '…' : deliveredToday, icon: MapPin,     color: 'oklch(0.62 0.18 152)' },
    { label: t('driver.pendingDeliveries', lang),  value: loading ? '…' : pendingStops,  icon: TrendingUp, color: 'oklch(0.70 0.18 55)' },
  ];

  return (
    <>
      <AppShell role="driver" onOpenProfile={() => setProfileOpen(true)}>
        <div className="w-full h-full overflow-y-auto">
          <div className="p-4 pb-24 space-y-5">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-2xl font-bold text-foreground mb-1">{t('driver.loadManifest', lang)}</h1>
              <p className="text-sm text-muted-foreground">{t('driver.vehicleRoute', lang)}</p>
            </motion.div>

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-3">
              {statCards.map(({ label, value, icon: Icon, color }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  className="rounded-2xl p-3"
                  style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}
                >
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center mb-2" style={{ background: `${color}22` }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <p className="text-xl font-black text-foreground">{value}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
                </motion.div>
              ))}
            </div>

            {/* Vehicle + route info */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="rounded-2xl p-4 flex items-center justify-between"
              style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.55 0.18 240 / 0.30)' }}
            >
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Vehicle Plate</p>
                <p className="text-lg font-bold font-mono" style={{ color: 'oklch(0.55 0.18 240)' }}>{vehiclePlate}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-0.5">Route</p>
                <p className="text-base font-semibold text-foreground">Route A-12</p>
              </div>
            </motion.div>

            {/* Jobs list */}
            <JobsBoard role="driver" />
          </div>
        </div>
      </AppShell>
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}
