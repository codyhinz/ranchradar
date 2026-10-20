import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Native modal dialog (focus trapping, Esc and an inert background come built in) that
 * slides up on open and back down on close.
 */
export function Dialog({ title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const requestClose = useCallback(() => {
    if (closing) return;
    if (reducedMotion()) { onClose(); return; }
    setClosing(true);
    window.setTimeout(onClose, 200); // matches the sheet-out animation
  }, [closing, onClose]);

  return (
    <dialog
      ref={ref}
      className={`sheet${closing ? ' is-closing' : ''}`}
      aria-labelledby="sheet-title"
      onCancel={(event) => { event.preventDefault(); requestClose(); }}
      onClick={(event) => { if (event.target === ref.current) requestClose(); }}
    >
      <div className="sheet-body">
        <header className="sheet-header">
          <h2 id="sheet-title">{title}</h2>
          <button type="button" className="icon-button" onClick={requestClose} aria-label={t('close')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
