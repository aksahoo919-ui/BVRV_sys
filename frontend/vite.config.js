import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'iskcon-logo.png', 'icons/*.png'],
      manifest: {
        name: 'Sri Sri Radha Madanmohan — BVRV Attendance',
        short_name: 'BVRV Abids',
        description: 'Attendance portal for Bhakti Vriksha and Bhakti Shastri at Sri Sri Radha Madanmohan Mandir, ISKCON Abids, Hyderabad.',
        theme_color: '#0B3B2E',
        background_color: '#FAF7F0',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        // Never let the service worker intercept /api/* requests —
        // OAuth redirects and API calls must go directly to the server.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
