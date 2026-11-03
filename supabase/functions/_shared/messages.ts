/**
 * Notification text, in the same nine languages as the app (first-pass translations, like the
 * app's). Each account gets at most one notification per kind per run: several trials ending
 * at once become one "3 trials end soon" message.
 */

export type Locale = 'en' | 'ja' | 'ko' | 'zh-Hant' | 'zh-Hans' | 'fr' | 'de' | 'es' | 'it';
const LOCALES: Locale[] = ['en', 'ja', 'ko', 'zh-Hant', 'zh-Hans', 'fr', 'de', 'es', 'it'];

interface Texts {
  ranchTitle: string;
  ranchBody: string;
  trialTitle: string;     // {name}
  trialBody: string;      // {when}
  trialsTitle: string;    // {count}
  trialsBody: string;     // {names}
  listJoin: string;
}

const TEXTS: Record<Locale, Texts> = {
  en: {
    ranchTitle: 'The Roster Ranch has refreshed',
    ranchBody: 'New recruits are waiting. Check them against your roster.',
    trialTitle: '{name}’s trial is ending',
    trialBody: 'It ends {when}. Recruit it permanently or return it to the Ranch.',
    trialsTitle: '{count} trials are ending',
    trialsBody: '{names}. Recruit them permanently or return them to the Ranch.',
    listJoin: ', ',
  },
  ja: {
    ranchTitle: 'ロースター牧場が更新されました',
    ranchBody: '新しいポケモンが来ています。ロースターと照らし合わせましょう。',
    trialTitle: '{name}のお試し期間がもうすぐ終わります',
    trialBody: '終了は{when}です。正式に加入させるか、牧場に返しましょう。',
    trialsTitle: '{count}匹のお試し期間がもうすぐ終わります',
    trialsBody: '{names}。正式に加入させるか、牧場に返しましょう。',
    listJoin: '、',
  },
  ko: {
    ranchTitle: '로스터 목장이 새로워졌습니다',
    ranchBody: '새로운 포켓몬이 기다리고 있습니다. 로스터와 비교해 보세요.',
    trialTitle: '{name}의 체험 기간이 곧 끝납니다',
    trialBody: '{when} 끝납니다. 정식으로 영입하거나 목장으로 돌려보내세요.',
    trialsTitle: '체험 기간이 곧 끝나는 포켓몬 {count}마리',
    trialsBody: '{names}. 정식으로 영입하거나 목장으로 돌려보내세요.',
    listJoin: ', ',
  },
  'zh-Hant': {
    ranchTitle: '陣容牧場已更新',
    ranchBody: '有新的寶可夢在等你，快和你的陣容比對一下。',
    trialTitle: '{name} 的試用即將結束',
    trialBody: '將於{when}結束。正式招募牠，或把牠送回牧場。',
    trialsTitle: '{count} 隻寶可夢的試用即將結束',
    trialsBody: '{names}。正式招募牠們，或把牠們送回牧場。',
    listJoin: '、',
  },
  'zh-Hans': {
    ranchTitle: '阵容牧场已更新',
    ranchBody: '有新的宝可梦在等你，快和你的阵容对比一下。',
    trialTitle: '{name} 的试用即将结束',
    trialBody: '将于{when}结束。正式招募它，或把它送回牧场。',
    trialsTitle: '{count} 只宝可梦的试用即将结束',
    trialsBody: '{names}。正式招募它们，或把它们送回牧场。',
    listJoin: '、',
  },
  fr: {
    ranchTitle: 'Le Ranch des recrues s’est renouvelé',
    ranchBody: 'De nouvelles recrues vous attendent. Comparez-les à votre équipe.',
    trialTitle: 'L’essai de {name} se termine',
    trialBody: 'Il se termine {when}. Recrutez-le définitivement ou renvoyez-le au Ranch.',
    trialsTitle: '{count} essais se terminent',
    trialsBody: '{names}. Recrutez-les définitivement ou renvoyez-les au Ranch.',
    listJoin: ', ',
  },
  de: {
    ranchTitle: 'Die Kader-Ranch wurde aufgefrischt',
    ranchBody: 'Neue Rekruten warten. Gleiche sie mit deinem Kader ab.',
    trialTitle: 'Die Probezeit von {name} endet',
    trialBody: 'Sie endet {when}. Rekrutiere es dauerhaft oder schicke es zur Ranch zurück.',
    trialsTitle: '{count} Probezeiten enden',
    trialsBody: '{names}. Rekrutiere sie dauerhaft oder schicke sie zur Ranch zurück.',
    listJoin: ', ',
  },
  es: {
    ranchTitle: 'El Rancho de reclutas se ha renovado',
    ranchBody: 'Hay nuevos reclutas esperando. Compáralos con tu equipo.',
    trialTitle: 'La prueba de {name} está por terminar',
    trialBody: 'Termina {when}. Reclútalo de forma permanente o devuélvelo al Rancho.',
    trialsTitle: '{count} pruebas están por terminar',
    trialsBody: '{names}. Reclútalos de forma permanente o devuélvelos al Rancho.',
    listJoin: ', ',
  },
  it: {
    ranchTitle: 'Il Ranch delle reclute si è rinnovato',
    ranchBody: 'Nuove reclute ti aspettano. Confrontale con la tua squadra.',
    trialTitle: 'La prova di {name} sta per finire',
    trialBody: 'Finisce {when}. Reclutalo in modo permanente o rimandalo al Ranch.',
    trialsTitle: '{count} prove stanno per finire',
    trialsBody: '{names}. Reclutali in modo permanente o rimandali al Ranch.',
    listJoin: ', ',
  },
};

