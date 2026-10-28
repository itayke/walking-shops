import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { saveTuningPlugin } from './tools/saveTuningPlugin.ts';

// Non-default ports; Vite defaults are taken on this host
const DEV_PORT = 7320;
const PREVIEW_PORT = 7330;
const CONFIG_PATH = fileURLToPath(new URL('../sim/src/config.ts', import.meta.url));

export default defineConfig({
  plugins: [react(), saveTuningPlugin(CONFIG_PATH)],
  server: { port: DEV_PORT, host: true },
  preview: { port: PREVIEW_PORT, host: true },
});
