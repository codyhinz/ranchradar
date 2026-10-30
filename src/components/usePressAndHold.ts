import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';

/** How long a press has to last to count as a hold, on touch and mouse alike. */
export const LONG_PRESS_MS = 450;
/** A finger that drifts further than this is scrolling, not holding. */
const MOVE_TOLERANCE_PX = 10;

/**
 * Press-and-hold for any number of buttons. Spread bind(key) on each one; onHold gets that key.
 * Check wasHeld() first thing in onClick: it's true once after a hold, so the click that ends
 * the hold doesn't also count as a tap.
 */
export function usePressAndHold(onHold: (key: string) => void) {
  const timer = useRef<number | null>(null);
  const held = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const holdRef = useRef(onHold);
  holdRef.current = onHold;

  const cancel = useCallback(() => {
    if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; }
    origin.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);

  const bind = (key: string) => ({
    onPointerDown: (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      held.current = false;
      cancel();
      origin.current = { x: event.clientX, y: event.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        held.current = true;
        navigator.vibrate?.(12);
        holdRef.current(key);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (event: React.PointerEvent) => {
      const start = origin.current;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_TOLERANCE_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  });

  const wasHeld = () => {
    if (!held.current) return false;
    held.current = false;
    return true;
  };

  return { bind, wasHeld };
}
