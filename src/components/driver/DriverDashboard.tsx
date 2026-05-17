import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Truck, Package, MapPin, DollarSign, TrendingUp, ArrowRight, RefreshCw } from 'lucide-react';
import { useAppState } from '@/hooks/useAppState';
import { useRiderDriverData } from '@/hooks/useRiderDriverData';
import { ROUTE_PATHS, t } from '@/lib/index';

const DRIVER_COLOR = 'oklch(0.55 0.18 240)';

export function DriverDashboard() {
  const { currentUser, language: lang } = useAppState();
  const { jobs, codRecords, loading, refresh } = useRiderDriverData(currentUser?.id);
  const navigate = useNavigate();

  const vehiclePlate = currentUser?.role === 'driver' ? currentUser.vehiclePlate : 'N/A';

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayJobs = jobs.filter(j => j.createdAt?.startsWith(todayStr));
  const pendingJobs = jobs.filter(j => j.status === 'assigned' || j.status === 'picked_up').length;
  const deliveredToday = todayJobs.filter(j => j.status === 'delivered').length;
  const codPending = codRecords.filter(c => c.collected && !c.handedOver).reduce((s, c) => s + c.amount, 0);
  const successRate = todayJobs.length > 0 ? Math.round((deliveredToday / todayJobs.length) * 100) : 0;

  const stats = [
    { label: t('driver.totalParcels',      lang), value: jobs.length,   icon: Package,   color: DRIVER_COLOR,              nav: ROUTE_PATHS.DRIVER_JOBS },
    { label: t('driver.pendingDeliveries', lang), value: pendingJobs,   icon: MapPin,    color: 'oklch(0.70 0.18 55)',     nav: ROUTE_PATHS.DRIVER_ROUTE },
    { label: t('dashboard.codPending',     lang), value: `${codPending.toLocaleString()} K`, icon: DollarSign, color: 'oklch(0.83 0.175 96)', nav: ROUTE_PATHS.DRIVER_COD },
    { label: t('dashboard.successRate',    lang), value: `${successRate}%`, icon: TrendingUp, color: 'oklch(0.62 0.18 152)', nav: ROUTE_PATHS.DRIVER_EARNINGS },
  ];

  return (
    <div className="p-4 space-y-5">
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">
          {lang === 'en' ? 'Welcome back,' : 'ကြိုဆိုပါသည်,'}
        </p>
        <h1 className="text-2xl font-black text-foreground mt-0.5">
          {currentUser?.nameEn ?? 'Driver'}
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <Truck className="h-3.5 w-3.5" style={{ color: DRIVER_COLOR }} />
          <span className="text-sm font-mono font-bold" style={{ color: DRIVER_COLOR }}>{vehiclePlate}</span>
          <span className="text-sm text-muted-foreground">· {currentUser?.zoneEn} · {currentUser?.shift} {lang === 'en' ? 'Shift' : 'ဆင့်'}</span>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ label, value, icon: Icon, color, nav }, i) => (
          <motion.button
            key={label}
            onClick={() => navigate(nav)}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="rounded-2xl p-4 text-left transition-transform active:scale-[0.97]"
            style={{ background: 'oklch(0.14 0.035 258)', border: '1px solid oklch(0.20 0.038 260)' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: `${color}22` }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-2xl font-black text-foreground leading-none">{loading ? '…' : value}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{label}</p>
          </motion.button>
        ))}
      </div>

      {/* Quick actions */}
      <div className="space-y-2.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
          {lang === 'en' ? 'Quick Actions' : 'မြန်ဆန်သောလုပ်ဆောင်ချက်'}
        </p>
        {[
          { label: lang === 'en' ? 'Load Today\'s Manifest' : 'ယနေ့ မန်နီဖက် တင်မည်', path: ROUTE_PATHS.DRIVER_JOBS,   color: DRIVER_COLOR },
          { label: lang === 'en' ? 'Scan Handover Proof'   : 'QR လွှဲပြောင်းစကင်',     path: ROUTE_PATHS.DRIVER_PROOF,  color: 'oklch(0.62 0.18 152)' },
          { label: lang === 'en' ? 'View Route'             : 'လမ်းကြောင်းကြည့်',       path: ROUTE_PATHS.DRIVER_ROUTE,  color: 'oklch(0.70 0.18 55)' },
          { label: lang === 'en' ? 'Portal Sync'            : 'ပေါ်တယ် ဆင့်ကဲ',         path: ROUTE_PATHS.DRIVER_SYNC,   color: 'oklch(0.60 0.18 300)' },
        ].map(({ label, path, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex items-center justify-between w-full rounded-2xl px-4 py-3.5 transition-colors"
            style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}
          >
            <span className="text-sm font-semibold text-foreground">{label}</span>
            <ArrowRight className="h-4 w-4" style={{ color }} />
          </button>
        ))}
      </div>

      {!loading && jobs.length === 0 && (
        <div className="flex flex-col items-center py-8 text-center">
          <Truck className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground font-semibold">
            {lang === 'en' ? 'No manifest loaded yet' : 'မန်နီဖက် မတင်ရသေးပါ'}
          </p>
          <button onClick={refresh} className="mt-3 text-xs font-bold" style={{ color: DRIVER_COLOR }}>
            {t('common.refresh', lang)}
          </button>
        </div>
      )}
    </div>
  );
}
