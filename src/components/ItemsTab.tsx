import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ITEM_SORTS, useItemSort, useItemView } from '../app/preferences';
import { currentRegulation, displayName, type NameLocale } from '../catalog';
import {
  ITEM_CATEGORIES, isItemInSeason, itemName, itemsToShow, matchesItem, sortItems, sortItemsByRecent,
  type CatalogItem, type ItemCategory,
} from '../itemCatalog';
import { t, type MessageKey } from '../i18n';
import { ItemBulkSheet } from './ItemBulkSheet';
import { Mascot } from './Mascot';
import { ItemSprite, Sprite } from './Sprite';
import { StopSign } from './StopSign';

export const ITEM_FILTERS = ['all', 'missing', 'owned'] as const;
export type ItemFilter = (typeof ITEM_FILTERS)[number];

interface ItemsTabProps {
  locale: NameLocale;
  /** Item ids bought, each with when it was marked bought; null while loading. */
  owned: ReadonlyMap<string, string> | null;
  /** Forms with at least one copy in the roster, so a Mega Stone can say whether its Pokémon is there. */
  rosterForms: ReadonlySet<string>;
  onToggle: (itemId: string, owned: boolean) => void;
  /** Marks several items bought at once (with Undo). Resolves once saved. */
  onMarkMany: (itemIds: string[]) => Promise<void>;
}

const NONE: ReadonlyMap<string, string> = new Map();

/**
 * Every held item, berry and Mega Stone this season. Picture cards by default (or a compact list),
 * grouped like the in-game shop or in one A–Z / recently-bought run. One tap marks an item bought
 * and another unmarks it, so the tab doubles as a shopping checklist.
 */
export default function ItemsTab({ locale, owned, rosterForms, onToggle, onMarkMany }: ItemsTabProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ItemFilter>('all');
  const [view, setView] = useItemView();
  const [sort, setSort] = useItemSort();
  const [bulkOpen, setBulkOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const mine = owned ?? NONE;

  const all = useMemo(() => itemsToShow(new Set(mine.keys())), [mine]);
  const inSeason = all.filter((item) => isItemInSeason(item.id));
  const boughtInSeason = inSeason.filter((item) => mine.has(item.id)).length;
  const shown = all.filter((item) =>
    (filter === 'all' || (filter === 'owned') === mine.has(item.id)) && matchesItem(item, query, locale));
  const ordered = (list: CatalogItem[]) => (sort === 'recent' ? sortItemsByRecent(list, mine, locale) : sortItems(list, locale));
  // Shop order keeps the category headings; the other sorts run as one list.
  const groups: Array<{ category: ItemCategory | null; items: CatalogItem[]; total: number; bought: number }> = sort === 'category'
    ? ITEM_CATEGORIES.map((category) => ({
      category,
      items: ordered(shown.filter((item) => item.category === category)),
      total: inSeason.filter((item) => item.category === category).length,
      bought: inSeason.filter((item) => item.category === category && mine.has(item.id)).length,
    })).filter((group) => group.items.length > 0)
    : shown.length > 0 ? [{ category: null, items: ordered(shown), total: inSeason.length, bought: boughtInSeason }] : [];
  const missingInSeason = inSeason.length - boughtInSeason;

  const empty = query.trim()
    ? t('items.none', { query: query.trim() })
    : filter === 'missing' ? t('items.allBought') : t('items.noneBought');

  const renderItem = (item: CatalogItem, index: number) => {
    const props = {
      item,
      locale,
      owned: mine.has(item.id),
      inBox: item.megaBaseForm ? rosterForms.has(item.megaBaseForm) : null,
      onToggle,
      index,
    };
    return view === 'grid' ? <ItemCard key={item.id} {...props} /> : <ItemRow key={item.id} {...props} />;
  };

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
              <div className="roster-tools">
                <SortMenu sort={sort} onChange={setSort} />
                <div className="view-toggle" role="group" aria-label={t('items.view')}>
                  {(['grid', 'list'] as const).map((option) => (
                    <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)} aria-label={t(option === 'grid' ? 'items.view.grid' : 'items.view.list')}>
                      {option === 'grid' ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
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
              <section key={group.category ?? 'all'} className="item-group" aria-labelledby={group.category ? `items-${group.category}` : undefined}>
                {group.category && (
                  <h3 id={`items-${group.category}`}>
                    {t(`items.cat.${group.category}` as MessageKey)}
                    <span className="count">{t('items.catCount', { owned: group.bought, total: group.total })}</span>
                  </h3>
                )}
                {view === 'grid'
                  ? <ul className="tiles item-tiles" key={`grid-${sort}`}>{group.items.map(renderItem)}</ul>
                  : <ul className="rows fence item-rows" key={`list-${sort}`}>{group.items.map(renderItem)}</ul>}
              </section>
            ))}

            {missingInSeason > 0 && (
              view === 'grid' ? (
                <ul className="tiles item-tiles item-bulk-wrap">
                  <li className="tile tile-bulk">
                    <button type="button" onClick={() => setBulkOpen(true)}>
                      <BulkIcon />
                      <span className="tile-name">{t('items.bulk.title')}</span>
                    </button>
                  </li>
                </ul>
              ) : (
                <ul className="rows item-rows item-bulk-wrap">
                  <li className="row row-bulk">
                    <button type="button" className="row-main" onClick={() => setBulkOpen(true)}>
                      <BulkIcon />
                      <span className="row-name">{t('items.bulk.title')}</span>
                    </button>
                  </li>
                </ul>
              )
            )}
          </section>
        )}
      </main>

      {bulkOpen && (
        <ItemBulkSheet
          locale={locale}
          owned={mine}
          onSave={async (ids) => { await onMarkMany(ids); setBulkOpen(false); }}
          onClose={() => setBulkOpen(false)}
        />
      )}
    </>
  );
}

