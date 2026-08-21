/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Relative base: the built app works both at the repo root and under a
  // GitHub Pages subpath (https://<user>.github.io/<repo>/).
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Framework/UI vendor code changes rarely; keeping it in its own
        // chunks lets browsers cache it across app-code deploys.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'scheduler'],
          'vendor-ui': ['@appica/ui-react', '@base-ui/react'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
