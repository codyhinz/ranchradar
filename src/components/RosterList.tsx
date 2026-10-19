import { catalogById, displayName, type NameLocale } from '../catalog';
import { describeOwnership, type FormOwnership } from '../data/ownership';
import { t } from '../i18n';
import { ownershipState } from './ResultRow';
import { Sprite } from './Sprite';
import { TypeTags } from './TypeTags';

interface RosterListProps {
  summaries: FormOwnership[];
  locale: NameLocale;
  onOpen: (formId: string) => void;
}

/** Owned Pokémon grouped by form, in dex order, separated by fence rails. */
export function RosterList({ summaries, locale, onOpen }: RosterListProps) {
  if (summaries.length === 0) {
    return (
      <div className="empty">
        <Sprite id="torkoal" size={96} className="empty-sprite" />
        <h2>{t('roster.empty.title')}</h2>
        <p>{t('roster.empty.body')}</p>
      </div>
    );
  }
  const sorted = [...summaries].sort(
    (a, b) => (catalogById.get(a.form_id)?.dexNumber ?? 9999) - (catalogById.get(b.form_id)?.dexNumber ?? 9999),
  );
  const total = summaries.reduce((sum, s) => sum + s.total, 0);
  return (
    <section aria-labelledby="roster-heading">
      <div className="section-head">
        <h2 id="roster-heading">{t('roster.heading')}</h2>
        <span className="count">{t('roster.count', { count: total })}</span>
      </div>
      <ul className="rows fence">
        {sorted.map((summary) => {
          const form = catalogById.get(summary.form_id);
          return (
            <li key={summary.form_id} className="row" data-own={ownershipState(summary)}>
              <button type="button" className="row-main" onClick={() => onOpen(summary.form_id)}>
                <Sprite id={summary.form_id} />
                <span className="row-text">
                  <span className="row-name">{displayName(summary.form_id, locale)}</span>
                  <span className="row-meta">
                    <span className="own-label">{describeOwnership(summary)}</span>
                    {form && <TypeTags types={form.types} />}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
