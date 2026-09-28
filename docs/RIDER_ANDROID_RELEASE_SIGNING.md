# Britium Express Rider Android release signing

The Rider Android package identity is permanently kept as `com.britiumexpress.rider`.

## Why this is required

The previous CI workflow created an Android project on every run and used `assembleDebug`. A GitHub-hosted runner can create a new debug keystore, so different builds can have different signing identities. Android and Google Play Protect then treat a newly downloaded APK as an unknown or different developer build.

The production workflow now refuses to build a distributable APK unless the permanent Britium release signing credentials are present.

## Required GitHub Actions secrets

Configure these repository secrets once and keep the keystore backed up offline:

- `RIDER_ANDROID_KEYSTORE_BASE64`
- `RIDER_ANDROID_KEYSTORE_PASSWORD`
- `RIDER_ANDROID_KEY_ALIAS`
- `RIDER_ANDROID_KEY_PASSWORD`
- `RIDER_ANDROID_CERT_SHA256`

Do not commit the JKS/keystore file or passwords to the repository.

## One-time keystore creation

Create the keystore on a trusted workstation:

```bash
keytool -genkeypair -v \
  -keystore britium-rider-release.jks \
  -alias britium-rider \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000
```

Get its SHA-256 certificate fingerprint:

```bash
keytool -list -v -keystore britium-rider-release.jks -alias britium-rider
```

Encode the keystore as a single-line Base64 value before storing it in the GitHub secret:

Linux:

```bash
base64 -w 0 britium-rider-release.jks
```

PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("britium-rider-release.jks"))
```

## Build guarantees

Every production build now:

1. requires the permanent release keystore;
2. builds `assembleRelease`, never `assembleDebug`;
3. builds an AAB for Google Play;
4. increments Android `versionCode` from the GitHub run number;
5. verifies the APK certificate with `apksigner`;
6. compares the certificate SHA-256 fingerprint with the pinned permanent fingerprint;
7. publishes only the verified signed APK.

If the key changes accidentally, the workflow fails instead of publishing a Rider APK with a different identity.

## Google Play distribution

For the long-term Play Protect solution, register `com.britiumexpress.rider` in Google Play Console and upload the generated `Britium-Express-Rider.aab` to Internal Testing or Closed Testing. Riders should then install/update through Google Play rather than sideloading APK files.

The same upload key must be retained for future releases unless Google Play's supported upload-key reset process is deliberately used.
