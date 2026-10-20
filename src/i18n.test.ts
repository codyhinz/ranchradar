import { NAME_LOCALES } from './catalog';
import { ownershipText, setUiLocale, t, type MessageKey } from './i18n';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

describe('translations', () => {
  afterEach(() => setUiLocale('en'));

  it('keep every placeholder in every language', () => {
    const english = (key: MessageKey) => { setUiLocale('en'); return t(key); };
    const sample: MessageKey[] = ['search.none', 'own.summary', 'add.permanent', 'entry.trialExpires', 'form.copyLabel', 'error.generic', 'nature.raises'];
    for (const locale of NAME_LOCALES) {
      for (const key of sample) {
        const en = english(key);
        setUiLocale(locale);
        expect(placeholders(t(key)), `${locale} ${key}`).toBe(placeholders(en));
      }
    }
  });

  it('formats ownership in the chosen language', () => {
    setUiLocale('ja');
    expect(ownershipText({ total: 2, permanent: 1, trial: 1, expiredTrials: 0 })).toBe('2匹（正式1、お試し1）');
    setUiLocale('en');
    expect(ownershipText({ total: 2, permanent: 1, trial: 1, expiredTrials: 0 })).toBe('2 owned (1 perm, 1 trial)');
  });
});
