import { guessLocale, isInSeason, isKnownForm, normalize, regulationAt, regulations, searchForms } from './catalog';

describe('normalize', () => {
  it('folds accents, width and hiragana', () => {
    expect(normalize('Flabébé')).toBe('flabebe');
    expect(normalize('ＧＡＲＣＨＯＭＰ')).toBe('garchomp');
    expect(normalize('がぶりあす')).toBe(normalize('ガブリアス'));
  });
});

describe('searchForms', () => {
  it('matches names that start with the query, like a normal search', () => {
    const ids = searchForms('z', 'en').map((f) => f.id);
    expect(ids).not.toContain('eelektross'); // German name Elezeko must not leak into English search
    expect(searchForms('garch', 'en')[0]?.id).toBe('garchomp');
  });

  it('never matches Latin letters in Japanese mode', () => {
    expect(searchForms('b', 'ja')).toEqual([]);
    expect(searchForms('a', 'ja')).toEqual([]);
    expect(searchForms('けんたろす', 'ja').map((f) => f.id)).toEqual(expect.arrayContaining(['tauros-paldea-aqua']));
  });

  it('searches only the chosen language', () => {
    expect(searchForms('Knakrack', 'en')).toEqual([]);
    expect(searchForms('Knakrack', 'de')[0]?.id).toBe('garchomp');
    expect(searchForms('がぶりあす', 'ja')[0]?.id).toBe('garchomp');
  });

  it('finds words inside names, and mid-word matches only from 3 letters', () => {
    expect(searchForms('nine', 'en').map((f) => f.id)).toEqual(expect.arrayContaining(['ninetales', 'ninetales-alola']));
    expect(searchForms('ne', 'en').map((f) => f.id)).not.toContain('ninetales');
    expect(searchForms('chomp', 'en').map((f) => f.id)).toContain('garchomp');
  });

  it('lists names that start with the query before word matches', () => {
    const ids = searchForms('nine', 'en').map((f) => f.id);
    expect(ids.indexOf('ninetales')).toBeLessThan(ids.indexOf('ninetales-alola'));
  });

  it('returns nothing for an empty query', () => {
    expect(searchForms('  ', 'en')).toEqual([]);
  });
});

describe('guessLocale', () => {
  it('maps browser languages to name locales', () => {
    expect(guessLocale(['ja-JP'])).toBe('ja');
    expect(guessLocale(['zh-TW'])).toBe('zh-Hant');
    expect(guessLocale(['zh-CN'])).toBe('zh-Hans');
    expect(guessLocale(['pt-BR', 'fr'])).toBe('fr');
    expect(guessLocale(['pt-BR'])).toBe('en');
  });
});

describe('regulations', () => {
  const reg = (id: string, starts_at: string) => ({ id, name: id, starts_at, ends_at: '2099-01-01T00:00:00Z', status: 'final' as const, forms: [] });
  const list = [reg('M-C', '2026-09-09T02:00:00Z'), reg('M-D', '2026-12-02T02:00:00Z')];

  it('switches to a file shipped ahead of time on its start date, not before', () => {
    expect(regulationAt(new Date('2026-12-02T01:59:00Z'), list).id).toBe('M-C');
    expect(regulationAt(new Date('2026-12-02T02:00:00Z'), list).id).toBe('M-D');
  });

  it('keeps the last regulation after it ends until a new file arrives', () => {
    expect(regulationAt(new Date('2027-06-01T00:00:00Z'), [list[0]!]).id).toBe('M-C');
  });

  it('finds every regulation file and knows forms that left the season', () => {
    expect(regulations.map((r) => r.id)).toContain('M-C');
    expect(isInSeason('garchomp')).toBe(true);
    expect(isInSeason('bouffalant')).toBe(false); // known from data, not in M-C
    expect(isKnownForm('bouffalant')).toBe(true);
    expect(isKnownForm('missingno')).toBe(false);
  });
});
