/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** https://<project-ref>.supabase.co — Project Settings → Data API */
  readonly VITE_SUPABASE_URL?: string;
  /** sb_publishable_… — Project Settings → API Keys */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
