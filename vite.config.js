import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // ── Dev server ────────────────────────────────────────────────────────────
  // Proxy /v1/api/* to the IBKR Client Portal Gateway so that:
  //   1. The browser doesn't see a CORS violation (same-origin to the dev server)
  //   2. The self-signed TLS cert from the gateway is handled by Node, not the browser
  // In production (built PWA), the app talks directly to the configured gateway URL.
  server: {
    proxy: {
      '/v1/api': {
        target:       'https://localhost:5000',
        changeOrigin: true,
        secure:       false,   // accept IBKR Gateway self-signed TLS certificate
      },
    },
  },

  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom'],
          'vendor-charts':   ['recharts'],
          'vendor-lwcharts': ['lightweight-charts'],
          'vendor-zustand':  ['zustand'],
          'vendor-datefns':  ['date-fns'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Real Advisor Finanzas',
        short_name: 'RealAdvisor',
        description: 'Tu asistente financiero personal — tarjetas, gastos, flujo de efectivo',
        theme_color: '#070711',
        background_color: '#070711',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 }
            }
          }
        ]
      }
    })
  ]
})
