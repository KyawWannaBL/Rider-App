import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.britiumexpress.rider',
  appName: 'Britium Express Rider',
  webDir: 'dist',
  server: {
    url: 'https://britiumexpress.app',
    cleartext: false,
    allowNavigation: [
      'britiumexpress.app',
      'www.britiumexpress.app',
      '*.supabase.co'
    ]
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
