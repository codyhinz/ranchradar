import type { ReactNode } from 'react';
import { TABS, type Tab } from '../app/tabs';
import { t, type MessageKey } from '../i18n';

const LABEL: Record<Tab, MessageKey> = { roster: 'tab.roster', items: 'tab.items' };

const ICON: Record<Tab, ReactNode> = {
  // A ranch fence: the roster is everything in your pen.
  roster: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v16M12 4v16M19 4v16M3 9h18M3 15h18" /></svg>,
  // A saddlebag: what you carry into battle.
  items: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7V5.5a3 3 0 0 1 6 0V7M4.5 9.5A2.5 2.5 0 0 1 7 7h10a2.5 2.5 0 0 1 2.5 2.5V18a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2zM4.5 12.5h15M12 11v3" /></svg>,
};

/**
 * Bottom tab bar for phones and desktop alike. Stays hidden while Roster is the only screen,
 * so it costs nothing until a second tab ships.
 */
export function TabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  if (TABS.length < 2) return null;
  return (
    <nav className="tab-bar" aria-label={t('tab.nav')}>
      {TABS.map((id) => (
        <button key={id} type="button" className="tab" aria-current={tab === id ? 'page' : undefined} onClick={() => onChange(id)}>
          {ICON[id]}
          <span>{t(LABEL[id])}</span>
        </button>
      ))}
    </nav>
  );
}
