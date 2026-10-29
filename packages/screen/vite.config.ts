import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { DEV_PORTS } from '../net/src/config.ts';
import { saveTuningPlugin } from './tools/saveTuningPlugin.ts';

const PREVIEW_PORT = 7330;
const CONFIG_PATH = fileURLToPath(new URL('../sim/src/config.ts', import.meta.url));

/** This machine's first LAN IPv4 address, for the join URL phones open in dev. */
function lanHost(): string {
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) return a.address;
  }
  return 'localhost';
}

export default defineConfig({
  plugins: [react(), saveTuningPlugin(CONFIG_PATH)],
  define: { 'import.meta.env.VITE_LAN_HOST': JSON.stringify(lanHost()) },
  server: { port: DEV_PORTS.screen, host: true },
  preview: { port: PREVIEW_PORT, host: true },
});
