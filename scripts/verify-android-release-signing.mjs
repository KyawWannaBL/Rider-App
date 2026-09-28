import fs from 'node:fs';

const workflowPath = '.github/workflows/build-rider-apk.yml';
const workflow = fs.readFileSync(workflowPath, 'utf8');

const requiredTokens = [
  'assembleRelease',
  'bundleRelease',
  'RIDER_ANDROID_KEYSTORE_BASE64',
  'RIDER_ANDROID_KEYSTORE_PASSWORD',
  'RIDER_ANDROID_KEY_ALIAS',
  'RIDER_ANDROID_KEY_PASSWORD',
  'RIDER_ANDROID_CERT_SHA256',
  '--print-certs',
  'versionCode',
  'Britium-Express-Rider.aab',
];

for (const token of requiredTokens) {
  if (!workflow.includes(token)) {
    throw new Error(`Missing release-signing safeguard: ${token}`);
  }
}

if (workflow.includes('assembleDebug') || workflow.includes('app-debug.apk')) {
  throw new Error('Debug APK build remains enabled in production workflow');
}

console.log('Android release signing workflow safeguards verified.');
