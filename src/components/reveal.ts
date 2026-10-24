/**
 * Scrolls `element` into view inside its own scroll container only. The browser's
 * scrollIntoView also scrolls every ancestor, including the page behind an open sheet,
 * which nudged the whole layout sideways when a picker opened over search results.
 */
export function revealWithin(container: HTMLElement | null, element: HTMLElement | null, smooth = false): void {
  if (!container || !element) return;
  const box = container.getBoundingClientRect();
  const target = element.getBoundingClientRect();
  let delta = 0;
  if (target.bottom > box.bottom) delta = target.bottom - box.bottom + 8;
  if (target.top - delta < box.top) delta = target.top - box.top - 8;
  if (delta !== 0) container.scrollBy({ top: delta, behavior: smooth ? 'smooth' : 'auto' });
}
