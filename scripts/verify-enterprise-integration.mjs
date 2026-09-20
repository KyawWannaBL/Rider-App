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
    "be_set_delivery_reschedule_v71"
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
  "src/pages/Profile.tsx": ["be_rider_profile_snapshot"],
  "src/pages/BranchOfficeSyncPage.tsx": ["loadRiderBranchSnapshot"],
  "src/lib/branchOfficeSyncApi.ts": ["be_rider_branch_snapshot"],
  "src/components/Layout.tsx": ["be_field_team_mobile_snapshot_v77","be_mark_app_notification_read"],
  "src/contexts/AuthContext.tsx": ["be_rider_profile_snapshot"],
  "src/App.tsx": ["pending-approval","profile"]
};

const forbidden = [
  "be_mobile_go_live_snapshot",
  "be_mobile_rider_portal_snapshot",
  '.from("be_app_notifications")',
  ".from('be_app_notifications')"
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

if (failed) process.exit(1);
console.log("Rider Enterprise integration contract passed.");
