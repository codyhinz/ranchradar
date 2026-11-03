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
  /** ca-pub-… — AdSense → Account → Account information (publisher ID with ca- in front). Turns on the AdSense script, ads.txt and the CSP entries. */
  readonly VITE_ADSENSE_CLIENT?: string;
  /** Numeric id of a display ad unit — AdSense → Ads → By ad unit. Leave unset until approved; no ads show without it. */
  readonly VITE_ADSENSE_SLOT?: string;
  /** The VAPID public key from `npm run vapid` (the same value as the VAPID_PUBLIC_KEY Supabase secret). Leave unset for no reminders. */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

/** The build's short commit (Cloudflare or GitHub), or "dev". Set in vite.config.ts. */
declare const __APP_VERSION__: string;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
