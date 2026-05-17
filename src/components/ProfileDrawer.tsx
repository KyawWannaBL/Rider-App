import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LogOut, User, Mail, MapPin, Clock } from 'lucide-react';
import { useAppState } from '@/hooks/useAppState';
import { ROUTE_PATHS } from '@/lib/index';
import { supabase } from '@/integrations/supabase/client';

interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileDrawer({ open, onClose }: ProfileDrawerProps) {
  const { currentUser, language, setCurrentUser, setActiveRole } = useAppState();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    setCurrentUser(null);
    setActiveRole(null);
    navigate(ROUTE_PATHS.LOGIN);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-border overflow-hidden"
            style={{ background: 'oklch(0.13 0.035 258)' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 35 }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-bold text-foreground">
                {language === 'en' ? 'My Profile' : 'ကျွန်ုပ်၏ ပရိုဖိုင်'}
              </h2>
              <button onClick={onClose} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Profile body */}
            <div className="px-5 py-5 space-y-4">
              {currentUser ? (
                <>
                  <div className="flex items-center gap-4">
                    <div
                      className="h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-black"
                      style={{ background: 'oklch(0.83 0.175 96 / 0.12)', color: 'oklch(0.83 0.175 96)' }}
                    >
                      {currentUser.nameEn.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-base font-bold text-foreground">{currentUser.nameEn}</p>
                      <span
                        className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
                        style={{ background: 'oklch(0.83 0.175 96 / 0.15)', color: 'oklch(0.83 0.175 96)' }}
                      >
                        {currentUser.role}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <ProfileRow icon={<User className="h-4 w-4" />} label="Employee ID" value={currentUser.id.slice(0, 8).toUpperCase()} />
                    <ProfileRow icon={<MapPin className="h-4 w-4" />} label="Zone" value={currentUser.zoneEn} />
                    <ProfileRow icon={<Clock className="h-4 w-4" />} label="Shift" value={currentUser.shift} />
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3 py-4">
                  <User className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Not logged in</p>
                </div>
              )}
            </div>

            {/* Logout */}
            <div className="px-5 pb-8">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full justify-center rounded-2xl py-3.5 text-sm font-bold transition-colors"
                style={{ background: 'oklch(0.58 0.22 15 / 0.12)', color: 'oklch(0.72 0.15 15)', border: '1px solid oklch(0.58 0.22 15 / 0.25)' }}
              >
                <LogOut className="h-4 w-4" />
                {language === 'en' ? 'Logout' : 'ထွက်'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ProfileRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/30">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}
