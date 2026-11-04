-- RLS + sync behaviour tests. Run after migrations. Fails loudly on any violation.
\set ON_ERROR_STOP on

-- Reference data (forms, names, M-C) comes from the generated reference migration.
do $$ begin
  assert (select count(*) from forms where id in ('garchomp', 'ninetales-alola', 'mewtwo')) = 3, 'reference forms missing';
  assert exists (select 1 from regulation_forms where regulation_id = 'M-C' and form_id = 'garchomp'), 'M-C list missing';
end $$;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'),
                              ('00000000-0000-0000-0000-00000000000b');

-- User A adds a Garchomp
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into roster_entries (id, user_id, form_id, status, trial_expires_at)
  values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a',
          'garchomp','trial', now() + interval '7 days');

do $$ begin
  -- version is server-managed
  assert (select version from roster_entries) = 1, 'insert version should be 1';
  update roster_entries set nature = 'jolly' where version = 1;
  assert (select version from roster_entries) = 2, 'update should bump version';
  -- stale write (base version 1) touches nothing -> conflict
  update roster_entries set nature = 'adamant' where version = 1;
  assert (select nature from roster_entries) = 'jolly', 'stale write must not apply';
end $$;

-- User B: sees nothing, cannot write into A's account, cannot touch A's rows
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select count(*) from roster_entries) = 0, 'B can read A''s roster';
  assert (select count(*) from profiles) = 1, 'B should see only own profile';
  update roster_entries set notes = 'hacked';
  begin
    insert into roster_entries (id, user_id, form_id, status)
      values (gen_random_uuid(),'00000000-0000-0000-0000-00000000000a','garchomp','permanent');
    raise exception 'B inserted into A''s account';
  exception when insufficient_privilege then null;  -- RLS rejected it
  end;
  -- B can't build a team slot pointing at A's Pokémon
  insert into teams (id,user_id,name,format)
    values ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-00000000000b','B team','doubles');
  begin
    insert into team_slots (id,user_id,team_id,position,roster_entry_id)
      values (gen_random_uuid(),'00000000-0000-0000-0000-00000000000b',
              '22222222-2222-2222-2222-222222222222',1,'11111111-1111-1111-1111-111111111111');
    raise exception 'B linked A''s Pokémon';
  exception when foreign_key_violation then null;
  end;
  -- reference data is read-only
  begin
    insert into forms values ('fake','fake',1,'{normal}','x');
    raise exception 'client wrote reference data';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Back as A: B's update had no effect; secrets schema is unreachable
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select notes from roster_entries) is null, 'B modified A''s row';
  begin
    delete from roster_entries;
    raise exception 'client hard-deleted a roster row';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from private.discord_webhook_secrets;
    raise exception 'client read webhook secrets';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Variants: an entry's variant must belong to its form; anyone can read the reference rows
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into roster_entries (id, user_id, form_id, status, variant)
  values ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-00000000000a',
          'alcremie','permanent','alcremie-ruby-cream');
do $$ begin
  assert (select count(*) from form_variants where form_id = 'alcremie') = 9, 'variants should be readable';
  begin
    update roster_entries set variant = 'alcremie-ruby-cream' where form_id = 'garchomp';
    raise exception 'a variant from another form was accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into form_variants values ('alcremie-fake','alcremie',9);
    raise exception 'client wrote reference data';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
-- Hardening: storage limits, caps, column limits and explicit privileges
insert into public.discord_webhooks (id, user_id, label, enabled, disabled_reason)
  values ('33333333-3333-3333-3333-333333333333','00000000-0000-0000-0000-00000000000a','Server',false,'Discord deleted it');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare ok boolean;