export function toLocale(value: string | null | undefined): Locale {
  return (LOCALES as string[]).includes(value ?? '') ? (value as Locale) : 'en';
}

function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''));
}

/** "in 23 hours", "tomorrow", "dans 2 jours": rounded to hours under a day and a half, else days. */
export function relativeTime(target: Date, now: Date, locale: Locale): string {
  const hours = Math.max(1, Math.round((target.getTime() - now.getTime()) / 3_600_000));
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  return hours < 36 ? format.format(hours, 'hour') : format.format(Math.round(hours / 24), 'day');
}

export interface DueReminder {
  id: string;
  kind: 'ranch_refresh' | 'trial_expiry';
  form_id: string | null;
  trial_expires_at: string | null;
  names: Record<string, string> | null;
}

export interface Notification {
  title: string;
  body: string;
  tag: string;   // the device shows one notification per tag, replacing older ones
  url: string;
  kind: DueReminder['kind'];
}

export function nameIn(reminder: DueReminder, locale: Locale): string {
  return reminder.names?.[locale] ?? reminder.names?.en ?? reminder.form_id ?? '';
}

/** The notifications one account gets this run, in one device's language. */
export function buildNotifications(reminders: DueReminder[], localeValue: string, now = new Date()): Notification[] {
  const locale = toLocale(localeValue);
  const text = TEXTS[locale];
  const out: Notification[] = [];
  if (reminders.some((r) => r.kind === 'ranch_refresh')) {
    out.push({ kind: 'ranch_refresh', title: text.ranchTitle, body: text.ranchBody, tag: 'ranch-refresh', url: '/' });
  }
  const trials = reminders.filter((r) => r.kind === 'trial_expiry' && r.trial_expires_at);
  if (trials.length === 1) {
    const trial = trials[0]!;
    out.push({
      kind: 'trial_expiry',
      title: fill(text.trialTitle, { name: nameIn(trial, locale) }),
      body: fill(text.trialBody, { when: relativeTime(new Date(trial.trial_expires_at!), now, locale) }),
      tag: `trial-${trial.form_id}`,
      url: '/',
    });
  } else if (trials.length > 1) {
    const names = [...new Set(trials.map((t) => nameIn(t, locale)))];
    out.push({
      kind: 'trial_expiry',
      title: fill(text.trialsTitle, { count: trials.length }),
      body: fill(text.trialsBody, { names: names.slice(0, 5).join(text.listJoin) + (names.length > 5 ? '…' : '') }),
      tag: 'trials',
      url: '/',
    });
  }
  return out;
}
