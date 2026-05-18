// @ts-nocheck
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Truck, Map, ShieldAlert, CheckCircle, RefreshCw, ArrowRight, Layers, Navigation } from 'lucide-react';
import { useAppState } from '@/hooks/useAppState';
import { ROUTE_PATHS, t } from '@/lib/index';

// Import our cross-portal synchronization hooks
import { pullActiveRiderManifest, useLiveMobileSyncEngine, useIsMobile } from "../hooks/useMobileTaskSync";

export function DriverDashboard() {
  const { currentUser, language: lang } = useAppState();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [syncedBatches, setSyncedBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fallback profile matching context for active driver accounts
  const currentDriverName = currentUser?.nameEn || "Ko Kyaw Zin Khant";

  const fetchLiveDriverManifest = async () => {
    setLoading(true);
    try {
      // Re-uses our optimized manifest pulling hook filtered by active driver assignment states
      const activeData = await pullActiveRiderManifest(currentDriverName);
      setSyncedBatches(Array.isArray(activeData) ? activeData : []);
    } catch (err) {
      console.error("Driver manifest pipeline retrieval crash:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLiveDriverManifest();
  }, [currentDriverName, refreshTrigger]);

  // Handle background realtime database socket changes automatically
  useLiveMobileSyncEngine(currentDriverName, () => {
    void fetchLiveDriverManifest();
  });

  // Calculate live route dispatch metrics
  const metrics = useMemo(() => {
    let pendingRuns = 0;
    let completedRuns = 0;
    let totalWeight = 0;

    syncedBatches.forEach((batch) => {
      if (['assigned', 'data_entry_in_progress'].includes(batch.status)) {
        pendingRuns += 1;
      } else if (batch.status === 'data_entry_ready') {
        completedRuns += 1;
      }
      
      if (Array.isArray(batch.parcels)) {
        batch.parcels.forEach((parcel) => {
          totalWeight += Number(parcel.weight_kg || 1.0);
        });
      }
    });

    return {
      pending: pendingRuns,
      completed: completedRuns,
      weight: totalWeight
    };
  }, [syncedBatches]);

  const stats = [
    { label: lang === 'en' ? 'Assigned Batches' : 'တာဝန်ပေးအသုတ်များ', value: syncedBatches.length, icon: Layers, color: 'oklch(0.55 0.18 240)', nav: ROUTE_PATHS.DRIVER_JOBS },
    { label: lang === 'en' ? 'Staged Runs Pending' : 'ကျန်ရှိသောခရီးစဉ်များ', value: metrics.pending, icon: RefreshCw, color: 'oklch(0.68 0.18 45)', nav: ROUTE_PATHS.DRIVER_JOBS },
    { label: lang === 'en' ? 'Total Manifest Weight' : 'စုစုပေါင်းကုန်အလေးချိန်', value: `${metrics.weight.toFixed(1)} KG`, icon: Truck, color: 'oklch(0.70 0.18 55)', nav: ROUTE_PATHS.DRIVER_MANIFEST },
    { label: lang === 'en' ? 'Completed Runs' : 'ပြီးစီးသောခရီးစဉ်', value: metrics.completed, icon: Navigation, color: 'oklch(0.62 0.18 152)', nav: ROUTE_PATHS.DRIVER_HISTORY },
  ];

  return (
    <div className={`p-4 space-y-5 ${isMobile ? 'w-full' : 'max-w-md mx-auto bg-slate-950 min-h-screen text-slate-100'}`}>
      
      {/* Driver Header Context */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="pt-2 flex justify-between items-start">
        <div>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest text-slate-400">
            {lang === 'en' ? 'Active Driver Fleet Node,' : 'ယာဉ်မောင်းပေါ်တယ်,'}
          </p>
          <h1 className="text-2xl font-black text-white mt-0.5">
            {currentDriverName}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {currentUser?.vehiclePlate || "YGN-4K/9999"} · {lang === 'en' ? 'Heavy Transit Vehicle' : 'ကုန်တင်မော်တော်ယာဉ်'}
          </p>
        </div>
        <button 
          onClick={() => setRefreshTrigger(prev => prev + 1)}
          className="p-3 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </motion.div>

      {/* Driver Stats */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ label, value, icon: Icon, color, nav }, i) => (
          <motion.button
            key={label}
            onClick={() => navigate(nav)}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="rounded-2xl p-4 text-left transition-transform active:scale-[0.97]"
            style={{ background: 'oklch(0.14 0.035 258)', border: '1px solid oklch(0.20 0.038 260)' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: `${color}22` }}>
                <Icon className="h-4.5 w-4.5" style={{ color }} />
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
            </div>
            <p className="text-2xl font-black text-white leading-none font-mono">{loading ? '…' : value}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">{label}</p>
          </motion.button>
        ))}
      </div>

      {/* Mapbox Route Wayplans Manifest Listing Container */}
      <div className="space-y-2.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
          {lang === 'en' ? 'Active Route Map Sequences' : 'ခရီးစဉ်လမ်းကြောင်းပြဇယား'}
        </p>
        
        {syncedBatches.map((batch) => (
          <div 
            key={batch.id} 
            className="p-4 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-3"
            style={{ border: '1px solid oklch(0.19 0.036 260)' }}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Map className="h-4 w-4 text-blue-400" />
                <span className="font-mono font-black text-sm text-blue-400">
                  {batch.display_pickup_id}
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-black px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300">
                {batch.status}
              </span>
            </div>
            <div className="text-xs space-y-1">
              <div className="text-white font-bold">{batch.sender_name || "Su Su Fashion World"}</div>
              <div className="text-slate-400">Destination Context: <span className="font-bold text-white">{batch.pickup_township || "ကမာရွတ်"}</span></div>
              <div className="text-slate-400">Staged Workloads: <span className="font-mono text-white font-bold">{batch.parcels?.length || batch.parcel_count} drops</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* Driver Quick Actions */}
      <div className="space-y-2.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
          {lang === 'en' ? 'Vehicle Gate Logs' : 'မော်တော်ယာဉ်လုပ်ဆောင်ချက်'}
        </p>
        {[
          { label: lang === 'en' ? 'View Optimization Route Sheets' : 'လမ်းကြောင်းမြေပုံစစ်ဆေးရန်', path: ROUTE_PATHS.DRIVER_MAPS, color: 'oklch(0.55 0.18 240)' },
          { label: lang === 'en' ? 'Log Vehicle Pre-inspection' : 'ယာဉ်ကြိုတင်စစ်ဆေးမှုမှတ်တမ်း', path: ROUTE_PATHS.DRIVER_INSPECT, color: 'oklch(0.68 0.18 45)' },
        ].map(({ label, path, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex items-center justify-between w-full rounded-2xl px-4 py-3.5 transition-colors active:bg-slate-900"
            style={{ background: 'oklch(0.13 0.032 258)', border: '1px solid oklch(0.19 0.036 260)' }}
          >
            <span className="text-sm font-semibold text-white">{label}</span>
            <ArrowRight className="h-4 w-4" style={{ color }} />
          </button>
        ))}
      </div>

      {!loading && syncedBatches.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-900/20 rounded-2xl border border-dashed border-slate-800">
          <CheckCircle className="h-10 w-10 text-slate-600 mb-3" />
          <p className="text-sm text-slate-400 font-semibold">
            {lang === 'en' ? 'No active vehicle route wayplans run assigned' : 'အလုပ်မရှိသေးပါ'}
          </p>
        </div>
      )}
    </div>
  );
}