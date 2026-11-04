import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { currentRegulation, displayName, regulationAt, searchForms } from './catalog';
import { boxCapacity } from './app/box';
import { useBoxSettings, useNameLocale, useRosterView, useTheme } from './app/preferences';
import { DEFAULT_TAB, useTab } from './app/tabs';
import { useAuth } from './app/useAuth';
import { requestPersistentStorage, useRanchDB, useRosterEntries, useRosterStore } from './app/useRoster';
import { useItemStore, useOwnedItems } from './app/useItems';
import { useAccountSync } from './app/useAccountSync';
import { forgetAgeAnswer, useAgeCheck } from './app/useAgeCheck';
import { deleteMyAccount, downloadJson, exportFileName, fetchAccountExport } from './app/accountData';
import { AgeCheck, AgeRemoved } from './components/AgeCheck';
import { supabase } from './data/cloud/supabase';
import { forgetAccount } from './data/local/forgetAccount';
import { GuestOffer } from './components/GuestOffer';
import { ConflictPrompt } from './components/ConflictPrompt';
import { AccountSheet } from './components/AccountSheet';
import { AddSheet } from './components/AddSheet';
import { AdSlot } from './components/AdSlot';
import { NotificationSettings, formatReminderTime } from './components/NotificationSettings';
import { useNotifications } from './app/useNotifications';
import { disablePush } from './app/push';
import { adsEnabled, openAdChoices } from './app/ads';
import { BulkAddSheet } from './components/BulkAddSheet';
import { expiresAfter } from './components/EntryFields';
import { FormSheet } from './components/FormSheet';
import { Header } from './components/Header';
import { Mascot, type Mood } from './components/Mascot';
import { ResultRow } from './components/ResultRow';
import { RosterList } from './components/RosterList';
import { SettingsDialog } from './components/SettingsDialog';
import { TabBar } from './components/TabBar';
import { Toast, type ToastMessage } from './components/Toast';
import { UpdatePrompt } from './components/UpdatePrompt';
import { BackupError, MAX_BACKUP_BYTES, backupFileName, parseBackup, toBackup } from './data/backup';
import { summarizeByForm } from './data/ownership';
import type { RosterStatus } from './data/types';
import { setUiLocale, t } from './i18n';

// The item list and its names only load once someone opens the Items tab.
const ItemsTab = lazy(() => import('./components/ItemsTab'));

