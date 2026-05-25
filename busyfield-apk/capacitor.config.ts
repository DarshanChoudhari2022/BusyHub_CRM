import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.BuzyHub.field',
  appName: 'BuzyHub Field',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    // Enable WebView geolocation
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // Ensure geolocation works through the WebView
    Geolocation: {
      // Force high-accuracy GPS
    },
  },
};

export default config;
