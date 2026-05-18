// @ts-nocheck
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ListChecks, CheckCircle2, UserCheck, RefreshCw, ArrowRight, PackageOpen, AlertTriangle } from 'lucide-react';
import { useAppState } from '@/hooks/useAppState';
import { ROUTE_PATHS, t } from '@/lib/index';

// Import our cross-portal synchronization hooks
import { pullActiveRiderManifest, useLiveMobileSyncEngine, useIsMobile } from "../hooks/useMobileTaskSync";

export function HelperDashboard() {
  const { currentUser, language: lang } = useAppState();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [syncedBatches, setSyncedBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fallback profile context matching handling for logistics assistant handlers
  const currentHelperName = currentUser?.nameEn || "Ko Kyaw Zin Khant";

  const fetchLiveHelperManifest = async () => {
    setLoading(true);
    try {
      const activeData = await pullActiveRiderManifest(currentHelperName);
      setSyncedBatches(Array.isArray(activeData) ? activeData : []);
    } catch (err) {
      console.error("Helper tracking layout processing exception:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLiveHelperManifest();
  }, [currentHelperName, refreshTrigger]);

  useLiveMobileSyncEngine(currentHelperName, () => {
    void fetchLiveHelperManifest();
  });

  // Calculate cargo item properties
  const metrics = useMemo(() => {
    let totalItems = 0;
    let pendingVerificationCount = 0;

    syncedBatches.forEach((batch) => {
      totalItems += Number(batch.parcel_count || 0);
      if (batch.status !== 'data_entry_ready') {
        pendingVerificationCount += 1;
      }
    });

    return {
      total: totalItems,
      pendingVerification: pendingVerificationCount
    };
  }, [syncedBatches]);

  const stats = [
    { label: lang === 'en' ? 'Total Allocated Batches' : 'စုစုပေါင်းတာဝန်ကျအသုတ်', value: syncedBatches.length, icon: PackageOpen, color: 'oklch(0.55 0.18 240)', nav: ROUTE_PATHS.HELPER_JOBS },
    { label: lang === 'en' ? 'Staged Item Lines Count' : 'တင်ဆောင်ပြီးပစ္စည်းအရေအတွက်', value: metrics.total, icon: ListChecks, color: 'oklch(0.70 0.18 55)', nav: ROUTE_PATHS.HELPER_MANIFEST },
    { label: lang === 'en' ? 'Batches Unverified' : 'စစ်ဆေးရန်ကျန်အသုတ်များ', value: metrics.pendingVerification, icon: AlertTriangle, color: 'oklch(0.68 0.18 45)', nav: ROUTE_PATHS.HELPER_VERIFY },
    { label: lang === 'en' ? 'Team Node Status' : 'အဖွဲ့အခြေအနေ', value: lang === 'en' ? 'Ready' : 'အဆင်သင့်', icon: UserCheck, color: 'oklch(0.62 0.18 152)', nav: ROUTE_PATHS.HELPER_PROFILE },
  ];

  return (
    <div className={`p-4 space-y-5 ${isMobile ? 'w-full' : 'max-w-md mx-auto bg-slate-950 min-h-screen text-slate-100'}`}>
      
      {/* Helper Branding Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="pt-2 flex justify-between items-start">
        <div>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest text-slate-400">
            {lang === 'en' ? 'Operations Assistant Hub,' : 'လက်ထောက်ပေါ်တယ်,'}
          </p>
          <h1 className="text-2xl font-black text-white mt-0.5">
            {currentHelperName}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {currentUser?.teamCode || "CREW-NODE-04"} · {lang === 'en' ? 'Fulfillment Handover Desk' : 'ကုန်ပစ္စည်းလွှဲပြောင်းရေးဌာန'}
          </p>
        </div>
        <button 
          onClick={() => setRefreshTrigger(prev => prev + 1)}
          className="p-3 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </motion.div>

      {/* Helper Analytics Row Stats */}
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

      {/* Checklist Manifest Processing Rows */}
      <div className="space-y-2.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
          {lang === 'en' ? 'Physical Cargo Loading Checklist' : 'ကုန်ပစ္စည်းတင်ဆောင်မှုစစ်ဆေးရန်'}
        </p>
        
        {syncedBatches.map((batch) => (
          <div 
            key={batch.id} 
            className="p-4 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-3"
            style={{ border: '1px solid oklch(0.19 0.036 260)' }}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-emerald-400" />
                <span className="font-mono font-black text-sm text-emerald-400">
                  {batch.display_pickup_id}
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-black px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300">
                {batch.status === 'data_entry_ready' ? 'verified' : 'staged'}
              </span>
            </div>
            <div className="text-xs space-y-1">
              <div className="text-white font-bold">{batch.sender_name || "Su Su Fashion World"}</div>
              <div className="text-slate-400">Township Path: <span className="text-white font-bold">{batch.pickup_township || "ကမာရွတ်"}</span></div>
              <div className="text-slate-400">Checklist Quantities: <span className="font-mono text-white font-bold">{batch.parcel_count} elements bound</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* Helper Quick Actions */}
      <div className="space-y-2.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
          {lang === 'en' ? 'Fulfillment Handover Procedures' : 'ကုန်ပစ္စည်းစိစစ်ခြင်းလုပ်ငန်း'}
        </p>
        {[
          { label: lang === 'en' ? 'Verify Warehouse Pallet Intake' : 'ဂိုဒေါင်ပစ္စည်းအဝင်စိစစ်ရန်', path: ROUTE_PATHS.HELPER_VERIFY, color: 'oklch(0.70 0.18 55)' },
          { label: lang === 'en' ? 'Confirm Delivery Dropoff Bundles' : 'ပစ္စည်းပေးအပ်မှုအတည်ပြုချက်', path: ROUTE_PATHS.HELPER_DROPOFF, color: 'oklch(0.62 0.18 152)' },
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
          <CheckCircle2 className="h-10 w-10 text-slate-600 mb-3" />
          <p className="text-sm text-slate-400 font-semibold">
            {lang === 'en' ? 'No physical parcel manifest loading lines allocated yet' : 'အလုပ်မရှိသေးပါ'}
          </p>
        </div>
      )}
    </div>
  );
}