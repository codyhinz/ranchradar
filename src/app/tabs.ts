import { useCallback, useEffect, useState } from 'react';

/**
 * The app's top-level screens, in tab-bar order. Roster is first and the default. Teams, Items
 * and News join this list as they ship; the tab bar appears on its own once there are two.
 */
export const TABS = ['roster'] as const;
export type Tab = (typeof TABS)[number];
export const DEFAULT_TAB: Tab = 'roster';

/** "#teams" → "teams"; anything unknown (or no hash) is the default tab. */
export function tabFromHash(hash: string, tabs: readonly string[] = TABS): Tab {
  const id = hash.replace(/^#/, '');
  return (tabs.includes(id) ? id : DEFAULT_TAB) as Tab;
}

/**
 * The open tab, kept in the URL hash so Back moves between tabs and a link can open one.
 * The default tab keeps a clean URL. Each tab remembers its own scroll position.
 */
export function useTab(): [Tab, (next: Tab) => void] {
  const [tab, setTabState] = useState<Tab>(() => (typeof window === 'undefined' ? DEFAULT_TAB : tabFromHash(window.location.hash)));
  useEffect(() => {
    const onHash = () => setTabState(tabFromHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const setTab = useCallback((next: Tab) => {
    if (next === tabFromHash(window.location.hash)) { window.scrollTo({ top: 0 }); return; }
    scrollByTab.set(tabFromHash(window.location.hash), window.scrollY);
    const url = next === DEFAULT_TAB ? window.location.pathname + window.location.search : `#${next}`;
    window.history.pushState(null, '', url);
    setTabState(next);
    requestAnimationFrame(() => window.scrollTo({ top: scrollByTab.get(next) ?? 0 }));
  }, []);
  return [tab, setTab];
}

const scrollByTab = new Map<Tab, number>();
