import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Ask before swapping in a new build, so a new regulation never lands mid-check.
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon.png', 'favicon.ico', 'favicon-32.png'],
      manifest: {
        name: 'RanchRadar',
        short_name: 'RanchRadar',
        description: 'Check Pokémon Champions recruits against your roster.',
        theme_color: '#2b2724',
        background_color: '#1f1b19',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache the app, fonts and every sprite so the installed app opens with no signal.
        globPatterns: ['**/*.{js,css,html,woff2,png,webp,svg,ico}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  test: { globals: true, environment: 'node' },
});
