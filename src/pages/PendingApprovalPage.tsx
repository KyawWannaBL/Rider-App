import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, LogOut } from 'lucide-react';
import { useAppState } from '@/hooks/useAppState';
import { ROUTE_PATHS } from '@/lib/index';
import { supabase } from '@/integrations/supabase/client';
export default function PendingApprovalPage() {
  const { language, setCurrentUser, setActiveRole } = useAppState();
  const navigate = useNavigate();
  const handleLogout = async () => { if (supabase) await supabase.auth.signOut(); setCurrentUser(null); setActiveRole(null); navigate(ROUTE_PATHS.LOGIN); };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5" style={{background:'oklch(0.09 0.028 256)'}}>
      <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} className="w-full max-w-sm text-center space-y-6">
        <div className="h-20 w-20 rounded-[28px] mx-auto flex items-center justify-center" style={{background:'oklch(0.70 0.18 55 / 0.12)',border:'1px solid oklch(0.70 0.18 55 / 0.30)'}}>
          <Clock className="h-10 w-10" style={{color:'oklch(0.70 0.18 55)'}} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground">{language==='en'?'Pending Approval':'ခွင့်ပြုချက် စောင့်နေသည်'}</h1>
          <p className="text-sm text-muted-foreground mt-2">{language==='en'?'Your account is awaiting approval from Britium Ventures Management. You will be notified once approved.':'သင့်အကောင့်ကို Britium စီမံခန့်ခွဲမှုမှ ခွင့်ပြုရန် စောင့်ဆိုင်းနေပါသည်'}</p>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 mx-auto text-sm font-bold px-6 py-3 rounded-2xl" style={{background:'oklch(0.58 0.22 15 / 0.12)',color:'oklch(0.72 0.15 15)',border:'1px solid oklch(0.58 0.22 15 / 0.25)'}}>
          <LogOut className="h-4 w-4"/> {language==='en'?'Logout':'ထွက်'}
        </button>
        <p className="text-[10px] text-muted-foreground">© 2026 Britium Express</p>
      </motion.div>
    </div>
  );
}
