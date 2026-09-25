import fs from "node:fs";

const file = "src/pages/RiderPickupPhotoQrPortal.tsx";
const src = fs.readFileSync(file, "utf8");

const required = [
  "saved: patch.saved ?? parcel.saved",
  "uploadingLine !== null",
  "await selectPickup(current)",
  "be_pickup_parcel_capture_snapshot"
];

let failed = false;
for (const token of required) {
  if (!src.includes(token)) {
    console.error(`Rider pickup save-state contract failed: missing ${token}`);
    failed = true;
  }
}

if (src.includes("saved: patch.saved ?? false")) {
  console.error("Rider pickup save-state contract failed: generic parcel updates must not reset a saved parcel to false.");
  failed = true;
}

if (failed) process.exit(1);
console.log("Rider pickup save-state V135 contract passed.");