begin
  begin
    update roster_entries set spread = jsonb_build_object('x', repeat('A', 5000)) where form_id = 'garchomp';
    raise exception 'an oversized spread was accepted';
  exception when check_violation then null;
  end;
  update roster_entries set spread = '{"hp": 2, "atk": 32, "def": 0, "spa": 0, "spd": 0, "spe": 32}' where form_id = 'garchomp';  -- a real spread fits
  -- Stat points: six stats, whole numbers, 32 per stat, 1–66 in total
  begin
    update roster_entries set spread = '{"hp": 252, "atk": 252}' where form_id = 'garchomp';
    raise exception 'an EV-style spread was accepted';
  exception when check_violation then null;
  end;
  begin
    update roster_entries set spread = '{"hp": 32, "atk": 32, "def": 32, "spa": 0, "spd": 0, "spe": 0}' where form_id = 'garchomp';
    raise exception 'a 96-point spread was accepted';
  exception when check_violation then null;
  end;
  begin
    update roster_entries set spread = '{"hp": 0, "atk": 0, "def": 0, "spa": 0, "spd": 0, "spe": 0}' where form_id = 'garchomp';
    raise exception 'an empty spread was stored instead of null';
  exception when check_violation then null;
  end;
  begin
    update roster_entries set spread = '{"hp": 2.5, "atk": 32, "def": 0, "spa": 0, "spd": 0, "spe": 31}' where form_id = 'garchomp';
    raise exception 'a fractional spread was accepted';
  exception when check_violation then null;
  end;
  begin
    update roster_entries set spread = '{"hp": "2", "atk": 32, "def": 0, "spa": 0, "spd": 0, "spe": 32}' where form_id = 'garchomp';
    raise exception 'a spread with text points was accepted';
  exception when check_violation then null;
  end;
  begin
    update roster_entries set spread = '{"hp": 2, "atk": 32, "def": 0, "spa": 0, "spd": 0, "spe": 32, "x": 1}' where form_id = 'garchomp';
    raise exception 'a spread with an extra key was accepted';
  exception when check_violation then null;
  end;
  begin
    update roster_entries set spread = '[2, 32, 0, 0, 0, 32]' where form_id = 'garchomp';
    raise exception 'an array spread was accepted';
  exception when check_violation then null;
  end;
  begin
    update profiles set locale = repeat('B', 100);
    raise exception 'an oversized locale was accepted';
  exception when check_violation then null;
  end;
  update profiles set locale = 'ja', age_confirmed_at = now();  -- the columns users own still work
  begin
    update profiles set created_at = now() - interval '1 year';
    raise exception 'a client rewrote profiles.created_at';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into reminders (user_id, kind, fire_at)
      select '00000000-0000-0000-0000-00000000000a', 'ranch_refresh', now() + interval '1 hour' from generate_series(1, 501);
    raise exception 'the reminder cap let 501 rows in';
  exception when raise_exception then
    if sqlerrm not like 'row_cap_reached%' then raise; end if;
  end;
  begin
    insert into push_subscriptions (user_id, endpoint, p256dh, auth)
      values ('00000000-0000-0000-0000-00000000000a', 'http://169.254.169.254/latest', 'k', 'a');
    raise exception 'a non-https push endpoint was accepted';
  exception when check_violation then null;
  end;
  begin
    update discord_webhooks set enabled = true;
    raise exception 'a server-disabled webhook was switched back on';
  exception when insufficient_privilege then null;  -- the update policy's check
  end;
  update discord_webhooks set label = 'Renamed';
  begin
    update discord_webhooks set disabled_reason = null;
    raise exception 'a client cleared disabled_reason';
  exception when insufficient_privilege then null;
  end;
  begin
    truncate roster_entries;
    raise exception 'a client truncated a table';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role anon;
do $$ begin
  assert (select count(*) from forms) > 0, 'anon should read reference data';
  begin
    perform * from roster_entries;
    raise exception 'anon read roster_entries';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Account export and deletion: C and D are fresh accounts
insert into auth.users values ('00000000-0000-0000-0000-00000000000c'),
                              ('00000000-0000-0000-0000-00000000000d');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
insert into roster_entries (id, user_id, form_id, status)
  values ('33333333-3333-3333-3333-333333333333','00000000-0000-0000-0000-00000000000c','garchomp','permanent');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
insert into roster_entries (id, user_id, form_id, status)
  values ('44444444-4444-4444-4444-444444444444','00000000-0000-0000-0000-00000000000d','mewtwo','permanent');
