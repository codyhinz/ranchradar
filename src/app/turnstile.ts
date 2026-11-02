import { useCallback, useEffect, useRef, useState } from 'react';
import type { NameLocale } from '../catalog';
import { uiLocale } from '../i18n';

/**
 * Cloudflare Turnstile, the bot check Supabase asks for on email sign-up, sign-in and password
 * reset. Builds without VITE_TURNSTILE_SITE_KEY skip it entirely (local dev, CI, forks), which
 * only works while CAPTCHA protection is off in that Supabase project.
 */
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
/** How long a submit waits for a token, including time to tick the box if Cloudflare asks. */
const TOKEN_WAIT_MS = 60_000;

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}
declare global {
  interface Window { turnstile?: TurnstileApi }
}

/** Matches Supabase's own error code, so both map to the same message. */
export class CaptchaError extends Error {
  readonly code = 'captcha_failed';
  constructor() { super('Bot check did not complete'); this.name = 'CaptchaError'; }
}

const LANGUAGE: Record<NameLocale, string> = {
  en: 'en', ja: 'ja', ko: 'ko', 'zh-Hant': 'zh-tw', 'zh-Hans': 'zh-cn', fr: 'fr', de: 'de', es: 'es', it: 'it',
};

let loading: Promise<TurnstileApi> | null = null;

/** Loads Cloudflare's script once, the first time a form needs it (Cloudflare asks that it isn't self-hosted). */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new CaptchaError()));
    script.onerror = () => { loading = null; reject(new CaptchaError()); };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Puts an invisible Turnstile widget in `ref` while `view` names a form (null = no form shown).
 * It only shows itself when Cloudflare wants an interaction. `take()` hands over a fresh token,
 * waiting for one if it's still on its way; each token is single-use, so the widget then
 * starts on the next one straight away.
 */
export function useTurnstile(view: string | null) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const token = useRef<string | null>(null);
  const waiting = useRef<Array<(value: string | null) => void>>([]);
  const [failed, setFailedState] = useState(false);
  const failedNow = useRef(false);
  // Bumped to rebuild the widget (and reload the script if it never arrived) after a failure.
  const [attempt, setAttempt] = useState(0);
  const setFailed = (value: boolean) => { failedNow.current = value; setFailedState(value); };

  const hand = (value: string | null) => {
    const waiters = waiting.current;
    waiting.current = [];
    waiters.forEach((resolve) => resolve(value));
  };

  useEffect(() => {
    if (!SITE_KEY || !view) return;
    let alive = true;
    setFailed(false);
    loadTurnstile().then((api) => {
      if (!alive || !ref.current) return;
      widget.current = api.render(ref.current, {
        sitekey: SITE_KEY,
        action: 'auth',
        appearance: 'interaction-only',
        size: 'flexible',
        theme: 'auto',
        language: LANGUAGE[uiLocale()],
        callback: (value: string) => { token.current = value; setFailed(false); hand(value); },
        'expired-callback': () => { token.current = null; }, // it fetches a new one by itself
        'error-callback': () => { token.current = null; setFailed(true); hand(null); },
      });
    }).catch(() => {
      if (!alive) return;
      setFailed(true);
      hand(null);
    });
    return () => {
      alive = false;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
      token.current = null;
      hand(null);
    };
  }, [view, attempt]);

  const take = useCallback(async (): Promise<string | undefined> => {
    if (!SITE_KEY) return undefined;
    if (failedNow.current && !token.current) {
      // Start over, so the next try works once the script or connection is back.
      setAttempt((n) => n + 1);
      throw new CaptchaError();
    }
    const value = token.current ?? await new Promise<string | null>((resolve) => {
      waiting.current.push(resolve);
      window.setTimeout(() => resolve(null), TOKEN_WAIT_MS);
    });
    token.current = null;
    if (widget.current) window.turnstile?.reset(widget.current);
    if (!value) throw new CaptchaError();
    return value;
  }, []);

  return { ref, take, failed, enabled: Boolean(SITE_KEY) };
}
