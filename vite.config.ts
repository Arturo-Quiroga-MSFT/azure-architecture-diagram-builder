import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const { version: appVersion } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const enableAdoptionImpact = mode === 'development'
    || env.VITE_ENABLE_ADOPTION_IMPACT === 'true'

  return {
    define: {
      __ENABLE_ADOPTION_IMPACT__: JSON.stringify(enableAdoptionImpact),
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    plugins: [
      react(),
      {
        name: 'aadb-version-manifest',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: `${JSON.stringify({ version: appVersion })}\n`,
          })
        },
      },
    ],
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
      // Pricing JSON is runtime-fetched and must remain as files. Inlining empty
      // or small regional assets would recreate a large JavaScript module graph.
      assetsInlineLimit: 0,
    },
  }
})
