import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { displayName, searchForms } from './catalog';
import { boxCapacity } from './app/box';
import { useBoxSettings, useNameLocale, useRosterView, useTheme } from './app/preferences';
import { requestPersistentStorage, useRosterEntries, useRosterStore } from './app/useRoster';
import { AddSheet } from './components/AddSheet';
import { expiresAfter } from './components/EntryFields';
import { FormSheet } from './components/FormSheet';
import { Header } from './components/Header';
import { ResultRow } from './components/ResultRow';
import { RosterList } from './components/RosterList';
import { SettingsDialog } from './components/SettingsDialog';
import { Toast, type ToastMessage } from './components/Toast';
import { UpdatePrompt } from './components/UpdatePrompt';
import { summarizeByForm } from './data/ownership';
import type { RosterStatus } from './data/types';
import { setUiLocale, t } from './i18n';

export function App() {
  const store = useRosterStore();
  const entries = useRosterEntries(store);
  const [locale, setLocale] = useNameLocale();
  setUiLocale(locale); // interface text follows the same language setting as Pokémon names
  const [theme, setTheme] = useTheme();
  const [rosterView, setRosterView] = useRosterView();
  const [box, setBox] = useBoxSettings();
  const capacity = boxCapacity(box);
  // Every copy takes a box slot, expired trials included, until it's returned in-game.
  const boxUsed = (entries ?? []).filter((e) => !e.deleted_at).length;
  const [query, setQuery] = useState('');
  const [addingFormId, setAddingFormId] = useState<string | null>(null);
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Ticks every minute so trial countdowns and expiries stay current while the app is open.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const summaries = useMemo(() => summarizeByForm(entries ?? [], now), [entries, now]);
  const results = useMemo(() => searchForms(query, locale).slice(0, 60), [query, locale]);
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

  const goHome = () => {
    setQuery('');
    setAddingFormId(null);
    setOpenFormId(null);
    setSettingsOpen(false);
    window.scrollTo({ top: 0 });
  };

  const guard = async (action: () => Promise<void>) => {
    try { await action(); }
    catch (error) { say(t('error.generic', { message: error instanceof Error ? error.message : String(error) })); }
  };

  const add = (formId: string, status: RosterStatus, extra: { nature?: string | null; variant?: string | null; notes?: string | null; trial_expires_at?: string } = {}) =>
    guard(async () => {
      if (!store) return;
      if (boxUsed >= capacity) {
        setToast({ id: Date.now(), text: t('box.full', { capacity }), action: { label: t('settings.box'), run: () => setSettingsOpen(true) } });
        return;
      }
      const entry = await store.add({ form_id: formId, status, nature: extra.nature as never, variant: extra.variant ?? null, notes: extra.notes ?? null, ...(extra.trial_expires_at ? { trial_expires_at: extra.trial_expires_at } : {}) });
      requestPersistentStorage();
      say(t(status === 'permanent' ? 'added.permanent' : 'added.trial', { name: name(formId) }), () => {
        void store.remove(entry.id);
      });
    });

  const openEntries = openFormId ? (entries ?? []).filter((e) => e.form_id === openFormId && !e.deleted_at) : [];

  return (
    <div className="app">
      <Header onOpenSettings={() => setSettingsOpen(true)} onHome={goHome} />

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
            <>
            <div className="results-head">
              <span>{results.length === 1 ? t('results.one') : t('results.count', { count: results.length })}</span>
              <button type="button" className="link-button" onClick={goHome}>{t('results.back')}</button>
            </div>
            <ul className="rows results">
              {results.map((form, index) => (
                <ResultRow
                  key={form.id}
                  index={index}
                  form={form}
                  locale={locale}
                  ownership={summaries.get(form.id)}
                  onQuickAdd={(status) => void add(form.id, status)}
                  onAddWithDetails={() => setAddingFormId(form.id)}
                  onOpen={() => setOpenFormId(form.id)}
                />
              ))}
            </ul>
            </>
          ) : (
            <div className="no-results">
              <p>{t('search.none', { query: query.trim() })}</p>
              <button type="button" className="link-button" onClick={goHome}>{t('results.back')}</button>
            </div>
          )
        ) : (
          <RosterList now={now} summaries={[...summaries.values()]} locale={locale} view={rosterView} onViewChange={setRosterView} onOpen={setOpenFormId} boxUsed={boxUsed} boxCapacity={capacity} />
        )}
      </main>

      {addingFormId && (
        <AddSheet
          formId={addingFormId}
          name={name(addingFormId)}
          onClose={() => setAddingFormId(null)}
          onAdd={async (draft) => {
            await add(addingFormId, draft.status, {
              nature: draft.nature,
              variant: draft.variant,
              notes: draft.notes.trim() || null,
              ...(draft.status === 'trial' && draft.trialTouched ? { trial_expires_at: expiresAfter(draft.trialDays, draft.trialHours) } : {}),
            });
            setAddingFormId(null);
          }}
        />
      )}

      {openFormId && openEntries.length > 0 && (
        <FormSheet
          formId={openFormId}
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
        <SettingsDialog locale={locale} onLocaleChange={setLocale} theme={theme} onThemeChange={setTheme} box={box} onBoxChange={setBox} boxUsed={boxUsed} onClose={() => setSettingsOpen(false)} />
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
      <UpdatePrompt />
    </div>
  );
}
