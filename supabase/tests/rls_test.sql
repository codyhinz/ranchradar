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
  update roster_entries set spread = '{"hp": 252, "atk": 252}' where form_id = 'garchomp';  -- a real spread fits
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
      select '00000000-0000-0000-0000-00000000000a', 'ranch_refresh', now() from generate_series(1, 501);
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

select 'ALL TESTS PASSED' as result;
