import { catalog, guessLocale, normalize, searchForms } from './catalog';

describe('normalize', () => {
  it('folds accents, width and hiragana', () => {
    expect(normalize('Flabébé')).toBe('flabebe');
    expect(normalize('ＧＡＲＣＨＯＭＰ')).toBe('garchomp');
    expect(normalize('がぶりあす')).toBe(normalize('ガブリアス'));
  });
});

describe('searchForms', () => {
  it('finds a Pokémon by its name in any language', () => {
    expect(searchForms('garch')[0]?.id).toBe('garchomp');
    expect(searchForms('Knakrack')[0]?.id).toBe('garchomp');
    expect(searchForms('がぶりあす')[0]?.id).toBe('garchomp');
  });

  it('matches words inside names and puts prefix matches first', () => {
    const ids = searchForms('alola').map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['ninetales-alola', 'raichu-alola']));
  });

  it('only offers forms legal in the current regulation', () => {
    expect(catalog.every((f) => f.id && f.names.en)).toBe(true);
    expect(searchForms('')).toEqual([]);
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
