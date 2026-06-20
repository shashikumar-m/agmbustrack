import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',       // auto-updates service worker silently
      includeAssets: ['favicon.svg', 'icons/*.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Where Is My Bus',
        short_name: 'MyBus',
        description: 'Real-time college bus tracking — live location, ETA, route timeline',
        theme_color: '#1565c0',
        background_color: '#1565c0',
        display: 'standalone',          // opens fullscreen, no browser bar
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        screenshots: [
          {
            src: '/icons/screenshot.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
          },
        ],
        categories: ['transportation', 'utilities'],
        shortcuts: [
          {
            name: 'Find My Bus',
            short_name: 'Search',
            description: 'Search buses by stop',
            url: '/student',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
        ],
        // iOS splash screens
        splash_pages: null,
      },
      workbox: {
        // Cache strategies
        runtimeCaching: [
          {
            // Cache API calls for 5 minutes (live bus data)
            urlPattern: /^https?:\/\/.*\/api\/student\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Cache map tiles for 7 days
            urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 604800 },
            },
          },
          {
            // Cache weather API for 10 minutes
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 600 },
              networkTimeoutSeconds: 8,
            },
          },
          {
            // Cache Leaflet marker icons
            urlPattern: /^https:\/\/unpkg\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 2592000 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 800,
  },
})
