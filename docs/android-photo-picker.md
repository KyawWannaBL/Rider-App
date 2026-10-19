# Android delivery photo selection

The shared Rider photo helper is used by Rider, Driver and Helper photo flows. Camera capture stays on Capacitor Camera. Gallery selection first attempts the native embedded photo picker, with a standard Android photo-picker fallback through Capacitor Camera 7.

Embedded selection is capability-gated to Android 14 with U SDK Extension 15+, or Android 16+. The AndroidX Views library is pinned to `androidx.photopicker:photopicker:1.0.0-alpha02`; it supports the application's older minimum SDK, but the embedded APIs are never loaded on unsupported devices. Unsupported service/device, session errors, a startup timeout, or the explicit system-picker button fall back to the standard picker. User cancellation and selected-file read failures do not open another picker.

The generated manifest requests the Google Play services photo-picker backport. Devices without a supported photo picker fall back to Android's selected-file document chooser. Broad `READ_MEDIA_IMAGES` and legacy storage permissions are removed. Camera permission is retained. The APK-and-AAB release workflow installs the native bridge. The duplicate APK-only workflow is retired so it cannot cancel the AAB build or overwrite public release metadata. New releases use versionCode 500000 + workflow run number, above both previous 100000 and 400000 series; package and signing identities stay unchanged.

Only a selected, granted image URI is read. The native bridge limits input to 25 MB, decodes a sampled image, applies EXIF orientation, resizes to at most 1600 pixels and returns a JPEG through private app cache. Original input copies are removed immediately; generated cache images older than 24 hours are cleaned on the next selection. Existing preview, upload and reupload handlers continue receiving a File through the shared helper.

## Validation

- Node tests cover embedded success, standard fallback, explicit cancellation, busy-error propagation and read errors. They do not exercise concurrent native calls.
- Python tests exercise generated-manifest/plugin registration and repeatability.
- The unsigned GitHub workflow compiles the actual Java bridge and checks merged APK permissions without release signing secrets or publishing.
- Physical-device checks remain required: standard selection on Android 8/11/13; embedded selection on Android 14 Extension 15+ and Android 16; cancel/back, cloud images, rotated images, picker fallback, camera resume, preview, upload and replacement upload on each workforce role. No such device tests have been claimed.

References: https://developer.android.com/training/data-storage/shared/photo-picker/embedded ; https://developer.android.com/jetpack/androidx/releases/photopicker ; https://capacitorjs.com/docs/v7/apis/camera
