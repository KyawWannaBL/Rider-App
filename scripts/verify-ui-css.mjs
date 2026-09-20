import fs from "node:fs";

const files = [
  "src/pages/Login.tsx",
  "src/components/Layout.tsx",
  "src/pages/Dashboard.tsx",
  "src/pages/RiderDashboard.tsx",
  "src/pages/RiderPickupPhotoQrPortal.tsx",
  "src/pages/DeliveryPage.tsx",
  "src/pages/CodSettlementPageForVercel.tsx",
  "src/pages/History.tsx",
  "src/pages/Profile.tsx"
];

const requiredTokens = [
  "min-h-screen",
  "max-w-6xl",
  "max-w-7xl",
  "rounded-3xl",
  "bg-slate-50",
  "bg-white",
  "p-4",
  "p-5",
  "p-6",
  "space-y-4",
  "grid",
  "md:grid-cols-2",
  "lg:grid-cols-2",
  "h-12",
  "w-full",
  "text-slate-950",
  "border-slate-200"
];

const sources = files.map((file) => [file, fs.readFileSync(file, "utf8")]);
const missing = requiredTokens.filter((token) => !sources.some(([, content]) => content.includes(token)));

if (missing.length) {
  console.error("Rider UI verification failed. Missing expected utility usage:", missing.join(", "));
  process.exit(1);
}

const indexCss = fs.readFileSync("src/index.css", "utf8");
if (!indexCss.includes('@import "tailwindcss";')) {
  console.error("Rider UI verification failed: Tailwind v4 import is missing from src/index.css.");
  process.exit(1);
}

if (!indexCss.includes("color: #0f172a") || !indexCss.includes("background: #f8fafc")) {
  console.error("Rider UI verification failed: global light-screen defaults are missing.");
  process.exit(1);
}

console.log("Rider UI source contract passed.");
