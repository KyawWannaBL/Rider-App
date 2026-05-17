import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bike, Truck, HandHelping, Eye, EyeOff, Mail, Lock, IdCard, Loader2, CheckCircle2, Globe2, UserPlus, KeyRound, ArrowLeft, Phone, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppState } from '@/hooks/useAppState';
import { ROUTE_PATHS, LANG, t, type UserRole, type RiderUser, type DriverUser, type HelperUser } from '@/lib/index';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

type AuthMode = 'login' | 'signup' | 'forgot';

const roles: { id: UserRole; icon: typeof Bike; labelEn: string; labelMy: string }[] = [
  { id: 'rider',  icon: Bike,        labelEn: 'Rider',  labelMy: 'ရိုက်ဒါ'  },
  { id: 'driver', icon: Truck,       labelEn: 'Driver', labelMy: 'ဒရိုင်ဘာ' },
  { id: 'helper', icon: HandHelping, labelEn: 'Helper', labelMy: 'ဟယ်လ်ပါ' },
];

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.10 } } };
const itemVariants = { hidden: { opacity: 0, y: 22, filter: 'blur(4px)' }, visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.44, ease: [0.25, 0.46, 0.45, 0.94] } } };

export default function LoginPage() {
  const navigate = useNavigate();
  const { language, setLanguage, setCurrentUser, setActiveRole } = useAppState();

  const [mode, setMode] = useState<AuthMode>('login');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const isEmail = (v: string) => v.includes('@');
  const switchMode = (m: AuthMode) => { setMode(m); setErrors({}); setSuccessMsg(''); setLoginSuccess(false); };

  const buildUser = (profile: Record<string, unknown>, role: UserRole, userId: string): RiderUser | DriverUser | HelperUser => {
    const fullNameVal = (profile.full_name as string) || 'User';
    const common = {
      id: userId, name: fullNameVal, nameEn: fullNameVal, nameMy: fullNameVal,
      zone: (profile.zone as string) || 'Yangon', zoneEn: (profile.zone as string) || 'Yangon', zoneMy: (profile.zone as string) || 'ရန်ကုန်',
      shift: (profile.shift as string) || 'Morning', accountStatus: 'active' as const,
      avatar: (profile.avatar_url as string) || undefined,
    };
    if (role === 'rider')  return { ...common, role: 'rider',  vehicleType: 'Motorcycle', vehicleTypeEn: 'Motorcycle', vehicleTypeMy: 'မော်တော်ဆိုင်ကယ်' };
    if (role === 'driver') return { ...common, role: 'driver', vehiclePlate: (profile.vehicle_plate as string) || 'N/A' };
    return { ...common, role: 'helper', teamId: (profile.team_id as string) || undefined };
  };

  const handleSignUp = async () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Full name is required';
    if (!identifier.trim() || !isEmail(identifier)) errs.identifier = 'Valid email is required';
    if (!password || password.length < 8) errs.password = 'Min 8 characters';
    if (!selectedRole) errs.role = 'Select a role to request';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setIsLoading(true); setErrors({});
    try {
      if (!isSupabaseConfigured || !supabase) throw new Error('Authentication service not configured. Please set up Supabase credentials.');
      const { data, error } = await supabase.auth.signUp({ email: identifier.trim().toLowerCase(), password, options: { data: { full_name: fullName, phone, role: selectedRole } } });
      if (error) throw error;
      if (data.user) {
        await supabase.from('profiles').upsert({ id: data.user.id, full_name: fullName, email: identifier.trim().toLowerCase(), phone, role: selectedRole, is_approved: false, is_active: false });
      }
      setSuccessMsg(language === LANG.en
        ? '✅ Sign up successful! Your account is pending approval from Britium Ventures Management.'
        : '✅ မှတ်ပုံတင်ပြီးပါပြီ! သင့်အကောင့်ကို စီမံခန့်ခွဲမှုမှ ခွင့်ပြုရန် စောင့်ဆိုင်းနေပါသည်');
    } catch (err: unknown) { setErrors({ general: err instanceof Error ? err.message : 'Sign up failed' }); }
    setIsLoading(false);
  };

  const handleForgot = async () => {
    if (!identifier.trim() || !isEmail(identifier)) { setErrors({ identifier: 'Valid email is required' }); return; }
    setIsLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) throw new Error('Authentication service not configured.');
      const { error } = await supabase.auth.resetPasswordForEmail(identifier.trim().toLowerCase(), { redirectTo: `${window.location.origin}/#/reset-password` });
      if (error) throw error;
      setSuccessMsg(language === LANG.en ? '📧 Password reset link sent to your email.' : '📧 စကားဝှက်ပြန်လည်သတ်မှတ်ရန် လင့်ကို ပို့ပြီးပါပြီ');
    } catch (err: unknown) { setErrors({ general: err instanceof Error ? err.message : 'Reset failed' }); }
    setIsLoading(false);
  };

  const handleLogin = async () => {
    const errs: Record<string, string> = {};
    if (!identifier.trim()) errs.identifier = 'Email or Employee ID is required';
    if (!password.trim()) errs.password = 'Password is required';
    if (!selectedRole) errs.role = 'Select your role';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setIsLoading(true); setErrors({});
    try {
      if (!isSupabaseConfigured || !supabase) throw new Error('Authentication service not configured. Contact your admin to set up Supabase.');
      let loginEmail = identifier.trim();
      if (!isEmail(loginEmail)) {
        const { data } = await supabase.from('profiles').select('email').or(`full_name.ilike.${loginEmail},email.ilike.${loginEmail}@%`).limit(1).maybeSingle();
        loginEmail = (data as Record<string, string> | null)?.email ?? '';
        if (!loginEmail) { setErrors({ general: 'Employee ID not found. Try your email.' }); setIsLoading(false); return; }
      }
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      if (authError) { setErrors({ general: 'Invalid credentials. Please try again.' }); setIsLoading(false); return; }
      if (!authData.user) { setErrors({ general: 'Login failed.' }); setIsLoading(false); return; }
      const superAdmins = ['md@britiumexpress.com', 'sai@britiumexpress.com'];
      if (!superAdmins.includes(loginEmail)) {
        const { data: profileData } = await supabase.from('profiles').select('is_approved,is_active').eq('id', authData.user.id).single();
        if (profileData && !(profileData as Record<string, unknown>).is_approved) { await supabase.auth.signOut(); navigate(ROUTE_PATHS.PENDING); return; }
      }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();
      const p: Record<string, unknown> = (profile as Record<string, unknown>) || {};
      const userObj = buildUser({ ...p, full_name: p.full_name || authData.user.email }, selectedRole, authData.user.id);
      setCurrentUser(userObj); setActiveRole(selectedRole); setLoginSuccess(true);
      await new Promise(r => setTimeout(r, 700));
      if (superAdmins.includes(loginEmail)) { navigate(ROUTE_PATHS.ADMIN); return; }
      if (selectedRole === 'rider') navigate(ROUTE_PATHS.RIDER);
      else if (selectedRole === 'driver') navigate(ROUTE_PATHS.DRIVER);
      else navigate(ROUTE_PATHS.HELPER);
    } catch (e: unknown) { setErrors({ general: e instanceof Error ? e.message : 'Connection error.' }); }
    setIsLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (mode === 'login') handleLogin(); else if (mode === 'signup') handleSignUp(); else handleForgot(); };

  const modeConfig = {
    login:  { title: 'Welcome Back',   titleMy: 'ကြိုဆိုပါသည်',             btn: 'Login',          btnMy: 'ဝင်ရောက်' },
    signup: { title: 'Join the Fleet', titleMy: 'ဝင်ရောက်ပါ',              btn: 'Request Access', btnMy: 'ဝင်ခွင့်တောင်းဆိုရန်' },
    forgot: { title: 'Reset Password', titleMy: 'စကားဝှက်ပြန်လည်သတ်မှတ်', btn: 'Send Reset Link', btnMy: 'လင့်ပို့ရန်' },
  }[mode];

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: 'oklch(0.09 0.028 256)' }}>
      {/* Gradient bg */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(155deg, oklch(0.09 0.028 256) 0%, oklch(0.12 0.040 260) 50%, oklch(0.09 0.028 256) 100%)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, transparent, oklch(0.83 0.175 96 / 0.70) 30%, oklch(0.83 0.175 96) 50%, oklch(0.83 0.175 96 / 0.70) 70%, transparent)' }} />
        <div className="absolute -top-40 -left-28 h-[500px] w-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, oklch(0.48 0.165 264 / 0.12) 0%, transparent 68%)' }} />
        <div className="absolute -bottom-40 -right-20 h-[520px] w-[520px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, oklch(0.83 0.175 96 / 0.06) 0%, transparent 68%)' }} />
      </div>

      {/* Lang toggle */}
      <motion.div className="absolute top-4 right-4 z-20" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
        <button onClick={() => setLanguage(language === LANG.en ? LANG.my : LANG.en)}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all"
          style={{ background: 'oklch(0.15 0.040 260 / 0.80)', border: '1px solid oklch(0.83 0.175 96 / 0.25)', color: 'oklch(0.83 0.175 96)' }}>
          <Globe2 className="h-3.5 w-3.5" />{language === LANG.en ? 'မြန်မာ' : 'EN'}
        </button>
      </motion.div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 py-10">
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-[430px] space-y-5">

          {/* Logo */}
          <motion.div variants={itemVariants} className="flex flex-col items-center gap-3 text-center">
            <div className="relative h-24 w-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full" style={{ background: 'conic-gradient(from 0deg, oklch(0.83 0.175 96 / 0.90), oklch(0.72 0.165 85 / 0.60), transparent 60%, oklch(0.83 0.175 96 / 0.90))', padding: '2px', borderRadius: '9999px' }} />
              <div className="absolute inset-[2.5px] rounded-full" style={{ background: 'linear-gradient(145deg, oklch(0.18 0.042 260), oklch(0.12 0.030 256))' }} />
              <div className="relative z-10 flex h-[84px] w-[84px] items-center justify-center rounded-full" style={{ background: 'linear-gradient(145deg, oklch(0.15 0.038 258), oklch(0.10 0.028 256))' }}>
                <span className="text-3xl font-black" style={{ color: 'oklch(0.83 0.175 96)' }}>B</span>
              </div>
            </div>
            <div>
              <h1 className="text-[34px] font-black tracking-tight leading-none" style={{ color: 'oklch(0.96 0.006 230)' }}>BRITIUM</h1>
              <div className="mt-0.5 flex items-center justify-center gap-1.5">
                <div className="h-[1px] w-8" style={{ background: 'linear-gradient(to right, transparent, oklch(0.83 0.175 96 / 0.60))' }} />
                <p className="text-[11px] font-bold uppercase tracking-[0.20em]" style={{ color: 'oklch(0.83 0.175 96)' }}>{t('app.subtitle', language)}</p>
                <div className="h-[1px] w-8" style={{ background: 'linear-gradient(to left, transparent, oklch(0.83 0.175 96 / 0.60))' }} />
              </div>
            </div>
          </motion.div>

          {/* Mode tabs */}
          <motion.div variants={itemVariants} className="flex rounded-2xl p-1" style={{ background: 'oklch(0.12 0.035 258 / 0.90)', border: '1px solid oklch(0.83 0.175 96 / 0.12)' }}>
            {(['login', 'signup', 'forgot'] as AuthMode[]).map(m => (
              <button key={m} onClick={() => switchMode(m)} className="relative flex-1 rounded-xl py-2.5 text-[11px] font-bold uppercase tracking-wide transition-colors duration-200" style={{ color: mode === m ? 'oklch(0.09 0.025 260)' : 'oklch(0.50 0.020 240)' }}>
                {mode === m && <motion.div layoutId="tab-active" className="absolute inset-0 rounded-xl" style={{ background: 'linear-gradient(135deg, oklch(0.88 0.175 96), oklch(0.72 0.165 85))' }} transition={{ duration: 0.25 }} />}
                <span className="relative z-10">{m === 'login' ? (language === LANG.en ? 'Login' : 'ဝင်ရောက်') : m === 'signup' ? (language === LANG.en ? 'Sign Up' : 'မှတ်ပုံတင်') : (language === LANG.en ? 'Reset' : 'ပြန်သတ်မှတ်')}</span>
              </button>
            ))}
          </motion.div>

          {/* Main card */}
          <motion.div variants={itemVariants} className="rounded-3xl p-6 space-y-5" style={{ background: 'oklch(0.12 0.033 258 / 0.92)', border: '1px solid oklch(0.83 0.175 96 / 0.15)' }}>
            <div>
              <h2 className="text-xl font-black" style={{ color: 'oklch(0.96 0.006 230)' }}>{language === LANG.en ? modeConfig.title : modeConfig.titleMy}</h2>
              {mode === 'signup' && <p className="mt-0.5 text-xs" style={{ color: 'oklch(0.50 0.020 240)' }}>{language === LANG.en ? 'Submit your details — MD or Sai will approve your account.' : 'MD/Sai ခွင့်ပြုမည်'}</p>}
            </div>

            <AnimatePresence>
              {successMsg && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl border px-4 py-3 text-sm font-medium" style={{ background: 'oklch(0.62 0.18 152 / 0.12)', borderColor: 'oklch(0.62 0.18 152 / 0.35)', color: 'oklch(0.75 0.12 152)' }}>{successMsg}</motion.div>}
              {errors.general && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl border px-4 py-3 text-xs font-semibold" style={{ background: 'oklch(0.58 0.22 15 / 0.10)', borderColor: 'oklch(0.58 0.22 15 / 0.30)', color: 'oklch(0.72 0.15 15)' }}>{errors.general}</motion.div>}
            </AnimatePresence>

            {/* Supabase not configured notice */}
            {!isSupabaseConfigured && (
              <div className="rounded-2xl border px-4 py-3 text-xs font-semibold" style={{ background: 'oklch(0.70 0.18 55 / 0.10)', borderColor: 'oklch(0.70 0.18 55 / 0.30)', color: 'oklch(0.85 0.14 55)' }}>
                ⚠️ {language === LANG.en ? 'Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable login.' : 'Supabase သတ်မှတ်မထားပါ။ VITE_SUPABASE_URL နှင့် VITE_SUPABASE_ANON_KEY ထည့်ပါ'}
              </div>
            )}

            {/* Role selector */}
            {mode !== 'forgot' && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'oklch(0.50 0.020 240)' }}>{mode === 'signup' ? (language === LANG.en ? 'Requesting Role' : 'တောင်းဆိုသောအခန်းကဏ္ဍ') : (language === LANG.en ? 'Select Role' : 'အခန်းကဏ္ဍ ရွေးချယ်ပါ')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {roles.map(({ id, icon: Icon, labelEn, labelMy }) => {
                    const active = selectedRole === id;
                    return (
                      <motion.button key={id} whileTap={{ scale: 0.94 }} onClick={() => { setSelectedRole(id); setErrors(e => ({ ...e, role: '' })); }}
                        className="relative flex flex-col items-center gap-1.5 rounded-2xl p-3 transition-all duration-200"
                        style={active ? { border: '1px solid oklch(0.83 0.175 96 / 0.80)', background: 'oklch(0.83 0.175 96 / 0.10)', boxShadow: '0 0 0 1px oklch(0.83 0.175 96 / 0.25)' } : { border: '1px solid oklch(0.22 0.040 262)', background: 'oklch(0.14 0.036 258 / 0.60)' }}>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={active ? { background: 'oklch(0.83 0.175 96 / 0.20)' } : { background: 'oklch(0.18 0.040 260 / 0.80)' }}>
                          <Icon className="h-5 w-5" style={{ color: active ? 'oklch(0.83 0.175 96)' : 'oklch(0.50 0.020 240)' }} />
                        </div>
                        <span className="text-xs font-bold" style={{ color: active ? 'oklch(0.83 0.175 96)' : 'oklch(0.90 0.008 230)' }}>{language === LANG.en ? labelEn : labelMy}</span>
                        {active && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: 'linear-gradient(135deg, oklch(0.88 0.175 96), oklch(0.72 0.165 85))' }}><CheckCircle2 className="h-3 w-3" style={{ color: 'oklch(0.09 0.025 260)' }} /></motion.div>}
                      </motion.button>
                    );
                  })}
                </div>
                {errors.role && <p className="text-xs" style={{ color: 'oklch(0.58 0.22 15)' }}>{errors.role}</p>}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <AnimatePresence>
                {mode === 'signup' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                    <div className="space-y-1"><Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{language === LANG.en ? 'Full Name' : 'အမည်'}</Label>
                      <div className="relative rounded-xl" style={{ border: errors.fullName ? '1px solid oklch(0.58 0.22 15 / 0.60)' : '1px solid oklch(0.22 0.040 262)', background: 'oklch(0.14 0.036 258)' }}>
                        <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none" style={{ color: 'oklch(0.50 0.020 240)' }} />
                        <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="U Kyaw Zin Htet" className="border-0 bg-transparent pl-10 text-sm focus-visible:ring-0 text-foreground" style={{ height: '48px', color: 'oklch(0.96 0.006 230)' }} />
                      </div>{errors.fullName && <p className="text-xs" style={{ color: 'oklch(0.58 0.22 15)' }}>{errors.fullName}</p>}</div>
                    <div className="space-y-1"><Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{language === LANG.en ? 'Phone' : 'ဖုန်း'}</Label>
                      <div className="relative rounded-xl" style={{ border: '1px solid oklch(0.22 0.040 262)', background: 'oklch(0.14 0.036 258)' }}>
                        <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none" style={{ color: 'oklch(0.50 0.020 240)' }} />
                        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="09-XXXXXXX" type="tel" className="border-0 bg-transparent pl-10 text-sm focus-visible:ring-0 text-foreground" style={{ height: '48px', color: 'oklch(0.96 0.006 230)' }} />
                      </div></div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-1"><Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{mode === 'forgot' ? (language === LANG.en ? 'Email Address' : 'အီးမေးလ်') : (language === LANG.en ? 'Email or Employee ID' : 'အီးမေးလ် / ဝန်ထမ်း ID')}</Label>
                <div className="relative rounded-xl" style={{ border: errors.identifier ? '1px solid oklch(0.58 0.22 15 / 0.60)' : '1px solid oklch(0.22 0.040 262)', background: 'oklch(0.14 0.036 258)' }}>
                  {isEmail(identifier) ? <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none" style={{ color: 'oklch(0.83 0.175 96 / 0.70)' }} /> : <IdCard className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none" style={{ color: 'oklch(0.50 0.020 240)' }} />}
                  <Input value={identifier} onChange={e => setIdentifier(e.target.value)} type="text" autoComplete="username" inputMode="email" placeholder={mode === 'forgot' ? 'you@britiumexpress.com' : 'you@britiumexpress.com or EMP001'} className="border-0 bg-transparent pl-10 text-sm focus-visible:ring-0 text-foreground" style={{ height: '48px', color: 'oklch(0.96 0.006 230)' }} />
                </div>{errors.identifier && <p className="text-xs" style={{ color: 'oklch(0.58 0.22 15)' }}>{errors.identifier}</p>}</div>

              {mode !== 'forgot' && (
                <div className="space-y-1"><Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{language === LANG.en ? 'Password' : 'စကားဝှက်'}{mode === 'signup' && <span className="ml-1 opacity-50">(min 8)</span>}</Label>
                  <div className="relative rounded-xl" style={{ border: errors.password ? '1px solid oklch(0.58 0.22 15 / 0.60)' : '1px solid oklch(0.22 0.040 262)', background: 'oklch(0.14 0.036 258)' }}>
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none" style={{ color: 'oklch(0.50 0.020 240)' }} />
                    <Input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} placeholder="••••••••" className="border-0 bg-transparent pl-10 pr-12 text-sm focus-visible:ring-0 text-foreground" style={{ height: '48px', color: 'oklch(0.96 0.006 230)' }} />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: 'oklch(0.50 0.020 240)' }}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  </div>{errors.password && <p className="text-xs" style={{ color: 'oklch(0.58 0.22 15)' }}>{errors.password}</p>}</div>
              )}

              <motion.div whileTap={{ scale: 0.98 }}>
                <button type="submit" disabled={isLoading || !!successMsg} className="relative w-full overflow-hidden rounded-2xl" style={{ height: '52px', background: successMsg ? 'linear-gradient(135deg, oklch(0.55 0.16 152), oklch(0.45 0.14 152))' : 'linear-gradient(135deg, oklch(0.88 0.175 96) 0%, oklch(0.78 0.170 90) 50%, oklch(0.68 0.160 82) 100%)', color: 'oklch(0.09 0.025 260)', fontWeight: 800, fontSize: '15px', letterSpacing: '0.06em', boxShadow: '0 4px 28px oklch(0.83 0.175 96 / 0.42)', border: 'none', cursor: isLoading || !!successMsg ? 'not-allowed' : 'pointer', opacity: isLoading || !!successMsg ? 0.85 : 1 }}>
                  <AnimatePresence mode="wait">
                    {isLoading ? <motion.span key="l" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>{language===LANG.en?'Processing…':'ဆောင်ရွက်နေသည်…'}</motion.span>
                      : successMsg && mode !== 'login' ? <motion.span key="s" initial={{scale:0.7,opacity:0}} animate={{scale:1,opacity:1}} className="flex items-center justify-center gap-2"><CheckCircle2 className="h-4 w-4"/>{language===LANG.en?'Done!':'ပြီးပါပြီ!'}</motion.span>
                      : loginSuccess ? <motion.span key="ok" initial={{scale:0.7,opacity:0}} animate={{scale:1,opacity:1}} className="flex items-center justify-center gap-2"><CheckCircle2 className="h-4 w-4"/>{language===LANG.en?'Welcome!':'ကြိုဆိုပါသည်!'}</motion.span>
                      : <motion.span key="i" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center justify-center gap-2">{mode==='signup'?<UserPlus className="h-4 w-4"/>:mode==='forgot'?<KeyRound className="h-4 w-4"/>:null}{language===LANG.en?modeConfig.btn:modeConfig.btnMy}</motion.span>}
                  </AnimatePresence>
                </button>
              </motion.div>
            </form>

            <div className="flex items-center justify-center gap-4 pt-1">
              {mode !== 'login' && <button onClick={() => switchMode('login')} className="flex items-center gap-1 text-xs font-semibold" style={{ color: 'oklch(0.50 0.020 240)' }}><ArrowLeft className="h-3 w-3"/>{language===LANG.en?'Back to Login':'ဝင်ရောက်မှုသို့'}</button>}
              {mode === 'login' && <><button onClick={() => switchMode('signup')} className="text-xs font-bold" style={{ color: 'oklch(0.83 0.175 96)' }}>{language===LANG.en?'Create Account':'အကောင့်ဖွင့်'}</button><span style={{ color: 'oklch(0.30 0.020 240)' }}>·</span><button onClick={() => switchMode('forgot')} className="text-xs font-semibold" style={{ color: 'oklch(0.50 0.020 240)' }}>{language===LANG.en?'Forgot Password?':'စကားဝှက်မေ့?'}</button></>}
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="rounded-2xl px-4 py-3 text-center" style={{ background: 'oklch(0.83 0.175 96 / 0.06)', border: '1px solid oklch(0.83 0.175 96 / 0.15)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'oklch(0.83 0.175 96 / 0.70)' }}>Production Access</p>
            <p className="mt-0.5 text-[11px]" style={{ color: 'oklch(0.55 0.020 240)' }}>Use your approved Britium employee account. New accounts require admin approval.</p>
          </motion.div>
          <motion.p variants={itemVariants} className="text-center text-[10px]" style={{ color: 'oklch(0.35 0.015 240)' }}>© 2026 Britium Express · Field Operations Platform</motion.p>
        </motion.div>
      </div>
    </div>
  );
}
