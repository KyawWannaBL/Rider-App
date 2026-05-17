import { useState, useEffect, useRef } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Clock, Loader2, Database, User, Briefcase, DollarSign, Zap } from 'lucide-react';
import { useAppState } from '@/hooks/useAppState';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

interface PortalSyncCenterProps { role: 'rider' | 'driver' | 'helper'; }

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

interface SyncResult {
  table: string;
  icon: React.ReactNode;
  label: string;
  count: number | null;
  error: string | null;
}

const ROLE_COLOR: Record<string, string> = {
  rider:  'oklch(0.70 0.22 52)',
  driver: 'oklch(0.55 0.18 240)',
  helper: 'oklch(0.60 0.18 300)',
};

export default function PortalSyncCenter({ role }: PortalSyncCenterProps) {
  const { currentUser, language: lang } = useAppState();
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [syncLog, setSyncLog] = useState<SyncResult[]>([]);
  const [autoSync, setAutoSync] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accentColor = ROLE_COLOR[role] ?? ROLE_COLOR.rider;

  const runSync = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setStatus('error');
      setErrorMsg(lang === 'en' ? 'Supabase not configured — add env vars to enable live sync.' : 'Supabase သတ်မှတ်မထားပါ');
      return;
    }
    if (!currentUser?.id) {
      setStatus('error');
      setErrorMsg(lang === 'en' ? 'Not signed in.' : 'ဝင်ရောက်မထားပါ');
      return;
    }
    setStatus('syncing');
    setErrorMsg(null);

    const results: SyncResult[] = [];

    // 1. Profile sync
    try {
      const { data, error } = await supabase.from('profiles').select('id').eq('id', currentUser.id).limit(1);
      results.push({ table: 'profiles', icon: <User className="h-3.5 w-3.5" />, label: lang === 'en' ? 'Profile' : 'ပရိုဖိုင်', count: data?.length ?? 0, error: error?.message ?? null });
    } catch (e: unknown) {
      results.push({ table: 'profiles', icon: <User className="h-3.5 w-3.5" />, label: lang === 'en' ? 'Profile' : 'ပရိုဖိုင်', count: null, error: e instanceof Error ? e.message : 'Error' });
    }

    // 2. Jobs sync
    try {
      const { data, error } = await supabase.from('jobs').select('id').eq('assignee_id', currentUser.id);
      results.push({ table: 'jobs', icon: <Briefcase className="h-3.5 w-3.5" />, label: lang === 'en' ? 'Jobs' : 'အလုပ်များ', count: data?.length ?? 0, error: error?.message ?? null });
    } catch (e: unknown) {
      results.push({ table: 'jobs', icon: <Briefcase className="h-3.5 w-3.5" />, label: lang === 'en' ? 'Jobs' : 'အလုပ်များ', count: null, error: e instanceof Error ? e.message : 'Error' });
    }

    // 3. COD records sync
    try {
      const { data, error } = await supabase.from('cod_records').select('id').eq('collector_id', currentUser.id);
      results.push({ table: 'cod_records', icon: <DollarSign className="h-3.5 w-3.5" />, label: lang === 'en' ? 'COD Records' : 'COD မှတ်တမ်း', count: data?.length ?? 0, error: error?.message ?? null });
    } catch (e: unknown) {
      results.push({ table: 'cod_records', icon: <DollarSign className="h-3.5 w-3.5" />, label: lang === 'en' ? 'COD Records' : 'COD မှတ်တမ်း', count: null, error: e instanceof Error ? e.message : 'Error' });
    }

    setSyncLog(results);
    const anyError = results.some(r => r.error);
    setStatus(anyError ? 'error' : 'success');
    if (anyError) setErrorMsg(lang === 'en' ? 'One or more tables failed. Check log below.' : 'ဇယားအချို့ မအောင်မြင်ပါ');
    setLastSync(new Date().toLocaleString('en-GB', { hour12: false }));
  };

  useEffect(() => {
    if (autoSync) {
      timerRef.current = setInterval(runSync, 60_000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync]);

  const statusConfig = {
    idle:    { icon: <Database className="h-7 w-7" />,              label: lang === 'en' ? 'Ready to Sync' : 'ဆင့်ကဲရန် အသင့်', color: accentColor },
    syncing: { icon: <Loader2 className="h-7 w-7 animate-spin" />,  label: lang === 'en' ? 'Syncing…'      : 'ဆင့်ကဲနေသည်…',    color: 'oklch(0.70 0.18 55)' },
    success: { icon: <CheckCircle2 className="h-7 w-7" />,          label: lang === 'en' ? 'Sync Complete' : 'ဆင့်ကဲပြီး',       color: 'oklch(0.62 0.18 152)' },
    error:   { icon: <AlertCircle className="h-7 w-7" />,           label: lang === 'en' ? 'Sync Failed'   : 'ဆင့်ကဲမအောင်မြင်', color: 'oklch(0.58 0.22 15)' },
  }[status];

  const roleLabel = { rider: lang === 'en' ? 'Rider' : 'ရိုက်ဒါ', driver: lang === 'en' ? 'Driver' : 'ယာဉ်မောင်း', helper: lang === 'en' ? 'Helper' : 'ကူညီသူ' }[role];

  return (
    <div className="p-4 space-y-5 pb-24">
      {/* Header */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{roleLabel} ·&nbsp;
          <span style={{ color: accentColor }}>{lang === 'en' ? 'Enterprise Portal' : 'Enterprise ပေါ်တယ်'}</span>
        </p>
        <h1 className="text-2xl font-black text-foreground mt-0.5">{lang === 'en' ? 'Portal Sync' : 'ပေါ်တယ် ဆင့်ကဲ'}</h1>
      </div>

      {/* Status card */}
      <div className="rounded-2xl p-6 flex flex-col items-center text-center gap-4"
        style={{ background: `${statusConfig.color}11`, border: `1.5px solid ${statusConfig.color}44` }}>
        <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
          style={{ background: `${statusConfig.color}22`, color: statusConfig.color }}>
          {statusConfig.icon}
        </div>
        <div>
          <p className="text-base font-black text-foreground">{statusConfig.label}</p>
          {lastSync && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />
              {lang === 'en' ? 'Last sync:' : 'နောက်ဆုံး:'} {lastSync}
            </p>
          )}
          {errorMsg && <p className="text-xs mt-1.5" style={{ color: 'oklch(0.72 0.15 15)' }}>{errorMsg}</p>}
        </div>
        <button onClick={runSync} disabled={status === 'syncing'}
          className="flex items-center gap-2 px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-wide transition-all disabled:opacity-60 active:scale-[0.97]"
          style={{ background: 'oklch(0.83 0.175 96)', color: 'oklch(0.09 0.028 256)' }}>
          <RefreshCw className={`h-4 w-4 ${status === 'syncing' ? 'animate-spin' : ''}`} />
          {lang === 'en' ? 'Full Sync' : 'အပြည့်ဆင့်ကဲ'}
        </button>
      </div>

      {/* Auto-sync toggle */}
      <div className="flex items-center justify-between rounded-2xl px-4 py-3.5"
        style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}>
        <div className="flex items-center gap-2.5">
          <Zap className="h-4 w-4" style={{ color: accentColor }} />
          <div>
            <p className="text-sm font-semibold text-foreground">{lang === 'en' ? 'Auto-Sync (1 min)' : 'အလိုအလျောက် ဆင့်ကဲ'}</p>
            <p className="text-xs text-muted-foreground">{lang === 'en' ? 'Refresh data every minute' : 'တစ်မိနစ်တစ်ကြိမ် ဆင့်ကဲ'}</p>
          </div>
        </div>
        <button onClick={() => setAutoSync(v => !v)}
          className="w-11 h-6 rounded-full transition-colors relative"
          style={{ background: autoSync ? accentColor : 'oklch(0.22 0.04 260)' }}>
          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${autoSync ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {/* Sync log */}
      {syncLog.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
            {lang === 'en' ? 'Sync Log' : 'ဆင့်ကဲမှတ်တမ်း'}
          </p>
          {syncLog.map(r => (
            <div key={r.table} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: 'oklch(0.14 0.035 258)', border: '1px solid oklch(0.20 0.038 260)' }}>
              <div className="h-7 w-7 rounded-lg flex items-center justify-center"
                style={{ background: r.error ? 'oklch(0.22 0.08 15)' : 'oklch(0.62 0.18 152)22', color: r.error ? 'oklch(0.72 0.15 15)' : 'oklch(0.62 0.18 152)' }}>
                {r.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{r.label}</p>
                {r.error
                  ? <p className="text-xs truncate" style={{ color: 'oklch(0.72 0.15 15)' }}>{r.error}</p>
                  : <p className="text-xs text-muted-foreground">{r.count} {lang === 'en' ? 'records' : 'မှတ်တမ်း'}</p>}
              </div>
              {!r.error && <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'oklch(0.62 0.18 152)' }} />}
              {r.error && <AlertCircle className="h-4 w-4 shrink-0" style={{ color: 'oklch(0.72 0.15 15)' }} />}
            </div>
          ))}
        </div>
      )}

      {/* What syncs */}
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
          {lang === 'en' ? 'What syncs' : 'မည်သည်ကို ဆင့်ကဲမလဲ'}
        </p>
        {[
          lang === 'en' ? 'Job assignments & status updates' : 'အလုပ်သတ်မှတ်ချက်နှင့် အခြေအနေ',
          lang === 'en' ? 'COD collection records'           : 'COD ကောက်ခံမှုမှတ်တမ်းများ',
          lang === 'en' ? 'Profile & role data'              : 'ပရိုဖိုင်နှင့် ရာထူးဒေတာ',
          lang === 'en' ? 'Delivery proof photos'            : 'ပို့ဆောင်သက်သေဓာတ်ပုံများ',
        ].map(item => (
          <div key={item} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-muted/20">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: 'oklch(0.62 0.18 152)' }} />
            <span className="text-sm text-foreground">{item}</span>
          </div>
        ))}
      </div>

      {!isSupabaseConfigured && (
        <div className="rounded-2xl px-4 py-3.5 text-center"
          style={{ background: 'oklch(0.20 0.06 55)', border: '1px solid oklch(0.30 0.10 55)' }}>
          <p className="text-xs font-bold" style={{ color: 'oklch(0.83 0.175 96)' }}>
            {lang === 'en'
              ? '⚠ Supabase not configured — set VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY to enable sync'
              : '⚠ Supabase သတ်မှတ်မထားပါ — VITE_SUPABASE_URL နှင့် VITE_SUPABASE_ANON_KEY ထည့်ပါ'}
          </p>
        </div>
      )}
    </div>
  );
}