interface ItemViewProps {
  item: CatalogItem;
  locale: NameLocale;
  owned: boolean;
  /** For a Mega Stone: whether its Pokémon is in the roster (only a yes is shown). null for other items. */
  inBox: boolean | null;
  onToggle: (itemId: string, owned: boolean) => void;
  index: number;
}

/** Picture card: the item large, its name under it, a stamp in the corner once bought. */
function ItemCard({ item, locale, owned, inBox, onToggle, index }: ItemViewProps) {
  const inSeason = isItemInSeason(item.id);
  const base = item.megaBaseForm;
  const name = itemName(item.id, locale);
  return (
    <li className="tile item-tile enter" data-own={owned ? 'permanent' : 'none'} data-season={inSeason ? undefined : 'out'} data-category={item.category} style={{ '--i': Math.min(index, 18) } as React.CSSProperties}>
      <button type="button" aria-pressed={owned} onClick={() => onToggle(item.id, !owned)} title={base ? `${name}: ${displayName(base, locale)}` : name}>
        {!inSeason && <StopSign className="tile-stop" />}
        <span className="item-art">
          <ItemSprite id={item.id} size={64} />
          {base && (
            <span className="item-holder" data-in-box={inBox || undefined}>
              <Sprite id={base} size={30} />
            </span>
          )}
        </span>
        <span className="tile-name">{name}</span>
        {!inSeason && <span className="season-tag">{t('season.out', { id: currentRegulation.id })}</span>}
        <CheckMark />
        {base && <span className="visually-hidden">, {displayName(base, locale)}{inBox ? `, ${t('items.inBox')}` : ''}</span>}
      </button>
    </li>
  );
}

function ItemRow({ item, locale, owned, inBox, onToggle, index }: ItemViewProps) {
  const inSeason = isItemInSeason(item.id);
  const base = item.megaBaseForm;
  return (
    <li className="row item-row enter" data-own={owned ? 'permanent' : 'none'} data-season={inSeason ? undefined : 'out'} data-category={item.category} style={{ '--i': Math.min(index, 12) } as React.CSSProperties}>
      <button type="button" className="row-main" aria-pressed={owned} onClick={() => onToggle(item.id, !owned)}>
        <ItemSprite id={item.id} size={40} />
        <span className="row-text">
          <span className="row-name">{itemName(item.id, locale)}</span>
          {(base || !inSeason) && (
            <span className="row-meta">
              {base && <span className="item-for"><Sprite id={base} size={24} />{displayName(base, locale)}</span>}
              {inBox && <span className="item-box">{t('items.inBox')}</span>}
              {!inSeason && <span className="season-tag"><StopSign />{t('season.out', { id: currentRegulation.id })}</span>}
            </span>
          )}
        </span>
        <CheckMark />
      </button>
    </li>
  );
}

/** Sort options in a small dropdown, like the roster's filter button. */
function SortMenu({ sort, onChange }: { sort: (typeof ITEM_SORTS)[number]; onChange: (sort: (typeof ITEM_SORTS)[number]) => void }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback((refocus = false) => {
    if (refocus) buttonRef.current?.focus();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setOpen(false); return; }
    setClosing(true);
    window.setTimeout(() => { setOpen(false); setClosing(false); }, 140); // matches dropdown-out
  }, []);
  useEffect(() => {
    if (!open || closing) return;
    const onPointer = (event: PointerEvent) => { if (!wrapRef.current?.contains(event.target as Node)) close(); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(true); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open, closing, close]);
  return (
    <div className="filter-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="tool-button filter-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="item-sort"
        title={t('items.sortButton')}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16M3.5 16.5L7 20l3.5-3.5M17 20V4M13.5 7.5L17 4l3.5 3.5" /></svg>
        <span className="visually-hidden">{t('items.sortButton')}</span>
      </button>
      {open && (
        <div className="filter-panel" id="item-sort" role="dialog" aria-label={t('items.sortButton')} data-closing={closing}>
          <fieldset className="chips">
            <legend>{t('filter.sort')}</legend>
            {ITEM_SORTS.map((option) => (
              <label key={option} className="chip">
                <input type="radio" name="item-sort" checked={sort === option} onChange={() => { onChange(option); close(true); }} />
                <span>{t(`items.sort.${option}` as MessageKey)}</span>
              </label>
            ))}
          </fieldset>
        </div>
      )}
    </div>
  );
}

function CheckMark() {
  return (
    <span className="item-check" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    </span>
  );
}

function BulkIcon() {
  return <svg className="bulk-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><path d="M17 13.5v7M13.5 17h7" /></svg>;
}
