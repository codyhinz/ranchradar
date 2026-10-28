import type { ReactNode } from 'react';
import { TABS, type Tab } from '../app/tabs';
import { t, type MessageKey } from '../i18n';

const LABEL: Record<Tab, MessageKey> = { roster: 'tab.roster' };

const ICON: Record<Tab, ReactNode> = {
  // A ranch fence: the roster is everything in your pen.
  roster: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v16M12 4v16M19 4v16M3 9h18M3 15h18" /></svg>,
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
