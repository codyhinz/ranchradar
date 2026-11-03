import { useMemo, useRef, useState } from 'react';
import { currentRegulation, displayName, type NameLocale } from '../catalog';
import { ITEM_CATEGORIES, isItemInSeason, itemName, itemsToShow, matchesItem, sortItems, type CatalogItem, type ItemCategory } from '../itemCatalog';
import { t, type MessageKey } from '../i18n';
import { Mascot } from './Mascot';
import { Sprite } from './Sprite';
import { StopSign } from './StopSign';

export const ITEM_FILTERS = ['all', 'missing', 'owned'] as const;
export type ItemFilter = (typeof ITEM_FILTERS)[number];

interface ItemsTabProps {
  locale: NameLocale;
  /** Item ids bought; null while loading. */
  owned: ReadonlySet<string> | null;
  /** Forms with at least one copy in the roster, so a Mega Stone can say whether its Pokémon is there. */
  rosterForms: ReadonlySet<string>;
  onToggle: (itemId: string, owned: boolean) => void;
}

/**
 * Every held item, berry and Mega Stone this season, grouped like the in-game shop. One tap marks
 * an item bought (and another unmarks it), so the list doubles as a shopping checklist.
 */
export default function ItemsTab({ locale, owned, rosterForms, onToggle }: ItemsTabProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ItemFilter>('all');
  const searchRef = useRef<HTMLInputElement>(null);
  const mine = owned ?? new Set<string>();

  const all = useMemo(() => itemsToShow(mine), [mine]);
  const inSeason = all.filter((item) => isItemInSeason(item.id));
  const boughtInSeason = inSeason.filter((item) => mine.has(item.id)).length;
  const shown = all.filter((item) =>
    (filter === 'all' || (filter === 'owned') === mine.has(item.id)) && matchesItem(item, query, locale));
  const groups = ITEM_CATEGORIES.map((category) => ({
    category,
    items: sortItems(shown.filter((item) => item.category === category), locale),
    total: inSeason.filter((item) => item.category === category).length,
    bought: inSeason.filter((item) => item.category === category && mine.has(item.id)).length,
  })).filter((group) => group.items.length > 0);

  const empty = query.trim()
    ? t('items.none', { query: query.trim() })
    : filter === 'missing' ? t('items.allBought') : t('items.noneBought');

  return (
    <>
      <div className="search-bar">
        <label htmlFor="item-search" className="visually-hidden">{t('items.search')}</label>
        <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
        <input
          id="item-search"
          ref={searchRef}
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder={t('items.search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Escape') setQuery(''); }}
        />
        {query && (
          <button type="button" className="icon-button clear" onClick={() => { setQuery(''); searchRef.current?.focus(); }} aria-label={t('search.clear')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
      </div>

      <main>
        {owned === null ? (
          <p className="loading">{t('items.loading')}</p>
        ) : (
          <section aria-labelledby="items-heading">
            <div className="section-head">
              <h2 id="items-heading">{t('items.heading')}</h2>
              <span className="count">{t('items.count', { owned: boughtInSeason, total: inSeason.length })}</span>
            </div>
            <fieldset className="chips item-filters">
              <legend className="visually-hidden">{t('items.filter')}</legend>
              {ITEM_FILTERS.map((id) => (
                <label key={id} className="chip">
                  <input type="radio" name="item-filter" checked={filter === id} onChange={() => setFilter(id)} />
                  <span>{t(`items.filter.${id}` as MessageKey)}</span>
                </label>
              ))}
            </fieldset>
            {boughtInSeason === 0 && filter === 'all' && !query.trim() && <p className="hint item-hint">{t('items.hint')}</p>}

            {groups.length === 0 ? (
              <div className="no-results">
                <Mascot mood={filter === 'missing' && !query.trim() ? 'cheer' : 'sleeping'} size={112} />
                <p>{empty}</p>
              </div>
            ) : groups.map((group) => (
              <section key={group.category} className="item-group" aria-labelledby={`items-${group.category}`}>
                <h3 id={`items-${group.category}`}>
                  {t(`items.cat.${group.category}` as MessageKey)}
                  <span className="count">{t('items.catCount', { owned: group.bought, total: group.total })}</span>
                </h3>
                <ul className="rows fence item-rows">
                  {group.items.map((item) => (
                    <ItemRow key={item.id} item={item} locale={locale} owned={mine.has(item.id)} inBox={item.megaBaseForm ? rosterForms.has(item.megaBaseForm) : null} onToggle={onToggle} />
                  ))}
                </ul>
              </section>
            ))}
          </section>
        )}
      </main>
    </>
  );
}

function ItemRow({ item, locale, owned, inBox, onToggle }: {
  item: CatalogItem;
  locale: NameLocale;
  owned: boolean;
  /** For a Mega Stone: whether its Pokémon is in the roster (only a yes is shown). null for other items. */
  inBox: boolean | null;
  onToggle: (itemId: string, owned: boolean) => void;
}) {
  const inSeason = isItemInSeason(item.id);
  const base = item.megaBaseForm;
  return (
    <li className="row item-row" data-own={owned ? 'permanent' : 'none'} data-season={inSeason ? undefined : 'out'} data-category={item.category satisfies ItemCategory}>
      <button type="button" className="row-main" aria-pressed={owned} onClick={() => onToggle(item.id, !owned)}>
        {base && <Sprite id={base} size={40} />}
        <span className="row-text">
          <span className="row-name">{itemName(item.id, locale)}</span>
          {(base || !inSeason) && (
            <span className="row-meta">
              {base && <span>{displayName(base, locale)}</span>}
              {inBox && <span className="item-box">{t('items.inBox')}</span>}
              {!inSeason && <span className="season-tag"><StopSign />{t('season.out', { id: currentRegulation.id })}</span>}
            </span>
          )}
        </span>
        <span className="item-check" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
      </button>
    </li>
  );
}
