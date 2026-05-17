import { useNavigate } from 'react-router-dom';
import { Shield, LogOut } from 'lucide-react';
import { useAppState } from '@/hooks/useAppState';
import { ROUTE_PATHS } from '@/lib/index';
import { supabase } from '@/integrations/supabase/client';
export default function AdminPage() {
  const { setCurrentUser, setActiveRole } = useAppState();
  const navigate = useNavigate();
  const handleLogout = async () => { if (supabase) await supabase.auth.signOut(); setCurrentUser(null); setActiveRole(null); navigate(ROUTE_PATHS.LOGIN); };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5" style={{background:'oklch(0.09 0.028 256)'}}>
      <div className="text-center space-y-5">
        <Shield className="h-16 w-16 mx-auto" style={{color:'oklch(0.83 0.175 96)'}} />
        <h1 className="text-2xl font-black text-foreground">Admin Portal</h1>
        <p className="text-sm text-muted-foreground">Admin dashboard coming soon. You are logged in as a super admin.</p>
        <button onClick={handleLogout} className="flex items-center gap-2 mx-auto text-sm font-bold px-6 py-3 rounded-2xl" style={{background:'oklch(0.58 0.22 15 / 0.12)',color:'oklch(0.72 0.15 15)',border:'1px solid oklch(0.58 0.22 15 / 0.25)'}}>
          <LogOut className="h-4 w-4"/> Logout
        </button>
      </div>
    </div>
  );
}
