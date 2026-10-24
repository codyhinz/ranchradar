import { useEffect } from 'react';
import { t } from '../i18n';

export interface ToastMessage {
  id: number;
  text: string;
  onUndo?: () => void;
  /** Any other single action, e.g. opening Settings. */
  action?: { label: string; run: () => void };
}

/** One message at a time, announced to screen readers, gone after a few seconds. */
export function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div className="toast" key={toast.id}>
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
    </div>
  );
}
