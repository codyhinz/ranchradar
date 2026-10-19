import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { displayName, searchForms } from './catalog';
import { useNameLocale } from './app/preferences';
import { requestPersistentStorage, useRosterEntries, useRosterStore } from './app/useRoster';
import { AddSheet } from './components/AddSheet';
import { FormSheet } from './components/FormSheet';
import { Header } from './components/Header';
import { ResultRow } from './components/ResultRow';
import { RosterList } from './components/RosterList';
import { SettingsDialog } from './components/SettingsDialog';
import { Toast, type ToastMessage } from './components/Toast';
import { UpdatePrompt } from './components/UpdatePrompt';
import { summarizeByForm } from './data/ownership';
import type { RosterStatus } from './data/types';
import { t } from './i18n';

export function App() {
  const store = useRosterStore();
  const entries = useRosterEntries(store);
  const [locale, setLocale] = useNameLocale();
  const [query, setQuery] = useState('');
  const [addingFormId, setAddingFormId] = useState<string | null>(null);
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const summaries = useMemo(() => summarizeByForm(entries ?? []), [entries]);
  const results = useMemo(() => searchForms(query).slice(0, 60), [query]);
  const name = (formId: string) => displayName(formId, locale);
  const dismissToast = useCallback(() => setToast(null), []);
  const say = (text: string, onUndo?: () => void) => setToast({ id: Date.now(), text, onUndo });

  // "/" jumps to search from anywhere, the way it does on most search-first sites.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
      if (event.key === '/' && !typing && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const guard = async (action: () => Promise<void>) => {
    try { await action(); }
    catch (error) { say(t('error.generic', { message: error instanceof Error ? error.message : String(error) })); }
  };

  const add = (formId: string, status: RosterStatus, extra: { nature?: string | null; notes?: string | null } = {}) =>
    guard(async () => {
      if (!store) return;
      const entry = await store.add({ form_id: formId, status, nature: extra.nature as never, notes: extra.notes ?? null });
      requestPersistentStorage();
      say(t(status === 'permanent' ? 'added.permanent' : 'added.trial', { name: name(formId) }), () => {
        void store.remove(entry.id);
      });
    });

  const openEntries = openFormId ? (entries ?? []).filter((e) => e.form_id === openFormId && !e.deleted_at) : [];

  return (
    <div className="app">
      <Header onOpenSettings={() => setSettingsOpen(true)} />

      <div className="search-bar">
        <label htmlFor="search" className="visually-hidden">{t('search.label')}</label>
        <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
        <input
          id="search"
          ref={searchRef}
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Escape') setQuery(''); }}
        />
        {query && (
          <button type="button" className="icon-button clear" onClick={() => { setQuery(''); searchRef.current?.focus(); }} aria-label={t('search.clear')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
      </div>

      <main>
        {entries === null ? (
          <p className="loading">{t('loading')}</p>
        ) : query.trim() ? (
          results.length ? (
            <ul className="rows results">
              {results.map((form) => (
                <ResultRow
                  key={form.id}
                  form={form}
                  locale={locale}
                  ownership={summaries.get(form.id)}
                  onQuickAdd={(status) => void add(form.id, status)}
                  onAddWithDetails={() => setAddingFormId(form.id)}
                  onOpen={() => setOpenFormId(form.id)}
                />
              ))}
            </ul>
          ) : (
            <p className="no-results">{t('search.none', { query: query.trim() })}</p>
          )
        ) : (
          <RosterList summaries={[...summaries.values()]} locale={locale} onOpen={setOpenFormId} />
        )}
      </main>

      {addingFormId && (
        <AddSheet
          formId={addingFormId}
          name={name(addingFormId)}
          onClose={() => setAddingFormId(null)}
          onAdd={async (draft) => {
            await add(addingFormId, draft.status, { nature: draft.nature, notes: draft.notes.trim() || null });
            setAddingFormId(null);
          }}
        />
      )}

      {openFormId && openEntries.length > 0 && (
        <FormSheet
          name={name(openFormId)}
          entries={openEntries}
          onClose={() => setOpenFormId(null)}
          onAddAnother={() => { setAddingFormId(openFormId); setOpenFormId(null); }}
          onSave={(id, patch) => guard(async () => { await store?.update(id, patch); say(t('entry.saved')); })}
          onRemove={(entry) => guard(async () => {
            await store?.remove(entry.id);
            say(t('entry.deleted', { name: name(entry.form_id) }));
          })}
        />
      )}

      {settingsOpen && (
        <SettingsDialog locale={locale} onLocaleChange={setLocale} onClose={() => setSettingsOpen(false)} />
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
      <UpdatePrompt />
    </div>
  );
}
