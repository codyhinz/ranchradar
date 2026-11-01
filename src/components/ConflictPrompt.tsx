import type { Conflict } from '../data/sync/syncEngine';
import type { RosterEntry } from '../data/types';
import { variantName } from '../catalog';
import { t, uiLocale } from '../i18n';
import { Dialog } from './Dialog';
import { natureLabel, statusLine } from './FormSheet';
import { Sprite } from './Sprite';

/**
 * A Pokémon changed on two sides (another device, or a restored backup the account already has):
 * both versions side by side, one at a time, and the person keeps one. Fields that differ are
 * highlighted. "Decide later" leaves both as they are until they come back to it.
 */
export function ConflictPrompt({ conflicts, name, onKeep, onLater }: {
  conflicts: Conflict[];
  name: (formId: string) => string;
  onKeep: (id: string, keep: 'mine' | 'theirs') => void;
  onLater: () => void;
}) {
  const current = conflicts[0];
  if (!current) return null;
  const { kind, mine, theirs } = current;
  const pokemon = name(mine.form_id);
  const otherSide = t(kind === 'changed' ? 'conflict.theirs' : 'conflict.account');
  const mineFields = fields(mine);
  const theirFields = fields(theirs);
  const differs = (key: keyof Fields) => mineFields[key] !== theirFields[key];

  return (
    <Dialog title={t('conflict.title')} onClose={onLater}>
      <div className="conflict">
        <p>
          {t(kind === 'changed' ? 'conflict.changed' : 'conflict.duplicate', { name: pokemon })}
          {conflicts.length > 1 && <span className="conflict-count"> {t('conflict.remaining', { count: conflicts.length - 1 })}</span>}
        </p>
        <div className="conflict-sides" key={mine.id}>
          <Side label={t('conflict.mine')} entry={mine} shown={mineFields} differs={differs} onKeep={() => onKeep(mine.id, 'mine')} />
          <Side label={otherSide} entry={theirs} shown={theirFields} differs={differs} onKeep={() => onKeep(mine.id, 'theirs')} />
        </div>
        <button type="button" className="button button-quiet" onClick={onLater}>{t('conflict.later')}</button>
      </div>
    </Dialog>
  );
}

interface Fields { status: string; variant: string; nature: string; notes: string }

function fields(entry: RosterEntry): Fields {
  return {
    status: entry.deleted_at ? t('conflict.removed') : statusLine(entry),
    variant: entry.variant ? variantName(entry.variant, uiLocale()) : '',
    nature: natureLabel(entry.nature),
    notes: entry.notes ?? '',
  };
}

function Side({ label, entry, shown, differs, onKeep }: {
  label: string;
  entry: RosterEntry;
  shown: Fields;
  differs: (key: keyof Fields) => boolean;
  onKeep: () => void;
}) {
  const removed = entry.deleted_at !== null;
  const badge = removed ? 'removed' : entry.status === 'permanent' ? 'permanent'
    : entry.trial_expires_at && new Date(entry.trial_expires_at) <= new Date() ? 'expired' : 'trial';
  const row = (key: keyof Fields, text: string) => (
    <span className="conflict-field" data-differs={differs(key)}>{text}</span>
  );
  return (
    <section className="conflict-side copy" data-badge={badge} aria-label={label}>
      <h3 className="conflict-side-label">{label}</h3>
      <span className="conflict-sprite" data-removed={removed}><Sprite id={entry.form_id} variant={entry.variant} size={66} /></span>
      <div className="conflict-fields">
        {row('status', shown.status)}
        {!removed && (
          <>
            {shown.variant && row('variant', shown.variant)}
            {row('nature', `${t('nature.label')}: ${shown.nature}`)}
            {shown.notes ? row('notes', shown.notes) : differs('notes') && row('notes', t('conflict.noNotes'))}
          </>
        )}
      </div>
      <button type="button" className="button button-primary" onClick={onKeep} aria-label={`${t('conflict.keep')}: ${label}`}>
        {t('conflict.keep')}
      </button>
    </section>
  );
}
