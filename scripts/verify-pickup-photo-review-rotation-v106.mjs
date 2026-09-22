import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const pickup = fs.readFileSync(path.join(root, "src/pages/RiderPickupPhotoQrPortal.tsx"), "utf8");

const checks = [
  ["photo preview opens a dedicated review modal", /setReviewPhoto\(\{[\s\S]{0,180}src:/],
  ["review rotation state exists", /const \[reviewRotation,\s*setReviewRotation\]\s*=\s*useState\(0\)/],
  ["review image uses display-only CSS rotation", /style=\{\{\s*transform:\s*`rotate\(\$\{reviewRotation\}deg\)`/],
  ["rotate-left control changes view by 90 degrees", /setReviewRotation\(\(current\)\s*=>\s*current\s*-\s*90\)/],
  ["rotate-right control changes view by 90 degrees", /setReviewRotation\(\(current\)\s*=>\s*current\s*\+\s*90\)/],
  ["reset control restores zero-degree view", /setReviewRotation\(0\)/],
  ["closing review resets rotation", /function closePhotoReview\(\)[\s\S]{0,220}setReviewRotation\(0\)/],
  ["rotation controls do not rewrite parcel photo data", /function rotatePhotoReview[\s\S]{0,260}setReviewRotation/],
];

const failures = checks.filter(([, pattern]) => !pattern.test(pickup)).map(([name]) => name);

const rotateHandler = pickup.match(/function rotatePhotoReview[\s\S]{0,500}?\n\s*\}/)?.[0] || "";
if (/updateParcel|cargo_photo_file|cargo_photo_data_url|canvas|toBlob|FileReader/.test(rotateHandler)) {
  failures.push("photo review rotation mutates the uploaded/stored proof instead of display state only");
}

if (failures.length) {
  console.error("Pickup photo review rotation V106 contract FAILED:");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("Pickup photo review rotation V106 contract PASS");
