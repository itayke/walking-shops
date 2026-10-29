interface ImportMetaEnv {
  // Deployed relay host (e.g. walking-shops.example.workers.dev); unset in dev
  readonly VITE_PARTY_HOST?: string;
  // Deployed phone app URL; unset in dev
  readonly VITE_PHONE_URL?: string;
  // This machine's LAN address, set by vite.config.ts so phones on the same Wi-Fi can join in dev
  readonly VITE_LAN_HOST: string;
}
