import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");

const guardStart = app.indexOf("function Guard");
const guardEnd = app.indexOf("function LoginPage", guardStart);
const guard = guardStart >= 0 && guardEnd > guardStart ? app.slice(guardStart, guardEnd) : "";

const failures = [];

if (!guard) {
  failures.push("Guard function was not found");
} else {
  const loading = guard.indexOf("if (loading)");
  const noUser = guard.indexOf("if (!user)");
  const checking = guard.indexOf('profileState === "checking"');

  if (loading < 0) failures.push("Guard must handle loading explicitly");
  if (noUser < 0) failures.push("Guard must redirect logged-out users");
  if (checking < 0) failures.push("Guard must retain profile checking splash for signed-in users");
  if (!(loading >= 0 && noUser > loading && checking > noUser)) {
    failures.push("logged-out protected routes must redirect to /login before profile checking can render the splash");
  }
}

if (failures.length) {
  console.error("Rider Auth Recovery V132 contract FAILED:");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("Rider Auth Recovery V132 contract PASS");
