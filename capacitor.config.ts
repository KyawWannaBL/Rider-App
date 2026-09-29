import type { CapacitorConfig } from '@capacitor/cli';

// Rider V142 signed APK rebuild trigger: motion and portal visual release.
const config: CapacitorConfig = {
  appId: 'com.britiumexpress.rider',
  appName: 'Britium Express Rider',
  webDir: 'dist',
  server: {
    url: 'https://www.britiumexpress.app',
    cleartext: false,
    allowNavigation: [
      'britiumexpress.app',
      'www.britiumexpress.app',
      '*.supabase.co'
    ],
    errorPath: 'offline.html'
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