do $$
declare data jsonb := export_my_data();
begin
  assert jsonb_array_length(data->'roster_entries') = 1, 'export should hold exactly D''s roster';
  assert data->'roster_entries'->0->>'id' = '44444444-4444-4444-4444-444444444444', 'export returned someone else''s row';
  assert not (data->'roster_entries'->0 ? 'user_id'), 'export should drop user_id';
  assert data->'profile' is not null, 'export should include the profile';
end $$;
-- D deletes their account: only D's rows go
select delete_my_account();
reset role;
do $$ begin
  assert not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000d'), 'D''s auth user survived';
  assert not exists (select 1 from roster_entries where user_id = '00000000-0000-0000-0000-00000000000d'), 'D''s roster survived';
  assert not exists (select 1 from profiles where user_id = '00000000-0000-0000-0000-00000000000d'), 'D''s profile survived';
  assert exists (select 1 from roster_entries where user_id = '00000000-0000-0000-0000-00000000000c'), 'deleting D removed C''s roster';
  assert exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000c'), 'deleting D removed C';
end $$;
-- Signed out, neither function runs
set role anon;
do $$ begin
  begin
    perform delete_my_account();
    raise exception 'anon called delete_my_account';
  exception when insufficient_privilege then null;
  end;
  begin
    perform export_my_data();
    raise exception 'anon called export_my_data';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
