import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The one Supabase client. It exists only when the build has VITE_SUPABASE_URL and
 * VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example); without them the app runs guest-only,
 * which keeps tests, CI and forks working with no backend.
 *
 * The publishable key is public by design: row-level security in supabase/migrations is what
 * protects each person's rows, not the key.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Confirmation and reset links land back here with tokens in the URL; the client reads
        // and clears them. Implicit flow, so a link opened in a different browser still works.
        detectSessionInUrl: true,
        flowType: 'implicit',
      },
    })
  : null;
