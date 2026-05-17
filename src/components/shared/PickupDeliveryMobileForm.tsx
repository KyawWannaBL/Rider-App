import { useState } from 'react';
import { Package, Search, CheckCircle2 } from 'lucide-react';
import { useAppState } from '@/hooks/useAppState';
import { supabase } from '@/integrations/supabase/client';

interface PickupDeliveryMobileFormProps { sourcePortal: 'rider' | 'driver' | 'helper'; }

export default function PickupDeliveryMobileForm({ sourcePortal: _portal }: PickupDeliveryMobileFormProps) {
  const { currentUser, language: lang } = useAppState();
  const [tracking, setTracking] = useState('');
  const [notes, setNotes] = useState('');
  const [type, setType] = useState<'pickup' | 'delivery'>('pickup');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tracking.trim()) { setError(lang === 'en' ? 'Tracking number required.' : 'ခြေရာခံနံပါတ် လိုအပ်သည်'); return; }
    setLoading(true);
    setError(null);
    try {
      if (supabase) {
        await supabase.from('job_actions').insert({
          user_id: currentUser?.id,
          tracking_number: tracking.trim(),
          action_type: type,
          notes,
          created_at: new Date().toISOString(),
        });
      }
      setSuccess(true);
      setTracking('');
      setNotes('');
      setTimeout(() => setSuccess(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-5">
      <h1 className="text-xl font-black text-foreground">
        {lang === 'en' ? 'Pickup / Delivery Form' : 'ကောက်ယူ / ပို့ဆောင် ပုံစံ'}
      </h1>

      {/* Type selector */}
      <div className="flex rounded-2xl p-1 gap-1" style={{ background: 'oklch(0.12 0.030 258)' }}>
        {(['pickup', 'delivery'] as const).map(t => (
          <button
            key={t}
            onClick={() => setType(t)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors"
            style={type === t
              ? { background: 'oklch(0.83 0.175 96)', color: 'oklch(0.09 0.028 256)' }
              : { color: 'oklch(0.45 0.020 240)' }}
          >
            {t === 'pickup' ? (lang === 'en' ? 'Pickup' : 'ကောက်ယူ') : (lang === 'en' ? 'Delivery' : 'ပို့ဆောင်')}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">
            {lang === 'en' ? 'Tracking / Way ID' : 'ခြေရာခံ / Way ID'}
          </label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={tracking}
              onChange={e => setTracking(e.target.value)}
              placeholder="BX-2026-XXXXXX or D0517-ALN-001"
              className="w-full rounded-xl pl-10 pr-4 py-3 text-sm font-mono bg-background text-foreground border border-border outline-none focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">
            {lang === 'en' ? 'Notes (optional)' : 'မှတ်ချက် (ရွေးချယ်စရာ)'}
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder={lang === 'en' ? 'Any remarks…' : 'မှတ်ချက်များ…'}
            className="w-full rounded-xl px-4 py-3 text-sm bg-background text-foreground border border-border outline-none focus:border-primary resize-none"
          />
        </div>

        {error && <p className="text-xs" style={{ color: 'oklch(0.72 0.15 15)' }}>{error}</p>}

        <button
          type="submit"
          disabled={loading || !tracking.trim()}
          className="flex items-center justify-center gap-2 w-full rounded-2xl py-4 text-sm font-black uppercase tracking-wide transition-all disabled:opacity-50"
          style={{ background: success ? 'oklch(0.55 0.16 152)' : 'oklch(0.83 0.175 96)', color: 'oklch(0.09 0.028 256)' }}
        >
          {success
            ? <><CheckCircle2 className="h-4 w-4" /> {lang === 'en' ? 'Submitted!' : 'တင်သွင်းပြီး!'}</>
            : <><Package className="h-4 w-4" /> {lang === 'en' ? 'Submit' : 'တင်သွင်း'}</>
          }
        </button>
      </form>
    </div>
  );
}
