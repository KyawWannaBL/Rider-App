# Google Play production preparation — 21 October 2026 MMT

## Verified Rider release

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

The existing Enterprise Play package is `com.britiumexpress.enterpriseportal`. Enterprise Build 115 (`3.0.115`, version code `300115`) was built successfully from PR 198. A subsequent cross-app evidence refresh/review fix is under verification; use its final signed bundle for the Enterprise production submission once released, rather than submitting an older draft. Preserve the Enterprise internal-testing track as well.

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
