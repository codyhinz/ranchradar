import { useEffect, useRef } from 'react';
import { adUnitsEnabled, createAdUnit, fillAdUnit } from '../app/ads';
import { t } from '../i18n';

/**
 * One responsive display ad. Renders nothing in builds without an AdSense slot, and collapses
 * (via CSS on AdSense's data-ad-status="unfilled") when Google has nothing to show.
 */
export function AdSlot() {
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = holder.current;
    if (!box || box.firstChild) return;
    // AdSense rewrites the <ins> it fills, so it's created outside React's tree.
    const ins = createAdUnit();
    box.append(ins);
    void fillAdUnit(ins);
  }, []);
  if (!adUnitsEnabled()) return null;
  return (
    <aside className="ad-slot" aria-label={t('ads.label')}>
      <span className="ad-label">{t('ads.label')}</span>
      <div ref={holder} />
    </aside>
  );
}
