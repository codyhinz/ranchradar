import { useMemo, useState } from 'react';
import type { NameLocale } from '../catalog';
import { ITEM_CATEGORIES, itemName, itemsToShow, matchesItem, sortItems } from '../itemCatalog';
import { t, type MessageKey } from '../i18n';
import { Dialog } from './Dialog';
import { ItemSprite } from './Sprite';

/** Everything legal this season; bought items stay visible but can't be picked again. */
const seasonItems = itemsToShow(new Set());

/**
 * Catching up after a shopping trip: every item this season in one grid, grouped like the shop.
 * Tap to pick, tap again to unpick. Nothing is saved until Save, which marks them all bought in
 * one go (with one Undo).
 */
export function ItemBulkSheet({ locale, owned, onSave, onClose }: {
  locale: NameLocale;
  owned: ReadonlyMap<string, string>;
  onSave: (itemIds: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [picks, setPicks] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const groups = useMemo(() => ITEM_CATEGORIES.map((category) => ({
    category,
    items: sortItems(seasonItems.filter((item) => item.category === category && matchesItem(item, query, locale)), locale),
  })).filter((group) => group.items.length > 0), [query, locale]);
  const pickable = groups.flatMap((group) => group.items).filter((item) => !owned.has(item.id)).map((item) => item.id);
  const allPicked = pickable.length > 0 && pickable.every((id) => picks.has(id));

  const toggle = (itemId: string) => setPicks((prev) => {
    const next = new Set(prev);
    if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
    return next;
  });
  const pickAllShown = () => setPicks((prev) => {
    const next = new Set(prev);
    pickable.forEach((id) => (allPicked ? next.delete(id) : next.add(id)));
    return next;
  });

  const count = picks.size;
  const submit = async () => {
    setSaving(true);
    try { await onSave([...picks]); }
    finally { setSaving(false); }
  };

  return (
    <Dialog title={t('items.bulk.title')} onClose={onClose}>
      <p className="sheet-sub">{t('items.bulk.hint')}</p>
      <div className="bulk-controls item-bulk-controls">
        <label className="field bulk-filter">
          <span className="visually-hidden">{t('items.search')}</span>
          <input type="search" autoComplete="off" spellCheck={false} placeholder={t('items.search')} value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        {pickable.length > 0 && (
          <button type="button" className="link-button" onClick={pickAllShown}>
            {t(allPicked ? 'items.bulk.clearShown' : 'items.bulk.pickShown')}
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="bulk-none">{t('items.none', { query: query.trim() })}</p>
      ) : groups.map((group) => (
        <section key={group.category} className="item-bulk-group" aria-labelledby={`bulk-${group.category}`}>
          <h3 id={`bulk-${group.category}`}>{t(`items.cat.${group.category}` as MessageKey)}</h3>
          <ul className="bulk-grid item-bulk-grid">
            {group.items.map((item) => {
              const bought = owned.has(item.id);
              const picked = picks.has(item.id);
              return (
                <li key={item.id} className="bulk-tile" data-picked={picked ? 'permanent' : undefined} data-bought={bought || undefined}>
                  <button type="button" aria-pressed={bought || picked} disabled={bought} onClick={() => toggle(item.id)}>
                    {picked && (
                      <span className="bulk-mark" aria-hidden="true">
                        <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                      </span>
                    )}
                    {bought && <span className="bulk-owned" aria-hidden="true">{t('items.filter.owned')}</span>}
                    <ItemSprite id={item.id} size={48} />
                    <span className="bulk-name">{itemName(item.id, locale)}</span>
                    {bought && <span className="visually-hidden">, {t('items.filter.owned')}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="bulk-foot">
        <span className="bulk-tally" aria-live="polite">
          {count === 0 ? t('items.bulk.none') : t('items.bulk.tally', { count })}
        </span>
        <button type="button" className="button button-primary" disabled={count === 0 || saving} onClick={() => void submit()}>
          {t('items.bulk.submit', { count })}
        </button>
      </div>
    </Dialog>
  );
}
