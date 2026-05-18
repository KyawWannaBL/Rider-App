import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bike, Truck, HandHelping, Eye, EyeOff, Mail, Lock, IdCard, Loader2, CheckCircle2, Globe2, UserPlus, KeyRound, ArrowLeft, Phone, User } from 'lucide-react';
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

const containerVariants = { 
  hidden: { opacity: 0 }, 
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.05 } } 
};

const itemVariants = { 
  hidden: { opacity: 0, y: 15, filter: 'blur(4px)' }, 
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } } 
};

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
    login:  { title: 'Welcome Back',   titleMy: 'ကြိုဆိုပါသည်',              btn: 'Login',           btnMy: 'ဝင်ရောက်' },
    signup: { title: 'Join the Fleet', titleMy: 'ဝင်ရောက်ပါ',               btn: 'Request Access', btnMy: 'ဝင်ခွင့်တောင်းဆိုရန်' },
    forgot: { title: 'Reset Password', titleMy: 'စကားဝှက်ပြန်လည်သတ်မှတ်', btn: 'Send Reset Link', btnMy: 'လင့်ပို့ရန်' },
  }[mode];

  return (
    <main className="enterprise-auth-wrapper">
      {/* Absolute Language Selector */}
      <div className="absolute top-4 right-4 z-20">
        <button 
          onClick={() => setLanguage(language === LANG.en ? LANG.my : LANG.en)}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all border border-soft"
          style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
        >
          <Globe2 className="h-3.5 w-3.5 text-zinc-400" />
          {language === LANG.en ? 'မြန်မာ' : 'EN'}
        </button>
      </div>

      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-[440px] flex flex-col items-center">
        
        {/* Premium Corporate Header with logo.png */}
        <motion.div variants={itemVariants} className="flex flex-col items-center mb-8 text-center">
          <div className="flex items-center justify-center w-14 h-14 mb-3 overflow-hidden bg-white rounded-xl shadow-sm border border-soft">
            <img 
              src="/logo.png" 
              alt="Britium Logo" 
              className="w-full h-full object-contain" 
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">BRITIUM</h1>
          <p className="mt-1 text-[10px] font-bold tracking-[0.2em] uppercase text-amber-500">
            {t('app.subtitle', language)}
          </p>
        </motion.div>

        {/* Premium Authentication Container */}
        <motion.div variants={itemVariants} className="premium-card w-full">
          
          {/* Unified Segmented Nav Elements */}
          <div className="segmented-control">
            {(['login', 'signup', 'forgot'] as AuthMode[]).map(m => (
              <button 
                key={m} 
                type="button"
                onClick={() => switchMode(m)} 
                className="segment-btn"
                data-active={mode === m ? "true" : "false"}
              >
                {m === 'login' ? (language === LANG.en ? 'Login' : 'ဝင်ရောက်') : m === 'signup' ? (language === LANG.en ? 'Sign Up' : 'မှတ်ပုံတင်') : (language === LANG.en ? 'Reset' : 'ပြန်သတ်မှတ်')}
              </button>
            ))}
          </div>

          <div>
            <h2 className="mb-6 text-lg font-semibold tracking-tight">
              {language === LANG.en ? modeConfig.title : modeConfig.titleMy}
            </h2>

            {/* Dynamic Alerts Platform */}
            <AnimatePresence mode="wait">
              {successMsg && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-3 mb-4 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl">
                  {successMsg}
                </motion.div>
              )}
              {errors.general && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-3 mb-4 text-xs font-medium text-red-700 bg-red-50 border border-red-100 rounded-xl">
                  {errors.general}
                </motion.div>
              )}
              {!isSupabaseConfigured && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 mb-4 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-xl">
                  ⚠️ {language === LANG.en ? 'Supabase configuration missing. Check environment properties.' : 'Supabase သတ်မှတ်မထားပါ။'}
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Functional Role Switch Grid */}
            {mode !== 'forgot' && (
              <div className="mb-6">
                <label className="premium-label">
                  {mode === 'signup' ? (language === LANG.en ? 'Requesting Role' : 'တောင်းဆိုသောအခန်းကဏ္ဍ') : (language === LANG.en ? 'Select Role' : 'အခန်းကဏ္ဍ ရွေးချယ်ပါ')}
                </label>
                <div className="role-grid">
                  {roles.map(({ id, icon: Icon, labelEn, labelMy }) => {
                    const isSelected = selectedRole === id;
                    return (
                      <button 
                        key={id} 
                        type="button"
                        onClick={() => { setSelectedRole(id); setErrors(e => ({ ...e, role: '' })); }}
                        className="role-card" 
                        data-selected={isSelected ? "true" : "false"}
                      >
                        <Icon className="h-5 w-5 mb-1" />
                        <span className="role-label">{language === LANG.en ? labelEn : labelMy}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role}</p>}
              </div>
            )}

            {/* Core Authentication Forms */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence>
                {mode === 'signup' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
                    <div>
                      <label className="premium-label">{language === LANG.en ? 'Full Name' : 'အမည်'}</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                        <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="U Kyaw Zin Htet" className="premium-input pl-10" />
                      </div>
                      {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
                    </div>
                    <div>
                      <label className="premium-label">{language === LANG.en ? 'Phone' : 'ဖုန်း'}</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="09-XXXXXXX" type="tel" className="premium-input pl-10" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className="premium-label">
                  {mode === 'forgot' ? (language === LANG.en ? 'Email Address' : 'အီးမေးလ်') : (language === LANG.en ? 'Email or Employee ID' : 'အီးမေးလ် / ဝန်ထမ်း ID')}
                </label>
                <div className="relative">
                  {isEmail(identifier) ? (
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                  ) : (
                    <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                  )}
                  <Input value={identifier} onChange={e => setIdentifier(e.target.value)} type="text" placeholder={mode === 'forgot' ? 'you@britiumexpress.com' : 'e.g. EMP001'} className="premium-input pl-10" />
                </div>
                {errors.identifier && <p className="text-xs text-red-500 mt-1">{errors.identifier}</p>}
              </div>

              {mode !== 'forgot' && (
                <div>
                  <label className="premium-label">
                    <span>{language === LANG.en ? 'Password' : 'စကားဝှက်'}</span>
                    {mode === 'login' && (
                      <button type="button" onClick={() => switchMode('forgot')} className="text-blue-600 hover:text-blue-700 font-medium no-underline">
                        {language === LANG.en ? 'Forgot?' : 'မေ့သွားသလား?'}
                      </button>
                    )}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                    <Input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} placeholder="••••••••" className="premium-input pl-10 pr-10" />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                </div>
              )}

              {/* Action Executive Trigger */}
              <button 
                type="submit" 
                disabled={isLoading || !!successMsg} 
                className="btn-luxury flex items-center justify-center gap-2"
              >
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {language === LANG.en ? 'Processing…' : 'ဆောင်ရွက်နေသည်…'}
                    </motion.span>
                  ) : successMsg && mode !== 'login' ? (
                    <motion.span key="s" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {language === LANG.en ? 'Done!' : 'ပြီးပါပြီ!'}
                    </motion.span>
                  ) : loginSuccess ? (
                    <motion.span key="ok" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {language === LANG.en ? 'Welcome!' : 'ကြိုဆိုပါသည်!'}
                    </motion.span>
                  ) : (
                    <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                      {mode === 'signup' ? <UserPlus className="h-4 w-4" /> : mode === 'forgot' ? <KeyRound className="h-4 w-4" /> : null}
                      {language === LANG.en ? modeConfig.btn : modeConfig.btnMy}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </form>

            {/* Back Links System */}
            {mode !== 'login' && (
              <div className="flex items-center justify-center mt-6">
                <button type="button" onClick={() => switchMode('login')} className="flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-800">
                  <ArrowLeft className="h-3 w-3" />
                  {language === LANG.en ? 'Back to Login' : 'ဝင်ရောက်မှုသို့'}
                </button>
              </div>
            )}
            {mode === 'login' && (
              <div className="flex items-center justify-center gap-4 mt-6 text-xs font-medium">
                <button type="button" onClick={() => switchMode('signup')} className="text-blue-600 font-bold hover:underline">
                  {language === LANG.en ? 'Create Account' : 'အကောင့်ဖွင့်'}
                </button>
                <span className="text-zinc-300">·</span>
                <button type="button" onClick={() => switchMode('forgot')} className="text-zinc-500 hover:text-zinc-800">
                  {language === LANG.en ? 'Forgot Password?' : 'စကားဝှက်မေ့?'}
                </button>
              </div>
            )}

          </div>
        </motion.div>

        {/* Footer Disclosures */}
        <motion.div variants={itemVariants} className="w-full mt-4 p-3 text-center border border-soft rounded-2xl bg-zinc-50">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Production Access</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Use your approved Britium employee account. New accounts require admin approval.
          </p>
        </motion.div>
        
        <motion.p variants={itemVariants} className="mt-6 text-center text-[10px] text-zinc-400">
          © 2026 Britium Express · Field Operations Platform
        </motion.p>
      </motion.div>
    </main>
  );
}