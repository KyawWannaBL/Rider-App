# Rider go-live blocker repair — 12 October 2026

Scope: reproducible dependencies, compiler checks and existing Rider workflows. This change does not sign off the Enterprise Portal or perform a production data cutover.

Changes: align package-lock.json with the declared Capacitor and Tailwind dependencies; remove type-check suppression and fix the surfaced type errors; use global underscore replacement compatible with older WebViews; preserve auth bootstrap cleanup without returning from finally; remove an unreachable legacy delivery panel; point unused Driver/Helper compatibility entry points to maintained authenticated dashboards; type the image worker and handle a missing compression canvas.

Verification: TypeScript `npx tsc -p tsconfig.app.json --noEmit` passed. All six registered verify scripts passed. Vite production build passed. ESLint reports zero errors and 364 warnings; warnings have not been waived or represented as resolved. A fresh `npm ci --ignore-scripts` passed after regenerating the lockfile. Camera, audio, GPS and offline behavior still require real Android phone/tablet testing against the release APK. No APK installation or release workflow has been claimed completed.
