/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** https://<project-ref>.supabase.co — Project Settings → Data API */
  readonly VITE_SUPABASE_URL?: string;
  /** sb_publishable_… — Project Settings → API Keys */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** https://<key>@o….ingest.sentry.io/… — Sentry project → Settings → Client Keys (DSN). Leave unset for no crash reports. */
  readonly VITE_SENTRY_DSN?: string;
  /** 0x4AAA… — Cloudflare → Turnstile → the widget's site key. Leave unset to skip the bot check (only while CAPTCHA is off in Supabase). */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

/** The build's short commit (Cloudflare or GitHub), or "dev". Set in vite.config.ts. */
declare const __APP_VERSION__: string;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
