import { t } from '../i18n';
import { Dialog } from './Dialog';
import { Mascot } from './Mascot';

/**
 * Shown once after signing in when the device already has a guest roster. Adding is the main
 * action; keeping them separate leaves that roster here for when nobody is signed in, and
 * Settings → Account can add it later.
 */
export function GuestOffer({ count, email, onAdd, onKeep, onClose }: {
  count: number;
  email: string;
  onAdd: () => void;
  onKeep: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog title={t('guest.title')} onClose={onClose}>
      <div className="guest-offer">
        <Mascot mood="cheer" size={72} className="guest-offer-mascot" />
        <p>{t('guest.body', { count, email })}</p>
        <div className="guest-offer-actions">
          <button type="button" className="button button-primary" onClick={onAdd}>{t('guest.add')}</button>
          <button type="button" className="button button-quiet" onClick={onKeep}>{t('guest.keep')}</button>
        </div>
      </div>
    </Dialog>
  );
}
