import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Non-default ports; Vite defaults are taken on this host
const DEV_PORT = 7321;
const PREVIEW_PORT = 7331;

export default defineConfig({
  plugins: [react()],
  // Exposed on the LAN so a real phone can open it
  server: { port: DEV_PORT, host: true },
  preview: { port: PREVIEW_PORT, host: true },
});
