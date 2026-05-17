import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home, Briefcase, MapPin, Camera, DollarSign,
  TrendingUp, RefreshCw, HeadphonesIcon, Package,
} from 'lucide-react';
import { ROUTE_PATHS } from '@/lib/index';
import { useAppState } from '@/hooks/useAppState';

const riderTabs = [
  { path: ROUTE_PATHS.RIDER,           icon: Home,            label: 'Home'    },
  { path: ROUTE_PATHS.RIDER_JOBS,      icon: Briefcase,       label: 'Jobs'    },
  { path: ROUTE_PATHS.RIDER_ROUTE,     icon: MapPin,          label: 'Route'   },
  { path: ROUTE_PATHS.RIDER_PROOF,     icon: Camera,          label: 'Proof'   },
  { path: ROUTE_PATHS.RIDER_COD,       icon: DollarSign,      label: 'COD'     },
  { path: ROUTE_PATHS.RIDER_EARNINGS,  icon: TrendingUp,      label: 'Earn'    },
  { path: ROUTE_PATHS.RIDER_PICKUP,    icon: Package,         label: 'Pickup'  },
  { path: ROUTE_PATHS.RIDER_SYNC,      icon: RefreshCw,       label: 'Sync'    },
  { path: ROUTE_PATHS.RIDER_SUPPORT,   icon: HeadphonesIcon,  label: 'Support' },
];

export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border"
      style={{ background: 'oklch(0.12 0.030 258 / 0.97)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex overflow-x-auto scrollbar-hide">
        {riderTabs.map(({ path, icon: Icon, label }) => {
          const active = pathname === path || (path !== ROUTE_PATHS.RIDER && pathname.startsWith(path));
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[56px] py-2 px-1 transition-colors"
              style={{ minHeight: '56px' }}
            >
              <div className="relative">
                <Icon
                  className="h-5 w-5 transition-colors"
                  style={{ color: active ? 'oklch(0.83 0.175 96)' : 'oklch(0.45 0.020 240)' }}
                />
                {active && (
                  <motion.div
                    layoutId="nav-active-dot"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: 'oklch(0.83 0.175 96)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </div>
              <span
                className="text-[9px] font-bold uppercase tracking-wide transition-colors"
                style={{ color: active ? 'oklch(0.83 0.175 96)' : 'oklch(0.40 0.015 240)' }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
