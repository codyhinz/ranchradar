import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../data/cloud/supabase';
import type { AuthState } from './useAuth';
import { disablePush, enablePush, pushConfigured, pushSupport, refreshPush, type PushSupport } from './push';

/** The Roster Ranch lineup and the free trial recruit come back 22 hours after recruiting. */
export const RANCH_REFRESH_HOURS = 22;
/** Minutes before a trial ends; null is off. Matches the profiles check constraint. */
export const TRIAL_LEADS = [60, 360, 1440, 2880, null] as const;
export type TrialLead = (typeof TRIAL_LEADS)[number];
export const DEFAULT_TRIAL_LEAD: TrialLead = 1440;

export interface Notifications {
  /** Reminders exist in this build and someone is signed in. */
  available: boolean;
  support: PushSupport;
  /** This device gets notifications. */
  thisDevice: boolean;
  /** Some device on the account gets them (this one or another). */
  anyDevice: boolean;
  /** When the next ranch refresh reminder fires, if one is set. */
  ranchAt: Date | null;
  trialLead: TrialLead;
  loaded: boolean;
  turnOn: () => Promise<void>;
  turnOff: () => Promise<void>;
  /** Sets the ranch reminder `minutes` from now (22 hours unless a Quick Coupon shortened it). */
  setRanch: (minutes?: number) => Promise<Date>;
  /** Puts back an earlier reminder (Undo), or clears it when there was none. */
  restoreRanch: (previous: Date | null) => Promise<void>;
  clearRanch: () => Promise<void>;
  setTrialLead: (lead: TrialLead) => Promise<void>;
}

/**
 * Reminders are an account feature: the server sends them, so they need an account to know
 * where. Everything here reads and writes the account directly (it needs a connection), and the
 * trial reminders themselves are scheduled by the database from the synced roster.
 */
export function useNotifications(auth: AuthState, locale: string): Notifications {
  const userId = auth.status === 'signedIn' ? auth.userId : null;
  const available = Boolean(supabase && userId && pushConfigured());
  const [support, setSupport] = useState<PushSupport>(() => pushSupport());
  const [thisDevice, setThisDevice] = useState(false);
  const [devices, setDevices] = useState(0);
  const [ranchAt, setRanchAt] = useState<Date | null>(null);
  const [trialLead, setLead] = useState<TrialLead>(DEFAULT_TRIAL_LEAD);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !userId || !pushConfigured()) return;
    const here = await refreshPush(supabase, locale).catch(() => false);
    const [subs, ranch, profile] = await Promise.all([
      supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }),
      supabase.from('reminders').select('fire_at').eq('kind', 'ranch_refresh').is('sent_at', null)
        .gt('fire_at', new Date().toISOString()).order('fire_at').limit(1).maybeSingle(),
      supabase.from('profiles').select('trial_reminder_minutes').eq('user_id', userId).maybeSingle(),
    ]);
    setThisDevice(here);
    setDevices(subs.count ?? 0);
    setRanchAt(ranch.data?.fire_at ? new Date(ranch.data.fire_at as string) : null);
    if (!profile.error && profile.data) setLead((profile.data.trial_reminder_minutes ?? null) as TrialLead);
    setSupport(pushSupport());
    setLoaded(true);
  }, [userId, locale]);

  useEffect(() => {
    setLoaded(false);
    setThisDevice(false);
    setRanchAt(null);
    void load().catch(() => undefined); // offline: the section shows what it can and retries on open
  }, [load]);

  const turnOn = useCallback(async () => {
    if (!supabase) return;
    try {
      await enablePush(supabase, locale);
    } finally {
      setSupport(pushSupport());
    }
    await load();
  }, [locale, load]);

  const turnOff = useCallback(async () => {
    await disablePush(supabase);
    await load();
  }, [load]);

  const setAt = useCallback(async (at: Date) => {
    if (!supabase) throw new Error('offline');
    const { error } = await supabase.rpc('set_ranch_reminder', { p_fire_at: at.toISOString() });
    if (error) throw error;
    setRanchAt(at);
  }, []);

  const clearRanch = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.from('reminders').delete().eq('kind', 'ranch_refresh').is('sent_at', null);
    if (error) throw error;
    setRanchAt(null);
  }, []);

  const setRanch = useCallback(async (minutes = RANCH_REFRESH_HOURS * 60) => {
    const at = new Date(Date.now() + minutes * 60_000);
    await setAt(at);
    return at;
  }, [setAt]);

  const restoreRanch = useCallback(async (previous: Date | null) => {
    if (previous && previous.getTime() > Date.now()) await setAt(previous);
    else await clearRanch();
  }, [setAt, clearRanch]);

  const setTrialLead = useCallback(async (lead: TrialLead) => {
    if (!supabase || !userId) return;
    const { error } = await supabase.from('profiles').update({ trial_reminder_minutes: lead }).eq('user_id', userId);
    if (error) throw error;
    setLead(lead);
  }, [userId]);

  return {
    available, support, thisDevice, anyDevice: thisDevice || devices > 0, ranchAt, trialLead, loaded,
    turnOn, turnOff, setRanch, restoreRanch, clearRanch, setTrialLead,
  };
}
