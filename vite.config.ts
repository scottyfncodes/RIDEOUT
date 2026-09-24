import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works at https://<user>.github.io/RIDEOUT/ (any repo-name casing)
// and from the Home Screen. Routing is hash-based, so no server rewrites are needed.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { sourcemap: false, chunkSizeWarningLimit: 700 },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/unit/setup.ts'],
  },
});
