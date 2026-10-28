import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { fillHeaders } from './scripts/lib/headers';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/** Fills the Supabase origin into dist/_headers' CSP once the build has copied it over. */
function securityHeaders(): Plugin {
  let outDir = 'dist';
  let supabaseUrl: string | undefined;
  return {
    name: 'ranchradar-security-headers',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      // loadEnv reads .env files and real environment variables (Cloudflare's build settings).
      supabaseUrl = loadEnv(config.mode, config.root, 'VITE_').VITE_SUPABASE_URL || undefined;
    },
    writeBundle() {
      const file = join(outDir, '_headers');
      writeFileSync(file, fillHeaders(readFileSync(file, 'utf8'), supabaseUrl));
    },
  };
}

/** /privacy and /terms are their own pages. Cloudflare serves them without the .html; this does
 *  the same for the dev and preview servers, which would otherwise hand back the app instead. */
const LEGAL_PAGES = /^\/(privacy|terms)\/?(\?.*)?$/;
function legalPages(): Plugin {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    const match = req.url?.match(LEGAL_PAGES);
    if (match) req.url = `/${match[1]}.html${match[2] ?? ''}`;
    next();
  };
  return {
    name: 'ranchradar-legal-pages',
    configureServer(server) { server.middlewares.use(rewrite); },
    configurePreviewServer(server) { server.middlewares.use(rewrite); },
  };
}

export default defineConfig({
  plugins: [
    react(),
    securityHeaders(),
    legalPages(),
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
        // The legal pages are real pages, not app routes: let them load from the network.
        navigateFallbackDenylist: [/^\/(privacy|terms)(\.html)?\/?$/],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        privacy: fileURLToPath(new URL('./privacy.html', import.meta.url)),
        terms: fileURLToPath(new URL('./terms.html', import.meta.url)),
      },
    },
  },
  test: { globals: true, environment: 'node' },
});
