import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const delivery = fs.readFileSync(path.join(root, "src/pages/DeliveryPage.tsx"), "utf8");
const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");

const checks = [
  ["preferred Delivery / Drop-Off UI is preserved", /Delivery \/ Drop-Off Process/],
  ["preferred app shell still routes delivery through DeliveryPage", /path="delivery"[\s\S]{0,120}<DeliveryPage/],
  ["loads modern wayplan jobs", /be_rider_delivery_wayplan_jobs/],
  ["uses strict wayplan action RPC", /be_rider_wayplan_action/],
  ["requires arrived-at-customer before delivery", /ARRIVED_AT_CUSTOMER/],
  ["supports CASH", /CASH/],
  ["supports PREPAID", /PREPAID/],
  ["supports QR payment", /QR/],
  ["supports bank transfer", /BANK_TRANSFER/],
  ["supports mobile wallet", /MOBILE_WALLET/],
  ["captures transaction reference", /transaction_reference/],
  ["captures electronic signature", /signature_(path|payload)|Customer Electronic Signature/],
  ["uploads rider proof", /rider-proofs/],
  ["uploads signature", /ops-signatures/],
  ["captures delivery GPS", /navigator\.geolocation[\s\S]{0,240}getCurrentPosition|getCurrentPosition[\s\S]{0,240}gps_lat/],
  ["submits COD collected", /cod_collected/],
  ["supports failed delivery", /failed_reason|CUSTOMER_UNREACHABLE/],
];

const failures = checks.filter(([, pattern]) => !pattern.test(delivery + "\n" + app)).map(([name]) => name);

if (/be_rider_delivery_dropoff_save/.test(delivery)) {
  failures.push("legacy delivery save RPC is still the primary delivery workflow");
}

if (failures.length) {
  console.error("Preferred Rider UI + Modern Delivery V51 contract FAILED:");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("Preferred Rider UI + Modern Delivery V51 contract PASS");
