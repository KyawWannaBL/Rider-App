import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, User } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { DriverBottomNav } from '@/components/DriverBottomNav';
import { HelperBottomNav } from '@/components/HelperBottomNav';
import { useAppState } from '@/hooks/useAppState';

interface AppShellProps {
  role: 'rider' | 'driver' | 'helper';
  onOpenProfile: () => void;
  children: ReactNode;
}

const roleColors = {
  rider:  'oklch(0.68 0.18 45)',
  driver: 'oklch(0.55 0.18 240)',
  helper: 'oklch(0.60 0.18 300)',
};
const roleLabelEn = { rider: 'Rider', driver: 'Driver', helper: 'Helper' };

export function AppShell({ role, onOpenProfile, children }: AppShellProps) {
  const { currentUser } = useAppState();
  const roleColor = roleColors[role];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'oklch(0.09 0.028 256)' }}>
      {/* ── Top bar ── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b border-border"
        style={{ background: 'oklch(0.11 0.030 258 / 0.97)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-black"
            style={{ background: roleColor, color: 'oklch(0.09 0.028 256)' }}
          >
            B
          </div>
          <div>
            <span className="text-xs font-black tracking-widest uppercase text-foreground">BRITIUM</span>
            <span
              className="ml-1.5 text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5"
              style={{ background: `${roleColor}22`, color: roleColor }}
            >
              {roleLabelEn[role]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="relative h-9 w-9 rounded-xl flex items-center justify-center transition-colors hover:bg-muted">
            <Bell className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={onOpenProfile}
            className="h-9 w-9 rounded-xl flex items-center justify-center transition-colors hover:bg-muted"
          >
            {currentUser?.avatar
              ? <img src={currentUser.avatar} alt="" className="h-7 w-7 rounded-lg object-cover" />
              : <User className="h-4 w-4 text-muted-foreground" />
            }
          </button>
        </div>
      </header>

      {/* ── Page content ── */}
      <motion.main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: '72px' }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {children}
      </motion.main>

      {role === 'driver' ? <DriverBottomNav /> : role === 'helper' ? <HelperBottomNav /> : <BottomNav />}
    </div>
  );
}
