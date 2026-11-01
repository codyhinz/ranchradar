-- In-app account deletion and "Download my data".

-- ---------------------------------------------------------------------------
-- delete_my_account(): removes the caller's auth user. Every user table references
-- auth.users with ON DELETE CASCADE, so their roster, profile, teams, items, reminders,
-- push subscriptions and webhooks (with the private URLs) go with it, and Supabase's own
-- identities and sessions cascade inside the auth schema.
--
-- SECURITY DEFINER because only the function's owner can touch auth.users. The only input
-- is auth.uid() from the caller's verified token, so it can't be pointed at anyone else.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  delete from auth.users where id = me;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- export_my_data(): everything the server keeps about the caller, as one JSON object.
-- SECURITY INVOKER, so it reads through the same row-level security as the app: it can
-- only ever see the caller's rows. Soft-deleted rows are included (they're still stored
-- until the 30-day purge). Push keys and Discord webhook URLs are left out: they're
-- credentials, not data about the person, and the URLs aren't readable by clients at all.
-- ---------------------------------------------------------------------------
create or replace function public.export_my_data() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) - 'user_id' from public.profiles p where p.user_id = auth.uid()),
    'roster_entries', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.created_at)
                                from public.roster_entries r where r.user_id = auth.uid()), '[]'::jsonb),
    'home_forms', coalesce((select jsonb_agg(to_jsonb(h) - 'user_id' order by h.form_id)
                            from public.home_forms h where h.user_id = auth.uid()), '[]'::jsonb),
    'owned_items', coalesce((select jsonb_agg(to_jsonb(o) - 'user_id' order by o.created_at)
                             from public.owned_items o where o.user_id = auth.uid()), '[]'::jsonb),
    'teams', coalesce((select jsonb_agg(to_jsonb(tm) - 'user_id' order by tm.created_at)
                       from public.teams tm where tm.user_id = auth.uid()), '[]'::jsonb),
    'team_slots', coalesce((select jsonb_agg(to_jsonb(s) - 'user_id' order by s.team_id, s.position)
                            from public.team_slots s where s.user_id = auth.uid()), '[]'::jsonb),
    'reminders', coalesce((select jsonb_agg(to_jsonb(rm) - 'user_id' order by rm.fire_at)
                           from public.reminders rm where rm.user_id = auth.uid()), '[]'::jsonb),
    'push_subscriptions', coalesce((select jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'created_at', ps.created_at)
                                                     order by ps.created_at)
                                    from public.push_subscriptions ps where ps.user_id = auth.uid()), '[]'::jsonb),
    'discord_webhooks', coalesce((select jsonb_agg(to_jsonb(w) - 'user_id' order by w.created_at)
                                  from public.discord_webhooks w where w.user_id = auth.uid()), '[]'::jsonb)
  )
$$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
