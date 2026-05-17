import { motion } from 'framer-motion';
import { MapPin, Loader2, RefreshCw, Navigation } from 'lucide-react';
import { useAppState } from '@/hooks/useAppState';
import { useRiderDriverData } from '@/hooks/useRiderDriverData';

interface RouteBoardProps { role: 'rider' | 'driver' | 'helper'; }

export function RouteBoard({ role: _role }: RouteBoardProps) {
  const { currentUser, language: lang } = useAppState();
  const { jobs, loading, refresh } = useRiderDriverData(currentUser?.id);

  const routeJobs = jobs.filter(j => j.status === 'assigned' || j.status === 'picked_up' || j.status === 'in_transit');

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-foreground">
          {lang === 'en' ? 'Today\'s Route' : 'ယနေ့ လမ်းကြောင်း'}
        </h1>
        <button onClick={refresh} className="flex items-center gap-1 text-xs font-bold" style={{ color: 'oklch(0.83 0.175 96)' }}>
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Route overview card */}
      <div
        className="rounded-2xl p-4 flex items-center gap-4"
        style={{ background: 'oklch(0.68 0.18 45 / 0.10)', border: '1px solid oklch(0.68 0.18 45 / 0.25)' }}
      >
        <Navigation className="h-8 w-8" style={{ color: 'oklch(0.68 0.18 45)' }} />
        <div>
          <p className="text-lg font-black text-foreground">{routeJobs.length} {lang === 'en' ? 'stops' : 'မှတ်တိုင်'}</p>
          <p className="text-xs text-muted-foreground">{lang === 'en' ? 'Active delivery route' : 'တက်ကြွသောပို့ဆောင်မှုလမ်းကြောင်း'}</p>
        </div>
      </div>

      {routeJobs.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-base font-bold text-foreground mb-1">
            {lang === 'en' ? 'No active stops' : 'တက်ကြွသောမှတ်တိုင်မရှိ'}
          </p>
          <p className="text-sm text-muted-foreground">
            {lang === 'en' ? 'Assigned jobs will show here as your route.' : 'သတ်မှတ်ထားသောအလုပ်များ ဤနေရာတွင် ပြမည်'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {routeJobs.map((job, idx) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.06 }}
              className="flex items-start gap-3 rounded-2xl p-4"
              style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}
            >
              <div
                className="flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-black"
                style={{ background: 'oklch(0.68 0.18 45)', color: 'oklch(0.09 0.028 256)' }}
              >
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{job.recipientName}</p>
                <p className="text-xs text-muted-foreground truncate">{job.township} · {job.address}</p>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{job.trackingNumber}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
