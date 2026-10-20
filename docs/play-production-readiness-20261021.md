# Google Play production preparation — 21 October 2026 MMT

## Current Rider production release (Build 127)

- App/package: Britium Express Rider, `com.britiumexpress.rider`.
- Version `1.0.127`, version code `500127`, includes the bulk-photo recovery changes and canonical cross-app numbering fix.
- Source: merged [PR 37](https://github.com/KyawWannaBL/Rider-App/pull/37), `efe4e60e1329c095030784ae1008b9c0a1b278ea`.
- [Signed workflow](https://github.com/KyawWannaBL/Rider-App/actions/runs/39476343457) passed compilation, media-permission and permanent-certificate checks.
- [Current Rider release artifact](https://github.com/KyawWannaBL/Rider-App/actions/runs/39476343457/artifacts/12287944827) contains `Britium-Express-Rider.aab` for Play submission; expires 19 November 2026 UTC.
- Permanent certificate is unchanged from Build 126. Use Build 127's AAB rather than the older production draft or Build 126 artifact.
- Production web deployment and live release manifest are ready. The public Build 127 APK was downloaded and its packaged metadata independently confirmed as Build 127 / version code 500127; the canonical-ID response guard is present in its JavaScript.
- Downloaded APK SHA-256: `1dc57d2a538e5356aa9ec439aa37d02e056ccaa8b95bda50527f0106011ea9da`.
- Verification includes the 99-photo mixed-weight recovery case, canonical UI/QR behavior, eight isolated PostgreSQL cases, fourteen photo-state tests, the existing role/replacement browser flows, production build and native PR CI.

Suggested release notes: Improved pickup photo recovery, weight retention, partial-upload retries and photo replacement. Synchronizes canonical parcel identifiers and review evidence between Rider and Enterprise.

## Verified bulk-photo release (Build 126)

- App: Britium Express Rider, `com.britiumexpress.rider`.
- Release: Build 126, version `1.0.126`, version code `500126`.
- Source: merged [PR 35](https://github.com/KyawWannaBL/Rider-App/pull/35), `b8650b46c9637bf8befd15886139267abb88d1aa`.
- [Signed release workflow](https://github.com/KyawWannaBL/Rider-App/actions/runs/39471265700): successful APK and Android App Bundle build; permanent signing certificate and packaged media-permission checks passed.
- [Release artifact](https://github.com/KyawWannaBL/Rider-App/actions/runs/39471265700/artifacts/12287990089) contains `Britium-Express-Rider.aab`, APK, signing information, permissions and SHA-256 checksums. Artifact retention ends 19 November 2026 UTC. Use the AAB for Play submission.
- Permanent certificate SHA-256: `5552F6CA026D9B3828A883B872993ABD4910821BBFE32A6F6C5F461A1EE07663`.
- Downloaded public APK SHA-256: `26126b07443e868f3385a68db1d6ad3b382e319091c910d8791fc1b01514132a`.
- Downloaded APK's packaged release metadata independently checked: Build 126 / version code 500126. Production web deployment is ready.
- Build configuration targets API 36 with minimum SDK 24. A compatible upload key and version-code ordering must also be checked in the existing Play app; successful standalone APK signing alone does not prove Play accepts an AAB.
- The live [privacy policy](https://www.britiumexpress.com/privacy-policy) and [account-deletion request page](https://www.britiumexpress.app/account-deletion.html) both returned HTTP 200. Rider Profile links to the deletion page. This verifies availability, not completion of the Console's declarations.

## Enterprise release coordination

The Enterprise Play package is `com.britiumexpress.enterpriseportal`. Enterprise Build **116** (`3.0.116`, version code `300116`) was released from merged [PR 199](https://github.com/KyawWannaBL/britium-go-live/pull/199), source `fbbae2244b5c965b737d4ee0b71c392406f3388f`.

- [Signed workflow](https://github.com/KyawWannaBL/britium-go-live/actions/runs/39474365182): successful APK/AAB build and permanent certificate verification.
- [Enterprise release artifact](https://github.com/KyawWannaBL/britium-go-live/actions/runs/39474365182/artifacts/12287384795): includes `Britium-Express-Enterprise.aab` for Play upload; expires 19 November 2026 UTC.
- [Enterprise APK](https://github.com/KyawWannaBL/britium-go-live/releases/download/enterprise-portal-latest/Britium-Enterprise-Portal.apk): downloaded checksum `eadfd8d7a505614a298541ee52a570b53b6c609b6fdf95e10dfc550f029456be` matches the published release asset.
- Certificate SHA-256: `F946F319D4F10D8543AE1E1EA07CB893E27AFE4ACE20CC59DEFC25B282BFDBD3`.
- Production web deployment is ready. Eighteen new synchronization regressions and the existing tests/build passed. Current Rider photos, weights, review status and IDs override stale cached evidence while operator edits survive refresh. Modern rejected photos are visible in Warehouse with the supported replacement action through the assigned Rider; legacy-only Warehouse uploads remain available. Empty photos cannot be approved; audited reason-only exceptions remain in the existing Data Entry workflow.

Use this current signed bundle rather than the older Enterprise production draft. Preserve the Enterprise internal-testing track as well.

## Deployed canonical numbering fix

Production migration `20261020182912_rider_pickup_canonical_capture_sync` replaces only the existing allocator and pickup-save functions. Post-deployment checks confirmed unchanged function ACLs, security-definer settings and assignment guards. Historical records were not renumbered or cleared. The isolated PostgreSQL suite passed eight cases including older provisional-ID callers, reserved aliases, unregistered historical IDs, safe event updates, namespace exhaustion and ACL preservation. The matching Rider client is tracked in [PR 37](https://github.com/KyawWannaBL/Rider-App/pull/37).

## Submission status and remaining verification

No Google Play production submission or approval is claimed. Console access was blocked by automatic browser approval review before the Console could be inspected. The gate evaluated `google.play` although the requested official URL was `https://play.google.com/console/`.

Prior project records identify the Britium Ventures organization account and existing Rider and Enterprise apps with internal-testing releases and older production drafts. Preserve those internal tracks. Recheck current Console state before replacing an older production draft with the current bundle.

Complete the accessible preparation before submitting:

1. Confirm app identity, upload-key compatibility, version-code acceptance and Google-generated bundle checks for Build 126.
2. Validate the production store listing, required image assets, privacy-policy URL, account-deletion link, content rating, target audience, app access and Data safety against actual current behavior.
3. Provide a working, authorized reviewer account with clear instructions for the assigned pickup/photo workflow. Do not place credentials in repository documentation or fabricate reviewer access.
4. Resolve policy, developer verification, financial-feature or other Console declarations using the owner's actual business facts. Do not invent declarations or legal confirmations.
5. Review the available pre-launch report and the cross-app synchronization results. Browser fixture tests do not replace device testing or Google's checks.
6. Submit the approved production release for Google's review when access and declarations are complete. Google determines approval and timing. A saved production draft or uploaded AAB is not production approval.

Official references:

- [Prepare and roll out a release](https://support.google.com/googleplay/android-developer/answer/9859348/prepare-and-roll-out-a-release)
- [Declare your app's data use](https://developer.android.com/privacy-and-security/declare-data-use)
- [Support 16 KB memory page sizes](https://developer.android.com/guide/practices/page-sizes)

## Bulk-photo verification evidence

PR CI passed native compilation and permission checks. Browser regressions using real IndexedDB verified 99 photos with 97 × 2 kg and 2 × 4 kg across full reloads, interrupted uploads on lines 9–11, a 98/99 partial save, and retry of only the missing parcel. Additional tests cover local quota failures, safe replacement previews, persistent backup warnings, account/pickup isolation and compression compatibility.
