import { useEffect, useState } from 'react';
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

/** One message at a time, announced to screen readers, gone after a few seconds. */
export function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  const host = useToastHost();
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);
  return createPortal(
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div className={`toast${toast.mood ? ' has-mascot' : ''}`} key={toast.id}>
          {toast.mood && <Mascot mood={toast.mood} size={44} className="toast-mascot" />}
          <span>{toast.text}</span>
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
        </div>
      )}
    </div>,
    host,
  );
}
