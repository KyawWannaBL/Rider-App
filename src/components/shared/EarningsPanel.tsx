import { TrendingUp, Loader2 } from 'lucide-react';
import { useAppState } from '@/hooks/useAppState';
import { useRiderDriverData } from '@/hooks/useRiderDriverData';

interface EarningsPanelProps { role: 'rider' | 'driver' | 'helper'; }

export function EarningsPanel({ role: _role }: EarningsPanelProps) {
  const { currentUser, language: lang } = useAppState();
  const { jobs, loading } = useRiderDriverData(currentUser?.id);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  const delivered = jobs.filter(j => j.status === 'delivered');
  const totalEarnings = delivered.reduce((s, j) => s + (j.deliveryFee ?? 0), 0);
  const totalCod = jobs.reduce((s, j) => s + (j.codAmount ?? 0), 0);
  const totalDeliveries = delivered.length;

  // Group by date
  const byDate: Record<string, { deliveries: number; earnings: number }> = {};
  delivered.forEach(j => {
    const d = j.createdAt?.slice(0, 10) ?? 'unknown';
    if (!byDate[d]) byDate[d] = { deliveries: 0, earnings: 0 };
    byDate[d].deliveries++;
    byDate[d].earnings += j.deliveryFee ?? 0;
  });
  const rows = Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);

  if (jobs.length === 0) return (
    <div className="flex flex-col items-center py-16 text-center px-4">
      <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-base font-bold text-foreground mb-1">
        {lang === 'en' ? 'No earnings data yet' : 'ဝင်ငွေဒေတာမရှိသေးပါ'}
      </p>
      <p className="text-sm text-muted-foreground">
        {lang === 'en' ? 'Complete deliveries to see your earnings here.' : 'ပို့ဆောင်မှုများ ပြီးဆုံးပါက ဤနေရာတွင် ပြမည်'}
      </p>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: lang === 'en' ? 'Deliveries' : 'ပို့ဆောင်', value: totalDeliveries, color: 'oklch(0.55 0.18 240)' },
          { label: lang === 'en' ? 'Earnings' : 'ဝင်ငွေ', value: `${totalEarnings.toLocaleString()} K`, color: 'oklch(0.83 0.175 96)' },
          { label: 'COD',                                       value: `${totalCod.toLocaleString()} K`,     color: 'oklch(0.62 0.18 152)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-3 text-center" style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}>
            <p className="text-lg font-black" style={{ color }}>{value}</p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Daily breakdown */}
      {rows.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
            {lang === 'en' ? 'Daily Breakdown' : 'နေ့စဥ်အသေးစိတ်'}
          </p>
          {rows.map(([date, data]) => (
            <div
              key={date}
              className="flex items-center justify-between rounded-2xl px-4 py-3"
              style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}
            >
              <div>
                <p className="text-sm font-bold text-foreground">{date}</p>
                <p className="text-xs text-muted-foreground">{data.deliveries} {lang === 'en' ? 'deliveries' : 'ပို့'}</p>
              </div>
              <span className="text-sm font-black" style={{ color: 'oklch(0.83 0.175 96)' }}>
                {data.earnings.toLocaleString()} K
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
