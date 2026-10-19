-- RLS + sync behaviour tests. Run after migrations. Fails loudly on any violation.
\set ON_ERROR_STOP on

insert into regulations values ('M-C','Regulation Set M-C','2026-09-09 02:00Z','2026-12-02 01:59Z');
insert into forms values ('garchomp','garchomp',445,'{dragon,ground}','445'),
                         ('ninetales-alola','ninetales',38,'{ice,fairy}','38-alola');
insert into form_names values ('garchomp','en','Garchomp'),('garchomp','ja','ガブリアス');
insert into items values ('focus-sash','held',null,null,'focus-sash');
insert into regulation_forms values ('M-C','garchomp');
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
select 'ALL TESTS PASSED' as result;
