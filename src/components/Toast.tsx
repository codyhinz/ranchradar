import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n';
import { Mascot, type Mood } from './Mascot';

export interface ToastMessage {
  id: number;
  text: string;
  onUndo?: () => void;
  /** Any other single action, e.g. opening Settings. */
  action?: { label: string; run: () => void };
  /** The mascot cheers a new addition and looks puzzled when something fails. */
  mood?: Mood;
}

/**
 * Where the toast lives. A modal <dialog> sits in the browser's top layer and makes
 * everything outside it inert, so no z-index can lift a toast over it. Instead the toast
 * moves inside the topmost open sheet while one is up, and back to the page when it closes.
 */
function useToastHost(): HTMLElement {
  const [host, setHost] = useState<HTMLElement>(() => document.body);
  useEffect(() => {
    const pick = () => {
      const open = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]'))
        .filter((dialog) => !dialog.classList.contains('is-closing'));
      setHost(open[open.length - 1] ?? document.body);
    };
    pick();
    const observer = new MutationObserver(pick);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'class'] });
    return () => observer.disconnect();
  }, []);
  return host;
}

/** How long a toast stays up. Swipe it or press × to clear it sooner. */
export const TOAST_MS = 4000;
/** A sideways swipe further than this (or a quick flick) dismisses the toast. */
const SWIPE_DISMISS_PX = 72;
const FLICK_PX_PER_MS = 0.5;
/** Movement before a press turns into a swipe, so taps on Undo still land. */
const DRAG_START_PX = 8;

/** One message at a time, announced to screen readers, gone after a few seconds. */
export function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  const host = useToastHost();
  return createPortal(
    <div className="toast-region" role="status" aria-live="polite">
      {toast && <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />}
    </div>,
    host,
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<-1 | 1 | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; t: number; active: boolean } | null>(null);

  // The countdown pauses while a finger or pointer is on the toast.
  useEffect(() => {
    if (dragging || leaving) return;
    const timer = setTimeout(onDismiss, TOAST_MS);
    return () => clearTimeout(timer);
  }, [dragging, leaving, onDismiss]);

  const leave = (direction: -1 | 1) => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { onDismiss(); return; }
    setLeaving(direction);
    window.setTimeout(onDismiss, 180); // matches the toast-out transition
  };

  const end = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    drag.current = null;
    setDragging(false);
    if (!start?.active) return;
    const moved = event.clientX - start.x;
    const speed = Math.abs(moved) / Math.max(1, event.timeStamp - start.t);
    if (Math.abs(moved) > SWIPE_DISMISS_PX || speed > FLICK_PX_PER_MS) leave(moved < 0 ? -1 : 1);
    else setDx(0);
  };

  const offset = leaving ? `${leaving * 120}%` : `${dx}px`;
  return (
    <div
      className={`toast${toast.mood ? ' has-mascot' : ''}`}
      data-dragging={dragging || undefined}
      data-leaving={leaving ? true : undefined}
      style={{ transform: `translateX(${offset})`, opacity: leaving ? 0 : 1 - Math.min(Math.abs(dx) / 240, 0.6) }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp, active: false };
        setDragging(true);
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        const moved = event.clientX - start.x;
        if (!start.active) {
          if (Math.abs(moved) < DRAG_START_PX || Math.abs(moved) < Math.abs(event.clientY - start.y)) return;
          start.active = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        setDx(moved);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={(event) => { if (!drag.current?.active) end(event); }}
      onClickCapture={(event) => { if (dx !== 0) { event.stopPropagation(); event.preventDefault(); } }}
    >
      {toast.mood && <Mascot mood={toast.mood} size={44} className="toast-mascot" />}
      <span className="toast-text">{toast.text}</span>
      {toast.action && (
        <button type="button" className="toast-action" onClick={() => { toast.action!.run(); onDismiss(); }}>
          {toast.action.label}
        </button>
      )}
      {toast.onUndo && (
        <button type="button" className="toast-action" onClick={() => { toast.onUndo!(); onDismiss(); }}>
          {t('undo')}
        </button>
      )}
      <button type="button" className="toast-close" onClick={onDismiss} aria-label={t('close')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" /></svg>
      </button>
    </div>
  );
}
