import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/repkg-rs/',
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    exclude: ['repkg-wasm'],
  },
});
