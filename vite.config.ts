import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Allow the MSAL sign-in popup to communicate back to the opener window.
    // Without this, the Microsoft login redirect can split the popup into a
    // separate browsing-context group and MSAL's postMessage handshake times out.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    proxy: {
      // Forward /api/ to the local speech token server (mirrors nginx in production)
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
