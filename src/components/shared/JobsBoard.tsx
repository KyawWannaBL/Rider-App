import { motion } from 'framer-motion';
import { Briefcase, Loader2, RefreshCw, MapPin, Package, DollarSign } from 'lucide-react';
import { useAppState } from '@/hooks/useAppState';
import { useRiderDriverData } from '@/hooks/useRiderDriverData';
import type { Job } from '@/lib/index';

const statusColors: Record<string, string> = {
  assigned:   'oklch(0.55 0.18 240)',
  picked_up:  'oklch(0.68 0.18 45)',
  in_transit: 'oklch(0.70 0.18 55)',
  delivered:  'oklch(0.62 0.18 152)',
  failed:     'oklch(0.58 0.22 15)',
  rto:        'oklch(0.60 0.18 300)',
};

function JobCard({ job, lang }: { job: Job; lang: 'en' | 'my' }) {
  const color = statusColors[job.status] ?? 'oklch(0.45 0.020 240)';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 space-y-3"
      style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{job.merchantName}</p>
          <p className="text-sm font-mono font-black text-foreground">{job.trackingNumber}</p>
        </div>
        <span
          className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg shrink-0"
          style={{ background: `${color}22`, color }}
        >
          {job.status.replace('_', ' ')}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{job.township} · {job.address}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs">
          <Package className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{job.recipientName}</span>
        </div>
        <div className="flex items-center gap-1 text-xs font-bold" style={{ color: 'oklch(0.83 0.175 96)' }}>
          <DollarSign className="h-3 w-3" />
          {job.codAmount > 0 ? `COD ${job.codAmount.toLocaleString()} K` : `Fee ${job.deliveryFee.toLocaleString()} K`}
        </div>
      </div>
    </motion.div>
  );
}

interface JobsBoardProps { role: 'rider' | 'driver' | 'helper'; }

export function JobsBoard({ role: _role }: JobsBoardProps) {
  const { currentUser, language: lang } = useAppState();
  const { jobs, loading, error, refresh } = useRiderDriverData(currentUser?.id);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (error) return (
    <div className="p-4 text-center space-y-3">
      <p className="text-sm text-destructive">{error}</p>
      <button onClick={refresh} className="flex items-center gap-1.5 mx-auto text-xs font-bold" style={{ color: 'oklch(0.83 0.175 96)' }}>
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </button>
    </div>
  );

  if (jobs.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-base font-bold text-foreground mb-1">
        {lang === 'en' ? 'No jobs assigned' : 'အလုပ်မရှိသေးပါ'}
      </p>
      <p className="text-sm text-muted-foreground">
        {lang === 'en' ? 'Your assigned deliveries will appear here.' : 'သင်၏ပို့ဆောင်မှုများ ဤနေရာတွင် ပြမည်'}
      </p>
    </div>
  );

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          {jobs.length} {lang === 'en' ? 'jobs' : 'ခုပြသည်'}
        </p>
        <button onClick={refresh} className="text-xs font-bold flex items-center gap-1" style={{ color: 'oklch(0.83 0.175 96)' }}>
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>
      {jobs.map(job => <JobCard key={job.id} job={job} lang={lang} />)}
    </div>
  );
}
