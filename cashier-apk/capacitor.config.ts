import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.circlek.cashier',
  appName: 'CK Cashier',
  webDir: 'www', // Placeholder since we load remote URL
  bundledWebRuntime: false,
  server: {
    url: 'https://anhreports.vercel.app/cashier',
    cleartext: true,
  },
  android: {
    backgroundColor: '#0f172a',
  }
};

export default config;
