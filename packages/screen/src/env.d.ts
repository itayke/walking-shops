interface ImportMetaEnv {
  // The relay's host, when it's deployed apart from the apps; unset, a deployed app uses its own host
  readonly VITE_PARTY_HOST?: string;
  // The phone app's URL, when it's deployed apart from the screen; unset, the screen's own site
  readonly VITE_PHONE_URL?: string;
  // This machine's LAN address, set by vite.config.ts so phones on the same Wi-Fi can join in dev
  readonly VITE_LAN_HOST: string;
}
