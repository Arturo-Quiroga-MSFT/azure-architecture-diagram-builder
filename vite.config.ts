import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import type { OutputBundle, OutputChunk } from 'rollup'

const { version: appVersion } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const enableAdoptionImpact = mode === 'development'
    || env.VITE_ENABLE_ADOPTION_IMPACT === 'true'
  const emitBundleReport = process.env.AADB_BUNDLE_REPORT === 'true'

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
      ...(emitBundleReport ? [{
        name: 'aadb-bundle-report',
        generateBundle(_options, bundle: OutputBundle) {
          const chunks = Object.values(bundle)
            .filter((item): item is OutputChunk => item.type === 'chunk')
            .map((chunk) => ({
              file: chunk.fileName,
              bytes: Buffer.byteLength(chunk.code),
              gzipBytes: gzipSync(chunk.code).byteLength,
              modules: Object.entries(chunk.modules)
                .map(([module, details]) => ({ module, bytes: details.renderedLength }))
                .sort((left, right) => right.bytes - left.bytes),
            }))
            .sort((left, right) => right.bytes - left.bytes)

          this.emitFile({
            type: 'asset',
            fileName: 'bundle-report.json',
            source: `${JSON.stringify({ version: appVersion, chunks }, null, 2)}\n`,
          })
        },
      }] : []),
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
