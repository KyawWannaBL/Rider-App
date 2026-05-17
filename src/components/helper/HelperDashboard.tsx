import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HandHelping, Package, MapPin, DollarSign, TrendingUp, ArrowRight, Users } from 'lucide-react';
import { useAppState } from '@/hooks/useAppState';
import { useRiderDriverData } from '@/hooks/useRiderDriverData';
import { ROUTE_PATHS, t } from '@/lib/index';

const HELPER_COLOR = 'oklch(0.60 0.18 300)';

export function HelperDashboard() {
  const { currentUser, language: lang } = useAppState();
  const { jobs, codRecords, loading, refresh } = useRiderDriverData(currentUser?.id);
  const navigate = useNavigate();

  const teamId = currentUser?.role === 'helper' ? (currentUser.teamId ?? '—') : '—';
  const handled = jobs.length;
  const codPending = codRecords.filter(c => c.collected && !c.handedOver).reduce((s, c) => s + c.amount, 0);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDone = jobs.filter(j => j.status === 'delivered' && j.createdAt?.startsWith(todayStr)).length;

  const stats = [
    { label: t('helper.parcelsHandled', lang), value: handled,                          icon: Package,     color: HELPER_COLOR,              nav: ROUTE_PATHS.HELPER_JOBS },
    { label: t('helper.assistedStops',  lang), value: todayDone,                        icon: MapPin,      color: 'oklch(0.62 0.18 152)',    nav: ROUTE_PATHS.HELPER_ROUTE },
    { label: t('dashboard.codPending',  lang), value: `${codPending.toLocaleString()} K`, icon: DollarSign, color: 'oklch(0.83 0.175 96)',    nav: ROUTE_PATHS.HELPER_COD },
    { label: t('nav.earnings',          lang), value: `—`,                              icon: TrendingUp,  color: 'oklch(0.70 0.18 55)',     nav: ROUTE_PATHS.HELPER_EARNINGS },
  ];

  return (
    <div className="p-4 space-y-5">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">
          {lang === 'en' ? 'Welcome back,' : 'ကြိုဆိုပါသည်,'}
        </p>
        <h1 className="text-2xl font-black text-foreground mt-0.5">{currentUser?.nameEn ?? 'Helper'}</h1>
        <div className="flex items-center gap-2 mt-1">
          <Users className="h-3.5 w-3.5" style={{ color: HELPER_COLOR }} />
          <span className="text-sm font-bold" style={{ color: HELPER_COLOR }}>{t('helper.teamId', lang)}: {teamId}</span>
          <span className="text-sm text-muted-foreground">· {currentUser?.zoneEn}</span>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ label, value, icon: Icon, color, nav }, i) => (
          <motion.button key={label} onClick={() => navigate(nav)}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="rounded-2xl p-4 text-left transition-transform active:scale-[0.97]"
            style={{ background: 'oklch(0.14 0.035 258)', border: '1px solid oklch(0.20 0.038 260)' }}>
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

      <div className="space-y-2.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
          {lang === 'en' ? 'Quick Actions' : 'မြန်ဆန်သောလုပ်ဆောင်ချက်'}
        </p>
        {[
          { label: lang === 'en' ? 'Submit Pickup Proof' : 'ကောက်ယူသက်သေ တင်မည်', path: ROUTE_PATHS.HELPER_PROOF,  color: HELPER_COLOR },
          { label: lang === 'en' ? 'View Assigned Jobs'  : 'သတ်မှတ်ထားသောအလုပ်',   path: ROUTE_PATHS.HELPER_JOBS,   color: 'oklch(0.62 0.18 152)' },
          { label: lang === 'en' ? 'Sync with Portal'    : 'ပေါ်တယ်နှင့် ဆင့်ကဲ',   path: ROUTE_PATHS.HELPER_SYNC,   color: 'oklch(0.55 0.18 240)' },
        ].map(({ label, path, color }) => (
          <button key={path} onClick={() => navigate(path)}
            className="flex items-center justify-between w-full rounded-2xl px-4 py-3.5 transition-colors"
            style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}>
            <span className="text-sm font-semibold text-foreground">{label}</span>
            <ArrowRight className="h-4 w-4" style={{ color }} />
          </button>
        ))}
      </div>

      {!loading && jobs.length === 0 && (
        <div className="flex flex-col items-center py-8 text-center">
          <HandHelping className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground font-semibold">
            {lang === 'en' ? 'No jobs assigned yet' : 'အလုပ်မရှိသေးပါ'}
          </p>
          <button onClick={refresh} className="mt-3 text-xs font-bold" style={{ color: HELPER_COLOR }}>
            {t('common.refresh', lang)}
          </button>
        </div>
      )}
    </div>
  );
}
