import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { DEV_PORTS } from '../net/src/config.ts';

const PREVIEW_PORT = 7331;

export default defineConfig({
  plugins: [react()],
  // Exposed on the LAN so a real phone can open it
  server: { port: DEV_PORTS.phone, host: true },
  preview: { port: PREVIEW_PORT, host: true },
});