export function App() {
  const { auth, recovering, endRecovery, returnError, clearReturnError } = useAuth();
  const db = useRanchDB();
  // Whose roster to show: the account's when signed in, the guest's otherwise, nothing while unsure.
  const owner = auth.status === 'signedIn' ? auth.userId : auth.status === 'loading' ? undefined : null;
  const store = useRosterStore(db, owner);
  const entries = useRosterEntries(store);
  const itemStore = useItemStore(db, owner);
  const ownedItems = useOwnedItems(itemStore);
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
  // "Decide later" on the conflict prompt holds for this visit; Settings → Account reopens it.
  const [conflictsLater, setConflictsLater] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusReminders, setFocusReminders] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [tab, setTab] = useTab();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  // Back from a password-reset link, or a Google/Discord sign-in that didn't finish: open the
  // account sheet, where the new-password form or the reason is waiting.
  useEffect(() => { if (recovering || returnError) setAccountOpen(true); }, [recovering, returnError]);

  // Ticks every minute so trial countdowns and expiries stay current while the app is open.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  // A regulation shipped ahead of time takes over on its start date; the page offers a reload then.
  const liveRegulation = regulationAt(now);
  const summaries = useMemo(() => summarizeByForm(entries ?? [], now), [entries, now]);
  const results = useMemo(() => searchForms(query, locale).slice(0, 60), [query, locale]);
  const name = (formId: string) => displayName(formId, locale);
  const dismissToast = useCallback(() => setToast(null), []);
  const say = (text: string, onUndo?: () => void, mood?: Mood) => setToast({ id: Date.now(), text, onUndo, mood });
  const account = useAccountSync(db, store, auth, (text) => say(text), itemStore);
  const age = useAgeCheck(auth);
  const notify = useNotifications(auth, locale);

  /** "I just recruited": the ranch reminder in 22 hours, or set up notifications first. */
  const recruited = () => guard(async () => {
    if (notify.loaded && !notify.anyDevice) {
      setFocusReminders(true);
      setSettingsOpen(true);
      say(t('remind.setupFirst'));
      return;
    }
    const previous = notify.ranchAt;
    const at = await notify.setRanch();
    say(t('remind.ranchSet', { time: formatReminderTime(at, locale) }), () => void notify.restoreRanch(previous), 'cheer');
  });
  // Prompts that act on the account wait until it has answered the age question.
  const ageOk = age.status === 'ok';
  const [ageRemoved, setAgeRemoved] = useState(false);

  const downloadMyData = async () => {
    if (!supabase || auth.status !== 'signedIn') return;
    const data = await fetchAccountExport(supabase, entries ?? []);
    downloadJson(data, exportFileName());
    say(t('account.downloaded'));
  };

  /** Deletes the account on the server, then everything this device kept for it. */
  const removeAccount = async () => {
    if (!supabase || auth.status !== 'signedIn') return;
    const userId = auth.userId;
    await deleteMyAccount(supabase);
    // The server's copy went with the account; drop the browser's too.
    await disablePush(null).catch(() => undefined);
    // The user is gone, so the server may refuse the sign-out; the local session is cleared either way.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    forgetAgeAnswer(userId);
    if (db) await forgetAccount(db, userId);
  };

  const deleteAccount = async () => {
    await removeAccount();
    say(t('account.deleted'));
  };

  const underThirteen = async () => {
    await removeAccount();
    setAgeRemoved(true);
  };

  const leaveAgeCheck = () => {
    void disablePush(supabase).catch(() => undefined).then(() => supabase?.auth.signOut({ scope: 'local' })).catch(() => undefined);
    say(t('auth.signedOut'));
  };

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
    setAccountOpen(false);
    setBulkOpen(false);
    if (tab !== DEFAULT_TAB) setTab(DEFAULT_TAB);
    window.scrollTo({ top: 0 });
  };

  const guard = async (action: () => Promise<void>) => {
    try { await action(); }
    catch (error) { say(t('error.generic', { message: error instanceof Error ? error.message : String(error) }), undefined, 'confused'); }
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
      }, 'cheer');
    });

  const addMany = (picks: Array<{ formId: string; status: RosterStatus }>) => guard(async () => {
    if (!store || picks.length === 0) return;
    const added = await store.addMany(picks.map(({ formId, status }) => ({ form_id: formId, status })));
    requestPersistentStorage();
    setBulkOpen(false);
    say(t('bulk.added', { count: added.length }), () => { void store.removeMany(added.map((e) => e.id)); }, 'cheer');
  });

  const exportRoster = () => {
    const live = (entries ?? []).filter((e) => !e.deleted_at);
    if (live.length === 0) { say(t('backup.empty')); return; }
    const blob = new Blob([JSON.stringify(toBackup(live), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = backupFileName();
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    say(t('backup.exported', { count: live.length }));
  };

  const importRoster = (file: File) => guard(async () => {
    if (!store) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new BackupError('too_large', 'Backup file is too large');
      const { rows, skipped } = parseBackup(await file.text());
      const result = await store.importEntries(rows);
      requestPersistentStorage();
      const done = t('backup.imported', { added: result.added, updated: result.updated, unchanged: result.unchanged });
      say(skipped ? `${done} · ${t('backup.skipped', { count: skipped })}` : done);
    } catch (error) {
      if (!(error instanceof BackupError)) throw error; // storage errors go through guard()
      say(t(error.code === 'newer_format' ? 'backup.newer' : error.code === 'too_large' ? 'backup.tooLarge' : 'backup.invalid'), undefined, 'confused');
    }
  });

  const openEntries = openFormId ? (entries ?? []).filter((e) => e.form_id === openFormId && !e.deleted_at) : [];

  return (
    <div className="app">
      <Header auth={auth} onOpenAccount={() => setAccountOpen(true)} onOpenSettings={() => setSettingsOpen(true)} onHome={goHome} onRecruited={notify.available && ageOk ? () => void recruited() : undefined} />

      {tab === 'roster' && (<>
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
              <Mascot mood="sleeping" size={112} />
              <p>{t('search.none', { query: query.trim() })}</p>
              <button type="button" className="link-button" onClick={goHome}>{t('results.back')}</button>
            </div>
          )
        ) : (
          <RosterList now={now} summaries={[...summaries.values()]} locale={locale} view={rosterView} onViewChange={setRosterView} onOpen={setOpenFormId} onRemoveForms={(formIds) => guard(async () => {
            if (!store) return;
            const ids = (entries ?? []).filter((e) => !e.deleted_at && formIds.includes(e.form_id)).map((e) => e.id);
            if (ids.length === 0) return;
            await store.removeMany(ids);
            say(t('roster.removedMany', { count: ids.length }), () => { void store.restore(ids); });
          })} onClearExpired={() => guard(async () => {
            if (!store) return;
            const ids = (entries ?? []).filter((e) => !e.deleted_at && e.status === 'trial' && e.trial_expires_at && new Date(e.trial_expires_at) <= now).map((e) => e.id);
            if (ids.length === 0) return;
            await store.removeMany(ids);
            say(t('expired.cleared', { count: ids.length }), () => { void store.restore(ids); });
          })} onBulkAdd={() => setBulkOpen(true)} boxUsed={boxUsed} boxCapacity={capacity} />
        )}
        {/* Below the roster only: never in search results, sheets, or an empty ranch with nothing else on screen. */}
        {entries !== null && !query.trim() && summaries.size > 0 && <AdSlot />}
      </main>
      </>)}

      {tab === 'items' && (
        <Suspense fallback={<main><p className="loading">{t('items.loading')}</p></main>}>
          <ItemsTab
            locale={locale}
            owned={ownedItems}
            rosterForms={new Set(summaries.keys())}
            onToggle={(itemId, owned) => void guard(async () => {
              await itemStore?.setOwned(itemId, owned);
              if (owned) requestPersistentStorage();
            })}
            onMarkMany={(itemIds) => guard(async () => {
              if (!itemStore) return;
              const marked = await itemStore.setOwnedMany(itemIds, true);
              requestPersistentStorage();
              say(t('items.bulk.done', { count: marked }), () => { void itemStore.setOwnedMany(itemIds, false); }, 'cheer');
            })}
          />
        </Suspense>
      )}

      <footer className="app-footer">
        <nav aria-label={t('legal.nav')}>
          <a href="/about">{t('legal.about')}</a>
          <a href="/regulations/">{t('legal.regulations')}</a>
          <a href="/privacy">{t('legal.privacy')}</a>
          <a href="/terms">{t('legal.terms')}</a>
          <a href="https://github.com/codyhinz/ranchradar" target="_blank" rel="noopener noreferrer">{t('legal.source')}</a>
          {adsEnabled() && <button type="button" className="link-button" onClick={openAdChoices}>{t('ads.choices')}</button>}
        </nav>
        <p>{t('legal.fan')}</p>
      </footer>

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
          onMakePermanent={(entry) => guard(async () => {
            if (!store) return;
            const expiredAt = entry.trial_expires_at;
            await store.update(entry.id, { status: 'permanent' });
            say(t('expired.madePermanent', { name: name(entry.form_id) }), () => {
              void store.update(entry.id, { status: 'trial', trial_expires_at: expiredAt });
            });
          })}
          onReturn={(entry) => guard(async () => {
            if (!store) return;
            await store.remove(entry.id);
            say(t('expired.returned', { name: name(entry.form_id) }), () => { void store.restore([entry.id]); });
          })}
          onRemove={(entry) => guard(async () => {
            if (!store) return;
            await store.remove(entry.id);
            say(t('entry.deleted', { name: name(entry.form_id) }), () => { void store.restore([entry.id]); });
          })}
          onRemoveMany={(removed) => guard(async () => {
            if (!store || removed.length === 0) return;
            const ids = removed.map((e) => e.id);
            await store.removeMany(ids);
            say(t('entry.deletedMany', { count: ids.length, name: name(removed[0]!.form_id) }), () => { void store.restore(ids); });
          })}
        />
      )}

      {bulkOpen && (
        <BulkAddSheet
          locale={locale}
          summaries={summaries}
          slotsFree={Math.max(0, capacity - boxUsed)}
          onAdd={addMany}
          onOpenSettings={() => { setBulkOpen(false); setSettingsOpen(true); }}
          onClose={() => setBulkOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsDialog locale={locale} onLocaleChange={setLocale} theme={theme} onThemeChange={setTheme} box={box} onBoxChange={setBox} boxUsed={boxUsed} onExport={exportRoster} onImport={(file) => void importRoster(file)}
          focusReminders={focusReminders}
          reminders={auth.status !== 'unavailable' && notify.support !== 'off-in-build' ? (
            <NotificationSettings
              notify={notify}
              signedIn={notify.available}
              locale={locale}
              onSignIn={() => { setSettingsOpen(false); setAccountOpen(true); }}
              say={(text, onUndo) => say(text, onUndo)}
            />
          ) : undefined}
          onClose={() => { setSettingsOpen(false); setFocusReminders(false); }} />
      )}

      {accountOpen && (
        <AccountSheet
          auth={auth}
          guestPokemon={account.guestPokemon}
          conflicts={account.conflicts.length}
          onReviewConflicts={() => setConflictsLater(false)}
          onAddGuestPokemon={() => void account.addGuestPokemon()}
          onDownloadData={downloadMyData}
          onDeleteAccount={deleteAccount}
          recovering={recovering}
          onRecovered={endRecovery}
          initialError={returnError}
          say={(text) => say(text)}
          onClose={() => { setAccountOpen(false); clearReturnError(); }}
        />
      )}

      {age.status === 'ask' && auth.status === 'signedIn' && !accountOpen && (
        <AgeCheck onYes={age.confirm} onNo={underThirteen} onClose={leaveAgeCheck} />
      )}

      {ageRemoved && <AgeRemoved onClose={() => setAgeRemoved(false)} />}

      {ageOk && account.conflicts.length > 0 && !conflictsLater && !account.offerOpen && !accountOpen && (
        <ConflictPrompt
          conflicts={account.conflicts}
          name={name}
          onKeep={(id, keep) => void account.resolve(id, keep)}
          onLater={() => setConflictsLater(true)}
        />
      )}

      {ageOk && account.offerOpen && auth.status === 'signedIn' && !accountOpen && (
        <GuestOffer
          count={account.guestPokemon}
          email={auth.email}
          onAdd={() => void account.addGuestPokemon()}
          onKeep={() => void account.keepSeparate()}
          onClose={account.dismissOffer}
        />
      )}

      <TabBar tab={tab} onChange={setTab} />
      <Toast toast={toast} onDismiss={dismissToast} />
      <UpdatePrompt seasonStarted={liveRegulation.id !== currentRegulation.id ? liveRegulation.id : null} />
    </div>
  );
}
