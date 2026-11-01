import type { SupabaseClient, User } from '@supabase/supabase-js';
import { toBackup, type RosterBackup } from '../data/backup';
import type { RosterEntry } from '../data/types';

/**
 * "Download my data": one JSON file that is both a copy of everything the account holds and
 * a working roster backup. The top-level `entries` are this device's view of the roster (the
 * same shape as a Settings backup, so Import reads the file directly). `account` adds what
 * the server stores: the profile, every roster row it keeps (including ones removed in the
 * last 30 days), and the sign-in details.
 */
export interface AccountExport extends RosterBackup {
  account: {
    email: string | null;
    created_at: string;
    sign_in_methods: string[];
    server: unknown;
  };
}

export function buildAccountExport(entries: RosterEntry[], user: Pick<User, 'email' | 'created_at' | 'identities'>, server: unknown, now: Date = new Date()): AccountExport {
  const methods = [...new Set((user.identities ?? []).map((i) => i.provider))].sort();
  return {
    ...toBackup(entries, now),
    account: { email: user.email ?? null, created_at: user.created_at, sign_in_methods: methods, server },
  };
}

export function exportFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `ranchradar-my-data-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/** Fetches the server's copy and the signed-in user, then builds the file's contents. */
export async function fetchAccountExport(client: SupabaseClient, entries: RosterEntry[]): Promise<AccountExport> {
  const [{ data: server, error }, { data: who, error: userError }] = await Promise.all([
    client.rpc('export_my_data'),
    client.auth.getUser(),
  ]);
  if (error) throw error;
  if (userError || !who.user) throw userError ?? new Error('Not signed in');
  return buildAccountExport(entries, who.user, server);
}

/** Deletes the signed-in account and everything stored with it, on the server. */
export async function deleteMyAccount(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('delete_my_account');
  if (error) throw error;
}

/** Hands a JSON value to the browser as a downloaded file. */
export function downloadJson(value: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
