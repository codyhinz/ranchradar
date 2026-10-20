import typeNames from '../../data/generated/type-names.json';
import type { NameLocale } from '../catalog';
import { uiLocale } from '../i18n';

const names = typeNames as Record<string, Partial<Record<NameLocale, string>>>;

/** Type names in the current language, with a colored dot, so meaning never depends on color alone. */
export function TypeTags({ types }: { types: string[] }) {
  const locale = uiLocale();
  return (
    <span className="types">
      {types.map((type) => (
        <span key={type} className="type" data-type={type}>{names[type]?.[locale] ?? names[type]?.en ?? type}</span>
      ))}
    </span>
  );
}
