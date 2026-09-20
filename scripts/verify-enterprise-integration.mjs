import fs from "node:fs";

const contracts = {
  "src/pages/Dashboard.tsx": ["be_rider_dashboard_snapshot"],
  "src/pages/RiderPickupPhotoQrPortal.tsx": [
    "be_field_team_mobile_snapshot_v77",
    "be_pickup_parcel_capture_snapshot",
    "be_pickup_parcel_capture_save",
    'storage.from("rider-proofs")'
  ],
  "src/pages/DeliveryPage.tsx": [
    "be_rider_delivery_wayplan_jobs",
    "be_rider_wayplan_action",
    "be_set_delivery_reschedule_v71",
    "be_field_delivery_failure_reasons_v92"
  ],
  "src/pages/CodSettlementPageForVercel.tsx": [
    "be_rider_delivery_wayplan_jobs",
    "be_current_field_team_identity",
    "be_rider_submit_cod_settlement"
  ],
  "src/pages/WalletPage.tsx": ["be_rider_wallet_snapshot"],
  "src/pages/AvailabilityPage.tsx": ["be_rider_availability_snapshot","be_rider_availability_save"],
  "src/pages/DocumentsPage.tsx": ["be_rider_document_snapshot","be_rider_document_save"],
  "src/pages/SupportPage.tsx": ["be_rider_support_snapshot","be_rider_support_ticket_save"],
  "src/pages/History.tsx": ["be_rider_history_snapshot"],
  "src/pages/Profile.tsx": ["be_field_profile_snapshot_v91","Username","Email"],
  "src/pages/BranchOfficeSyncPage.tsx": ["loadRiderBranchSnapshot"],
  "src/lib/branchOfficeSyncApi.ts": ["be_rider_branch_snapshot"],
  "src/components/Layout.tsx": ["be_field_team_mobile_snapshot_v77","be_mark_app_notification_read"],
  "src/components/ProfileDrawer.tsx": ["be_field_profile_snapshot_v91","Username","Email"],
  "src/components/shared/EarningsPanel.tsx": ["be_field_financial_snapshot_v91","Commission & Earnings"],
  "src/components/shared/SupportPanel.tsx": ["be_rider_support_snapshot","be_rider_support_ticket_save"],
  "src/components/shared/PortalSyncCenter.tsx": ["be_field_profile_snapshot_v91","be_rider_dashboard_snapshot","be_field_financial_snapshot_v91"],
  "src/pages/shared/MobileGoLivePage.tsx": ["EarningsPanel","SupportPanel","Open Strict Delivery Verification","Canonical Pickup Verification"],
  "src/contexts/AuthContext.tsx": ["be_rider_profile_snapshot"],
  "src/App.tsx": ["pending-approval","profile"]
};

const forbidden = [
  "be_mobile_app_my_assignments",
  "be_mobile_app_update_job_status",
  "be_mobile_go_live_snapshot",
  "be_mobile_go_live_waybill_status",
  "be_mobile_go_live_verify_pickup_parcel",
  "be_mobile_go_live_cod_handover",
  "be_mobile_go_live_support_request",
  "be_mobile_go_live_update_waybill_status",
  "be_mobile_rider_portal_snapshot",
  "be_mobile_support_request",
  '.from("be_app_notifications")',
  ".from('be_app_notifications')",
  '.from("support_tickets")',
  ".from('support_tickets')",
  '.from("jobs")',
  ".from('jobs')",
  '.from("cod_records")',
  ".from('cod_records')"
];

let failed=false;
for (const [file,tokens] of Object.entries(contracts)) {
  const src=fs.readFileSync(file,"utf8");
  for (const token of tokens) {
    if (!src.includes(token)) {
      console.error(`Enterprise integration contract failed: ${file} missing ${token}`);
      failed=true;
    }
  }
  for (const token of forbidden) {
    if (src.includes(token)) {
      console.error(`Enterprise integration contract failed: ${file} contains retired path ${token}`);
      failed=true;
    }
  }
}

const app=fs.readFileSync("src/App.tsx","utf8");
for (const route of ["dashboard","jobs","delivery","cod-settlement","wallet","availability","documents","support","history","profile","branch-sync"]) {
  if (!app.includes(`path="${route}"`)) {
    console.error(`Enterprise integration contract failed: active route missing ${route}`);
    failed=true;
  }
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(path);
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [path] : [];
  });
}

for (const file of walk("src")) {
  const src = fs.readFileSync(file, "utf8");
  for (const token of forbidden) {
    if (src.includes(token)) {
      console.error(`Enterprise integration contract failed: repository file ${file} contains retired path ${token}`);
      failed = true;
    }
  }
}




const mobileGoLive = fs.readFileSync("src/pages/shared/MobileGoLivePage.tsx","utf8");
for (const retiredUi of ["Estimated Earnings", 'label="Delivered"', 'label="In Transit"', 'label="Submit Proof"']) {
  if (mobileGoLive.includes(retiredUi)) {
    console.error(`Enterprise integration contract failed: MobileGoLivePage contains retired parallel UI ${retiredUi}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("Rider Enterprise integration contract passed.");
