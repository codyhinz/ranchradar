import { TABS, type Tab } from '../app/tabs';
import { t, type MessageKey } from '../i18n';
import { itemSpriteUrl, spriteUrl } from './Sprite';

const LABEL: Record<Tab, MessageKey> = { roster: 'tab.roster', items: 'tab.items' };

/** Pictures from the game itself, so each tab reads at a glance: the mascot for your ranch, a Focus Sash for items, Miltank for the season rules. */
const ICON: Record<Tab, string> = {
  roster: spriteUrl('torkoal'),
  items: itemSpriteUrl('focus-sash'),
};

/** The regulation pages are static pages outside the app, so they sit at the end of the bar as a plain link. */
const REGULATIONS_ICON = spriteUrl('miltank');

/**
 * Tab bar: a full-width bar along the bottom on phones, a floating dock on wider screens.
 * Stays hidden while Roster is the only screen, so it costs nothing until a second tab ships.
 */
export function TabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  if (TABS.length < 2) return null;
  return (
    <nav className="tab-bar" aria-label={t('tab.nav')}>
      {TABS.map((id) => (
        <button key={id} type="button" className="tab" data-tab={id} aria-current={tab === id ? 'page' : undefined} onClick={() => onChange(id)}>
          <span className="tab-icon" aria-hidden="true"><img src={ICON[id]} width={32} height={32} alt="" decoding="async" /></span>
          <span className="tab-label">{t(LABEL[id])}</span>
        </button>
      ))}
      <a className="tab" href="/regulations/">
        <span className="tab-icon" aria-hidden="true"><img src={REGULATIONS_ICON} width={32} height={32} alt="" decoding="async" /></span>
        <span className="tab-label">{t('legal.regulations')}</span>
      </a>
    </nav>
  );
}
