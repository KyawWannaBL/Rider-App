import { motion } from 'framer-motion';
import { DollarSign, Loader2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAppState } from '@/hooks/useAppState';
import type { CodRecord } from '@/lib/index';

interface CodPanelProps {
  role: 'rider' | 'driver' | 'helper';
  records: CodRecord[];
  onHandover: (id: string) => Promise<void>;
}

export function CodPanel({ role: _role, records, onHandover }: CodPanelProps) {
  const { language: lang } = useAppState();

  const totalPending = records.filter(r => r.collected && !r.handedOver).reduce((s, r) => s + r.amount, 0);
  const totalHandedOver = records.filter(r => r.handedOver).reduce((s, r) => s + r.amount, 0);

  if (records.length === 0) return (
    <div className="flex flex-col items-center py-16 text-center">
      <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-base font-bold text-foreground mb-1">
        {lang === 'en' ? 'No COD records' : 'COD မှတ်တမ်းမရှိ'}
      </p>
      <p className="text-sm text-muted-foreground">
        {lang === 'en' ? 'Cash on delivery collections will appear here.' : 'COD ကောက်ခံမှုများ ဤနေရာတွင် ပြမည်'}
      </p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4" style={{ background: 'oklch(0.70 0.18 55 / 0.10)', border: '1px solid oklch(0.70 0.18 55 / 0.25)' }}>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
            {lang === 'en' ? 'Pending Handover' : 'လွှဲပြောင်းစောင့်'}
          </p>
          <p className="text-xl font-black" style={{ color: 'oklch(0.70 0.18 55)' }}>{totalPending.toLocaleString()} K</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'oklch(0.62 0.18 152 / 0.10)', border: '1px solid oklch(0.62 0.18 152 / 0.25)' }}>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
            {lang === 'en' ? 'Handed Over' : 'လွှဲပြောင်းပြီး'}
          </p>
          <p className="text-xl font-black" style={{ color: 'oklch(0.62 0.18 152)' }}>{totalHandedOver.toLocaleString()} K</p>
        </div>
      </div>

      {/* Records */}
      <div className="space-y-2.5">
        {records.map((rec, i) => (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center justify-between rounded-2xl p-4"
            style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              {rec.handedOver
                ? <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'oklch(0.62 0.18 152)' }} />
                : <AlertCircle className="h-4 w-4 shrink-0" style={{ color: 'oklch(0.70 0.18 55)' }} />
              }
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{rec.recipientName}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{rec.trackingNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-black text-foreground">{rec.amount.toLocaleString()} K</span>
              {rec.collected && !rec.handedOver && (
                <button
                  onClick={() => onHandover(rec.id)}
                  className="text-[10px] font-black uppercase tracking-wide px-3 py-1.5 rounded-xl"
                  style={{ background: 'oklch(0.83 0.175 96)', color: 'oklch(0.09 0.028 256)' }}
                >
                  {lang === 'en' ? 'Handover' : 'လွှဲပြောင်း'}
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
