-- Runs app.purge_soft_deleted() once a day, so rows removed more than 30 days ago (roster
-- entries, teams, HOME forms, items) are deleted for real instead of staying as tombstones.
-- Thirty days gives every device time to sync a removal before its tombstone disappears.
--
-- pg_cron ships with Supabase. Plain Postgres (CI) doesn't have it, so the schedule is skipped
-- there with a notice instead of failing the migration.
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron is not available, so app.purge_soft_deleted() is not scheduled here';
    return;
  end if;
  execute 'create extension if not exists pg_cron with schema pg_catalog';
  -- Scheduling under a name that already exists replaces that job, so rerunning this is safe.
  -- 04:23 UTC: overnight in the Americas, off the hour when scheduled jobs pile up.
  execute $sql$select cron.schedule('purge-soft-deleted', '23 4 * * *', 'select app.purge_soft_deleted()')$sql$;
end $$;
