import { guessLocale, normalize, searchForms } from './catalog';

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
