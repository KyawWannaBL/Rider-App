// ─── Route Paths ────────────────────────────────────────────────────────────
export const ROUTE_PATHS = {
  LOGIN: '/',
  PENDING: '/pending',
  ADMIN: '/admin',
  RIDER: '/rider',
  RIDER_JOBS: '/rider/jobs',
  RIDER_ROUTE: '/rider/route',
  RIDER_PROOF: '/rider/proof',
  RIDER_COD: '/rider/cod',
  RIDER_EARNINGS: '/rider/earnings',
  RIDER_SYNC: '/rider/sync',
  RIDER_SUPPORT: '/rider/support',
  RIDER_PICKUP: '/rider/pickup',
  RIDER_PICKUP_FORM: '/rider/pickup-form',
  DRIVER: '/driver',
  DRIVER_JOBS: '/driver/jobs',
  DRIVER_ROUTE: '/driver/route',
  DRIVER_PROOF: '/driver/proof',
  DRIVER_COD: '/driver/cod',
  DRIVER_EARNINGS: '/driver/earnings',
  DRIVER_SYNC: '/driver/sync',
  DRIVER_SUPPORT: '/driver/support',
  DRIVER_PICKUP: '/driver/pickup',
  DRIVER_PICKUP_FORM: '/driver/pickup-form',
  HELPER: '/helper',
  HELPER_JOBS: '/helper/jobs',
  HELPER_ROUTE: '/helper/route',
  HELPER_PROOF: '/helper/proof',
  HELPER_COD: '/helper/cod',
  HELPER_EARNINGS: '/helper/earnings',
  HELPER_SYNC: '/helper/sync',
  HELPER_SUPPORT: '/helper/support',
  HELPER_PICKUP: '/helper/pickup',
  HELPER_PICKUP_FORM: '/helper/pickup-form',
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────
export type UserRole = 'rider' | 'driver' | 'helper';
export type Language = 'en' | 'my';
export type DeliveryStatus = 'success' | 'failed' | 'partial';
export type AccountStatus = 'active' | 'inactive' | 'suspended';

export interface BaseUser {
  id: string;
  name: string;
  nameEn: string;
  nameMy: string;
  zone: string;
  zoneEn: string;
  zoneMy: string;
  shift: string;
  accountStatus: AccountStatus;
  avatar?: string;
}
export interface RiderUser extends BaseUser { role: 'rider'; vehicleType: string; vehicleTypeEn: string; vehicleTypeMy: string; }
export interface DriverUser extends BaseUser { role: 'driver'; vehiclePlate: string; }
export interface HelperUser extends BaseUser { role: 'helper'; teamId?: string; }
export type AppUser = RiderUser | DriverUser | HelperUser;

export interface Job {
  id: string;
  trackingNumber: string;
  recipientName: string;
  recipientPhone: string;
  address: string;
  township: string;
  status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'rto';
  itemPrice: number;
  deliveryFee: number;
  codAmount: number;
  wayId: string;
  merchantName: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  weight?: number;
}

export interface EarningsRecord {
  date: string;
  deliveries: number;
  earnings: number;
  cod: number;
}

export interface CodRecord {
  id: string;
  trackingNumber: string;
  recipientName: string;
  amount: number;
  collected: boolean;
  handedOver: boolean;
  createdAt: string;
}

// ─── Language ────────────────────────────────────────────────────────────────
export const LANG = { en: 'en' as Language, my: 'my' as Language };

const translations: Record<string, Record<Language, string>> = {
  'app.subtitle':          { en: 'Express Delivery Platform', my: 'အမြန်ပို့ဆောင်ရေး ပလက်ဖောင်း' },
  'nav.home':              { en: 'Home',     my: 'ပင်မ' },
  'nav.jobs':              { en: 'Jobs',     my: 'အလုပ်များ' },
  'nav.route':             { en: 'Route',    my: 'လမ်းကြောင်း' },
  'nav.proof':             { en: 'Proof',    my: 'သက်သေ' },
  'nav.cod':               { en: 'COD',      my: 'COD' },
  'nav.earnings':          { en: 'Earnings', my: 'ဝင်ငွေ' },
  'nav.sync':              { en: 'Sync',     my: 'ဆင့်ကဲ' },
  'nav.support':           { en: 'Support',  my: 'ပံ့ပိုး' },
  'nav.pickup':            { en: 'Pickup',   my: 'ကောက်ယူ' },
  'jobs.pickup':           { en: 'Pickup',   my: 'ကောက်ယူ' },
  'jobs.delivery':         { en: 'Delivery', my: 'ပို့ဆောင်' },
  'pickup.submit':         { en: 'Capture proof of pickup or delivery', my: 'ကောက်ယူ/ပို့ဆောင်သက်သေ မှတ်တမ်းတင်ပါ' },
  'pickup.enterTracking':  { en: 'Enter Tracking Number', my: 'ခြေရာခံနံပါတ် ထည့်ပါ' },
  'pickup.drawSignature':  { en: 'Draw signature here', my: 'ဤနေရာတွင် လက်မှတ်ရေးပါ' },
  'pickup.takePhoto':      { en: 'Take a photo of delivered package', my: 'ပို့ဆောင်ပြီးပါကို ဓာတ်ပုံရိုက်ပါ' },
  'delivery.success':      { en: 'Success',  my: 'အောင်မြင်' },
  'delivery.failed':       { en: 'Failed',   my: 'မအောင်မြင်' },
  'delivery.partial':      { en: 'Partial',  my: 'တစ်စိတ်တစ်ပိုင်း' },
  'delivery.notHome':      { en: 'Recipient not home', my: 'လူမရှိ' },
  'delivery.wrongAddress': { en: 'Wrong address',      my: 'လိပ်စာမှားသည်' },
  'delivery.refused':      { en: 'Refused',            my: 'ငြင်းပယ်သည်' },
  'delivery.damaged':      { en: 'Damaged parcel',     my: 'ပစ္စည်းပျက်စီးသည်' },
  'delivery.failureReason':{ en: 'Reason for failure', my: 'မအောင်မြင်ရသည့် အကြောင်းရင်း' },
  'delivery.codCollected': { en: 'COD Collected',      my: 'COD ကောက်ခံပြီး' },
  'delivery.submitProof':  { en: 'Submit Proof',       my: 'သက်သေတင်သွင်း' },
  'common.cancel':         { en: 'Cancel', my: 'ပယ်ဖျက်' },
  'common.loading':        { en: 'Loading…', my: 'ဆောင်ရွက်နေသည်…' },
  'common.noData':         { en: 'No data available', my: 'ဒေတာမရှိပါ' },
  'common.refresh':        { en: 'Refresh', my: 'ပြန်လည်ဆောင်ရွက်' },
  'common.submit':         { en: 'Submit',  my: 'တင်သွင်း' },
  'common.save':           { en: 'Save',    my: 'သိမ်းဆည်း' },
  'common.back':           { en: 'Back',    my: 'နောက်သို့' },
  'status.assigned':       { en: 'Assigned',   my: 'သတ်မှတ်ပြီး' },
  'status.picked_up':      { en: 'Picked Up',  my: 'ကောက်ယူပြီး' },
  'status.in_transit':     { en: 'In Transit', my: 'ပို့ဆောင်နေဆဲ' },
  'status.delivered':      { en: 'Delivered',  my: 'ပို့ပြီး' },
  'status.failed':         { en: 'Failed',     my: 'မအောင်မြင်' },
  'status.rto':            { en: 'RTO',        my: 'ပြန်ပို့' },
  'dashboard.todayDeliveries': { en: "Today's Deliveries", my: 'ယနေ့ ပို့ဆောင်မှုများ' },
  'dashboard.pendingJobs':     { en: 'Pending Jobs',        my: 'စောင့်ဆိုင်းနေသောအလုပ်' },
  'dashboard.codPending':      { en: 'COD Pending',         my: 'COD စောင့်ဆိုင်း' },
  'dashboard.successRate':     { en: 'Success Rate',        my: 'အောင်မြင်မှုနှုန်း' },
  // Driver-specific
  'driver.loadManifest':     { en: 'Load Manifest',         my: 'မန်နီဖက် တင်မည်' },
  'driver.vehicleRoute':     { en: 'Vehicle Route',          my: 'ယာဉ်လမ်းကြောင်း' },
  'driver.totalParcels':     { en: 'Total Parcels',          my: 'စုစုပေါင်း ပစ္စည်း' },
  'driver.completedStops':   { en: 'Completed Stops',        my: 'ပြီးဆုံးသော မှတ်တိုင်' },
  'driver.pendingDeliveries':{ en: 'Pending Deliveries',     my: 'လုပ်ဆောင်ရမည့်' },
  'driver.scanHandover':     { en: 'Scan Handover',          my: 'QR လွှဲပြောင်းစကင်' },
  'driver.confirmHandover':  { en: 'Confirm parcel handover to branch or rider', my: 'ကုမ္ပဏီ/ရိုက်ဒါသို့ လွှဲပြောင်းအတည်ပြု' },
  'driver.toBranch':         { en: 'To Branch',              my: 'ဌာနခွဲသို့' },
  'driver.toRider':          { en: 'To Rider',               my: 'ရိုက်ဒါသို့' },
  'pickup.scan':             { en: 'Scan',                   my: 'စကင်' },
  'route.totalStops':        { en: 'Total Stops',            my: 'စုစုပေါင်း မှတ်တိုင်' },
  'route.completeRoute':     { en: 'Complete Route',         my: 'လမ်းကြောင်းပြီးဆုံး' },
  // Helper-specific
  'helper.teamId':           { en: 'Team ID',                my: 'အဖွဲ့ ID' },
  'helper.assistedStops':    { en: 'Assisted Stops',         my: 'ကူညီသော မှတ်တိုင်' },
  'helper.parcelsHandled':   { en: 'Parcels Handled',        my: 'ကိုင်တွယ်သောပစ္စည်း' },
  'common.success':          { en: 'Success',                my: 'အောင်မြင်' },
  // Sync
  'sync.enterprisePortal':   { en: 'Enterprise Portal',      my: 'ကုမ္ပဏီပေါ်တယ်' },
  'sync.lastSync':           { en: 'Last synced',            my: 'နောက်ဆုံး ဆင့်ကဲ' },
  'sync.fullSync':           { en: 'Full Sync',              my: 'အပြည့်အ၀ ဆင့်ကဲ' },
  'sync.jobsUpdated':        { en: 'Jobs updated',           my: 'အလုပ်များ အပ်ဒိတ်' },
  'sync.codSynced':          { en: 'COD records synced',     my: 'COD မှတ်တမ်း ဆင့်ကဲ' },
  'sync.profileSynced':      { en: 'Profile synced',         my: 'ပရိုဖိုင် ဆင့်ကဲ' },
};

export function t(key: string, lang: Language): string {
  return translations[key]?.[lang] ?? translations[key]?.['en'] ?? key;
}
