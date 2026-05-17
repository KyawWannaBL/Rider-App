import { useState } from 'react';
import { Camera, CheckCircle2, FileSignature } from 'lucide-react';
import { useAppState } from '@/hooks/useAppState';

interface ProofCaptureProps {
  title: string;
  onSubmit: (data: { trackingNumbers: string[]; count: number; proofType: string }) => void;
}

export function ProofCapture({ title, onSubmit }: ProofCaptureProps) {
  const { language: lang } = useAppState();
  const [tracking, setTracking] = useState('');
  const [proofType, setProofType] = useState<'photo' | 'signature'>('photo');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!tracking.trim()) return;
    onSubmit({ trackingNumbers: [tracking.trim()], count: 1, proofType });
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setTracking(''); }, 2000);
  };

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}>
      <h3 className="text-sm font-black text-foreground">{title}</h3>

      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">
          {lang === 'en' ? 'Tracking Number' : 'ခြေရာခံနံပါတ်'}
        </label>
        <input
          value={tracking}
          onChange={e => setTracking(e.target.value)}
          placeholder="BX-2026-XXXXXX"
          className="w-full rounded-xl px-4 py-3 text-sm font-mono bg-background text-foreground border border-border outline-none focus:border-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[{ t: 'photo', icon: <Camera className="h-4 w-4" />, label: lang === 'en' ? 'Photo' : 'ဓာတ်ပုံ' },
          { t: 'signature', icon: <FileSignature className="h-4 w-4" />, label: lang === 'en' ? 'Signature' : 'လက်မှတ်' }].map(opt => (
          <button
            key={opt.t}
            onClick={() => setProofType(opt.t as typeof proofType)}
            className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-colors"
            style={proofType === opt.t
              ? { background: 'oklch(0.83 0.175 96 / 0.12)', color: 'oklch(0.83 0.175 96)', border: '1px solid oklch(0.83 0.175 96 / 0.40)' }
              : { background: 'oklch(0.10 0.028 256)', color: 'oklch(0.45 0.020 240)', border: '1px solid oklch(0.19 0.036 260)' }}
          >
            {opt.icon} {opt.label}
          </button>
        ))}
      </div>

      {proofType === 'photo' && (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl py-10 cursor-pointer hover:border-primary transition-colors">
          <Camera className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{lang === 'en' ? 'Tap to capture photo' : 'ဓာတ်ပုံရိုက်ရန် နှိပ်ပါ'}</p>
          <input type="file" accept="image/*" capture="environment" className="hidden" />
        </label>
      )}

      {proofType === 'signature' && (
        <div className="border-2 border-dashed border-border rounded-xl h-32 flex items-center justify-center">
          <div className="text-center">
            <FileSignature className="h-8 w-8 text-muted-foreground mx-auto mb-1" />
            <p className="text-sm text-muted-foreground">{lang === 'en' ? 'Draw signature' : 'လက်မှတ်ရေးပါ'}</p>
          </div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!tracking.trim()}
        className="flex items-center justify-center gap-2 w-full rounded-2xl py-3.5 text-sm font-black uppercase tracking-wide transition-all disabled:opacity-50"
        style={{ background: submitted ? 'oklch(0.55 0.16 152)' : 'oklch(0.83 0.175 96)', color: 'oklch(0.09 0.028 256)' }}
      >
        {submitted ? <><CheckCircle2 className="h-4 w-4" /> Done!</> : (lang === 'en' ? 'Submit Proof' : 'သက်သေတင်သွင်း')}
      </button>
    </div>
  );
}