-- An authenticated role with no user id can't delete anything
set role authenticated;
reset request.jwt.claim.sub;
do $$ begin
  begin
    perform delete_my_account();
    raise exception 'delete_my_account ran with no user';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- The daily purge runs and leaves anything removed less than 30 days ago alone
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000f1');
insert into public.roster_entries (id, user_id, form_id, status, deleted_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000f1', 'torkoal', 'permanent', now() - interval '31 days'),
         (gen_random_uuid(), '00000000-0000-0000-0000-0000000000f1', 'garchomp', 'permanent', now() - interval '29 days');
select app.purge_soft_deleted();
do $$ begin
  if exists (select 1 from public.roster_entries where user_id = '00000000-0000-0000-0000-0000000000f1' and form_id = 'torkoal') then
    raise exception 'purge_soft_deleted kept a row removed 31 days ago';
  end if;
  if not exists (select 1 from public.roster_entries where user_id = '00000000-0000-0000-0000-0000000000f1' and form_id = 'garchomp') then
    raise exception 'purge_soft_deleted removed a row deleted 29 days ago';
  end if;
end $$;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000f1';

-- Reminders: trial reminders follow the roster, users only set their own ranch refresh
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000c2');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
insert into roster_entries (id, user_id, form_id, status, trial_expires_at)
  values ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-0000000000c1', 'garchomp', 'trial', now() + interval '5 days');
do $$
declare fire timestamptz;
begin
  select fire_at into fire from reminders where kind = 'trial_expiry';
  assert fire = (select trial_expires_at - interval '1 day' from roster_entries where id = '55555555-5555-5555-5555-555555555555'),
    'a new trial should get a reminder 1 day before it ends';
  -- notes don't move it; a new expiry does
  update roster_entries set notes = 'x' where id = '55555555-5555-5555-5555-555555555555';
  assert (select count(*) from reminders where kind = 'trial_expiry') = 1, 'editing notes duplicated the reminder';
  update roster_entries set trial_expires_at = now() + interval '3 days' where id = '55555555-5555-5555-5555-555555555555';
  assert (select count(*) from reminders where kind = 'trial_expiry') = 1, 'a new expiry should replace the reminder';
  -- the lead time is the user's choice
  update profiles set trial_reminder_minutes = 60;
  assert (select fire_at from reminders where kind = 'trial_expiry')
       = (select trial_expires_at - interval '1 hour' from roster_entries where id = '55555555-5555-5555-5555-555555555555'),
    'changing the lead time should reschedule';
  update profiles set trial_reminder_minutes = null;
  assert not exists (select 1 from reminders where kind = 'trial_expiry'), 'turning trial reminders off should clear them';
  update profiles set trial_reminder_minutes = 1440;
  assert exists (select 1 from reminders where kind = 'trial_expiry'), 'turning them back on should reschedule';
  begin
    update profiles set trial_reminder_minutes = 5;
    raise exception 'an unsupported lead time was accepted';
  exception when check_violation then null;
  end;
  -- a trial that ends sooner than the lead time gets none
  insert into roster_entries (id, user_id, form_id, status, trial_expires_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000c1', 'torkoal', 'trial', now() + interval '3 hours');
  assert (select count(*) from reminders where kind = 'trial_expiry') = 1, 'a trial ending within the lead time got a reminder';
  -- making it permanent or removing it clears the reminder
  update roster_entries set status = 'permanent', trial_expires_at = null where id = '55555555-5555-5555-5555-555555555555';
  assert not exists (select 1 from reminders where kind = 'trial_expiry'), 'a permanent Pokémon kept its trial reminder';

  -- ranch refresh: one at a time, within 22 hours
  perform set_ranch_reminder(now() + interval '22 hours');
  perform set_ranch_reminder(now() + interval '10 hours');
  assert (select count(*) from reminders where kind = 'ranch_refresh' and sent_at is null) = 1, 'ranch reminders should replace each other';
  begin
    perform set_ranch_reminder(now() + interval '30 hours');
    raise exception 'a ranch reminder past 22 hours was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into reminders (user_id, kind, fire_at, roster_entry_id)
      values ('00000000-0000-0000-0000-0000000000c1', 'trial_expiry', now() + interval '1 hour', '55555555-5555-5555-5555-555555555555');
    raise exception 'a user wrote a trial reminder';
  exception when insufficient_privilege then null;
  end;
  begin
    update reminders set sent_at = now();
    raise exception 'a user marked a reminder sent';
  exception when insufficient_privilege then null;
  end;
  begin
    perform claim_due_reminders();
    raise exception 'a user ran the sender';
  exception when insufficient_privilege then null;
  end;

  -- push subscriptions: only real push services, and the signed-in account takes over a shared browser
  begin
    perform save_push_subscription('https://evil.example/push/1', 'k', 'a', 'en');
    raise exception 'an unknown push host was accepted';
  exception when check_violation then null;
  end;
  perform save_push_subscription('https://fcm.googleapis.com/fcm/send/abc', 'k', 'a', 'ja');
  assert (select locale from push_subscriptions) = 'ja', 'subscription not saved';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
do $$ begin
  assert not exists (select 1 from reminders), 'C2 can read C1''s reminders';
  perform save_push_subscription('https://fcm.googleapis.com/fcm/send/abc', 'k2', 'a2', 'en');
  assert (select count(*) from push_subscriptions) = 1, 'C2 should now own the shared browser';
end $$;
reset role;

-- The sender claims what's due once, with names and subscriptions, and skips stale reminders
update reminders set fire_at = now() - interval '1 minute' where kind = 'ranch_refresh' and user_id = '00000000-0000-0000-0000-0000000000c1';
insert into roster_entries (id, user_id, form_id, status, trial_expires_at)
  values ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-0000000000c2', 'garchomp', 'trial', now() + interval '2 days');
update reminders set fire_at = now() - interval '2 minutes' where roster_entry_id = '66666666-6666-6666-6666-666666666666';
insert into reminders (user_id, kind, fire_at) values ('00000000-0000-0000-0000-0000000000c2', 'ranch_refresh', now() - interval '7 hours');
do $$
declare claimed jsonb := claim_due_reminders();
declare c2 jsonb;
begin
  assert jsonb_array_length(claimed) = 2, format('expected two accounts, got %s', claimed);
  select g into c2 from jsonb_array_elements(claimed) g where g->>'user_id' = '00000000-0000-0000-0000-0000000000c2';
  assert jsonb_array_length(c2->'reminders') = 1, 'the 7-hour-old reminder should be skipped';
  assert c2->'reminders'->0->'names'->>'ja' = 'ガブリアス', 'trial reminders should carry names';
  assert c2->'subscriptions'->0->>'endpoint' = 'https://fcm.googleapis.com/fcm/send/abc', 'subscriptions missing';
  assert claim_due_reminders() = '[]'::jsonb, 'a reminder was claimed twice';
  assert not exists (select 1 from reminders where fire_at <= now() and sent_at is null), 'stale reminders should be marked sent';
end $$;
delete from auth.users where id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2');

select 'ALL TESTS PASSED' as result;
