// The app's tab bar on the static pages (about, privacy, terms, regulations, 404), so moving
// between the app and these pages always works the same way. Same markup and classes as
// components/TabBar.tsx; here every entry is a link, since each one leaves this page.

export type StaticSection = 'roster' | 'items' | 'regulations';

const ENTRIES: { id: StaticSection; href: string; label: string; icon: string }[] = [
  { id: 'roster', href: '/', label: 'Roster', icon: '/sprites/torkoal.webp' },
  { id: 'items', href: '/#items', label: 'Items', icon: '/sprites/items/focus-sash.webp' },
  { id: 'regulations', href: '/regulations/', label: 'Regulations', icon: '/sprites/miltank.webp' },
];

/** Which entry the page belongs to: the regulation pages light up Regulations; the rest light up nothing. */
export function sectionFor(pathname: string): StaticSection | null {
  return /^\/regulations(\/|$)/.test(pathname) ? 'regulations' : null;
}

export function mountTabBar(doc: Document = document): void {
  if (doc.querySelector('.tab-bar')) return;
  const current = sectionFor(doc.location.pathname);
  const nav = doc.createElement('nav');
  nav.className = 'tab-bar';
  nav.setAttribute('aria-label', 'Sections');
  for (const entry of ENTRIES) {
    const link = doc.createElement('a');
    link.className = 'tab';
    link.href = entry.href;
    link.dataset.tab = entry.id;
    if (entry.id === current) link.setAttribute('aria-current', 'page');
    const icon = doc.createElement('span');
    icon.className = 'tab-icon';
    icon.setAttribute('aria-hidden', 'true');
    const img = doc.createElement('img');
    Object.assign(img, { src: entry.icon, width: 32, height: 32, alt: '', decoding: 'async' });
    icon.append(img);
    const label = doc.createElement('span');
    label.className = 'tab-label';
    label.textContent = entry.label;
    link.append(icon, label);
    nav.append(link);
  }
  doc.body.append(nav);
}
