import { useState } from 'react';
import { HeadphonesIcon, MessageSquare, Phone, ChevronRight } from 'lucide-react';
import { useAppState } from '@/hooks/useAppState';
import { supabase } from '@/integrations/supabase/client';

interface SupportPanelProps { role: 'rider' | 'driver' | 'helper'; }

export function SupportPanel({ role: _role }: SupportPanelProps) {
  const { currentUser, language: lang } = useAppState();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      setError(lang === 'en' ? 'Please fill all fields.' : 'ကွက်လပ်အားလုံး ဖြည့်ပါ');
      return;
    }
    setSending(true);
    setError(null);
    try {
      if (supabase) {
        await supabase.from('support_tickets').insert({
          user_id: currentUser?.id,
          subject,
          message,
          role: _role,
          status: 'open',
        });
      }
      setSent(true);
      setSubject('');
      setMessage('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const faqs = [
    { q: lang === 'en' ? 'How do I confirm a pickup?' : 'ကောက်ယူမှု မည်သို့အတည်ပြုမလဲ?', a: lang === 'en' ? 'Go to Pickup tab → scan QR or enter tracking.' : 'ကောက်ယူမှုတက်ဘ် → QR စကင်နိုင်' },
    { q: lang === 'en' ? 'How to report a failed delivery?' : 'မအောင်မြင်သောပို့ဆောင်မှု မည်သို့တင်ပြမလဲ?', a: lang === 'en' ? 'Open the job → Proof tab → choose Failed + reason.' : 'အလုပ် → သက်သေ → မအောင်မြင် ရွေးချယ်ပါ' },
    { q: lang === 'en' ? 'When does COD need to be handed over?' : 'COD မည်သောအချိန်တွင် လွှဲပြောင်းရမလဲ?', a: lang === 'en' ? 'End of shift. Go to COD tab and tap Handover.' : 'ဆင့်ပြီးဆုံးသောအချိန် COD တက်ဘ် → လွှဲပြောင်း' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <HeadphonesIcon className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-black text-foreground">
          {lang === 'en' ? 'Support' : 'ပံ့ပိုး'}
        </h1>
      </div>

      {/* Quick contact */}
      <div className="grid grid-cols-2 gap-3">
        <a href="tel:+959XXXXXXXX" className="flex items-center gap-3 rounded-2xl p-4 transition-colors" style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}>
          <Phone className="h-5 w-5" style={{ color: 'oklch(0.62 0.18 152)' }} />
          <div>
            <p className="text-xs font-black text-foreground">{lang === 'en' ? 'Call Ops' : 'ဆက်သွယ်'}</p>
            <p className="text-[9px] text-muted-foreground">24/7</p>
          </div>
        </a>
        <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}>
          <MessageSquare className="h-5 w-5" style={{ color: 'oklch(0.55 0.18 240)' }} />
          <div>
            <p className="text-xs font-black text-foreground">{lang === 'en' ? 'Live Chat' : 'တိုက်ရိုက်စကား'}</p>
            <p className="text-[9px] text-muted-foreground">{lang === 'en' ? 'Coming soon' : 'မကြာမီ'}</p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="space-y-2.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">FAQ</p>
        {faqs.map(({ q, a }) => (
          <details key={q} className="rounded-2xl overflow-hidden group" style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}>
            <summary className="flex items-center justify-between px-4 py-3.5 cursor-pointer list-none">
              <span className="text-sm font-semibold text-foreground">{q}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-open:rotate-90 transition-transform" />
            </summary>
            <div className="px-4 pb-4 text-sm text-muted-foreground">{a}</div>
          </details>
        ))}
      </div>

      {/* Submit ticket */}
      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
          {lang === 'en' ? 'Submit Ticket' : 'တိကက် တင်သွင်း'}
        </p>
        {sent ? (
          <div className="rounded-2xl p-5 text-center" style={{ background: 'oklch(0.62 0.18 152 / 0.10)', border: '1px solid oklch(0.62 0.18 152 / 0.25)' }}>
            <p className="text-sm font-bold" style={{ color: 'oklch(0.62 0.18 152)' }}>
              {lang === 'en' ? '✅ Ticket submitted! Our team will reach you soon.' : '✅ တိကက် တင်သွင်းပြီး!'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl p-4" style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder={lang === 'en' ? 'Subject' : 'ခေါင်းစဉ်'}
              className="w-full rounded-xl px-4 py-3 text-sm bg-background text-foreground border border-border outline-none focus:border-primary"
            />
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              placeholder={lang === 'en' ? 'Describe your issue…' : 'ပြဿနာ ဖော်ပြပါ…'}
              className="w-full rounded-xl px-4 py-3 text-sm bg-background text-foreground border border-border outline-none focus:border-primary resize-none"
            />
            {error && <p className="text-xs" style={{ color: 'oklch(0.72 0.15 15)' }}>{error}</p>}
            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full rounded-2xl py-3 text-sm font-black uppercase tracking-wide transition-all disabled:opacity-60"
              style={{ background: 'oklch(0.83 0.175 96)', color: 'oklch(0.09 0.028 256)' }}
            >
              {sending ? (lang === 'en' ? 'Sending…' : 'ပို့နေသည်…') : (lang === 'en' ? 'Send' : 'ပို့')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
