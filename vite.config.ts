import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { Dex } from '@pkmn/dex';
import { DATA_DIR, readGenerated, readJson, readRegulations, type NameMap } from './scripts/lib/data';
import { megaDisplayName, PAGES_DIR, renderRegulationPages, renderSitemap, type GeneratedPage } from './scripts/lib/regulationPages';
import { fillHeaders, type HeaderSources } from './scripts/lib/headers';
import { adsTxt, checkAdSettings } from './scripts/lib/adsense';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/** Fills the Supabase and Sentry origins into dist/_headers' CSP once the build has copied it over. */
function securityHeaders(): Plugin {
  let outDir = 'dist';
  let sources: HeaderSources = {};
  return {
    name: 'ranchradar-security-headers',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      // loadEnv reads .env files and real environment variables (Cloudflare's build settings).
      const env = loadEnv(config.mode, config.root, 'VITE_');
      sources = { supabaseUrl: env.VITE_SUPABASE_URL || undefined, sentryDsn: env.VITE_SENTRY_DSN || undefined, adsenseClient: env.VITE_ADSENSE_CLIENT || undefined };
    },
    writeBundle() {
      const file = join(outDir, '_headers');
      writeFileSync(file, fillHeaders(readFileSync(file, 'utf8'), sources));
    },
  };
}

/**
 * With VITE_ADSENSE_CLIENT set, every page carries the google-adsense-account meta tag and the site
 * gets an ads.txt, which is what AdSense checks during review. Without it, neither exists.
 */
function adsense(): Plugin {
  let client: string | undefined;
  return {
    name: 'ranchradar-adsense',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, 'VITE_');
      client = checkAdSettings(env.VITE_ADSENSE_CLIENT, env.VITE_ADSENSE_SLOT).client;
    },
    transformIndexHtml() {
      return client ? [{ tag: 'meta', attrs: { name: 'google-adsense-account', content: client }, injectTo: 'head' }] : [];
    },
    generateBundle() {
      if (client) this.emitFile({ type: 'asset', fileName: 'ads.txt', source: adsTxt(client) });
    },
  };
}

/** /about, /privacy and /terms are their own pages. Cloudflare serves them without the .html; this does
 *  the same for the dev and preview servers, which would otherwise hand back the app instead. */
const LEGAL_PAGES = /^\/(about|privacy|terms)\/?(\?.*)?$/;
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

/**
 * The public regulation pages (/regulations/ and /regulations/<id>/) are static HTML built from
 * data/, so search engines can read them. They're written into regulations/ (gitignored) when the
 * config loads, then built as pages of their own like privacy.html. Restart the dev server after
 * changing data/ to see the update.
 */
function writeRegulationPages(): GeneratedPage[] {
  const generated = readGenerated();
  const pages = renderRegulationPages({
    regulations: readRegulations(),
    forms: generated.forms,
    items: generated.items,
    formNames: generated.formNames,
    itemNames: generated.itemNames,
    typeNames: readJson<NameMap>(join(DATA_DIR, 'generated', 'type-names.json')),
    megaName: (id) => {
      const species = Dex.species.get(id);
      return species.exists ? megaDisplayName(species.baseSpecies, species.forme) : id;
    },
  });
  const root = fileURLToPath(new URL('.', import.meta.url));
  rmSync(join(root, PAGES_DIR), { recursive: true, force: true });
  for (const page of pages) {
    const file = join(root, page.file);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, page.html);
  }
  return pages;
}

// Tests load this config too; they don't need the pages.
const regulationPages = process.env.VITEST ? [] : writeRegulationPages();

/** sitemap.xml at the site root, listing the app, every regulation page and the legal pages. */
function sitemap(): Plugin {
  return {
    name: 'ranchradar-sitemap',
    apply: 'build',
    generateBundle() {
      const paths = ['/', ...regulationPages.map((page) => page.path).sort(), '/about', '/privacy', '/terms'];
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: renderSitemap(paths) });
    },
  };
}

/**
 * Sprites of Pokémon that have never been in a regulation: addable, but most people never see
 * them, so they're cached the first time they show up instead of downloaded with every install.
 */
const everLegal = new Set(readRegulations().flatMap((r) => r.forms));
const poolOnlySprites = readGenerated().available.filter((id) => !everLegal.has(id)).map((id) => `sprites/${id}.webp`);

/** Which build this is, for error reports and Report a problem: Cloudflare's commit, else "dev". */
const APP_VERSION = (process.env.WORKERS_CI_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'dev').slice(0, 7);

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  plugins: [
    react(),
    securityHeaders(),
    adsense(),
    legalPages(),
    sitemap(),
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
        // Cache the app, fonts and every sprite that's been in a season so the installed app opens with no signal.
        globPatterns: ['**/*.{js,css,html,woff2,png,webp,svg,ico}'],
        globIgnores: ['**/node_modules/**', ...poolOnlySprites],
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.startsWith('/sprites/'),
          handler: 'CacheFirst',
          options: { cacheName: 'sprites', expiration: { maxEntries: 1000 } },
        }],
        navigateFallback: '/index.html',
        // The legal and regulation pages are real pages, not app routes: never answer them with the app.
        navigateFallbackDenylist: [/^\/(about|privacy|terms)(\.html)?\/?$/, /^\/regulations(\/|$)/],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        about: fileURLToPath(new URL('./about.html', import.meta.url)),
        privacy: fileURLToPath(new URL('./privacy.html', import.meta.url)),
        terms: fileURLToPath(new URL('./terms.html', import.meta.url)),
        notFound: fileURLToPath(new URL('./404.html', import.meta.url)),
        ...Object.fromEntries(regulationPages.map((page) => [
          page.file.replace(/\/index\.html$/, '').replace(/\//g, '-'),
          fileURLToPath(new URL(`./${page.file}`, import.meta.url)),
        ])),
      },
    },
  },
  test: { globals: true, environment: 'node' },
});
