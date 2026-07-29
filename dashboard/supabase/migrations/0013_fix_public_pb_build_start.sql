-- OPTIONAL MIGRATION (public page). Grants the anon role read access.
-- Skip this file, and 0006, 0007, 0012 to 0015, if you do not want a
-- public page. See 0006_public_summary_view.sql for what gets exposed.
--
-- Fix public_pb_totals and public_pb_weeks so they agree with the private
-- Training and Vitals pages:
--
--   1. Build start: '2026-05-04' (Mon 4 May) — matches coachPlan.ts BUILD_START
--      and race.ts BUILD_START_ISO. Previously '2026-05-06' which caused
--      sessions/km to be lower than what the Training page reports.
--
--   2. Sessions count: distinct run dates only (type IN run variants).
--      Previously count(*) which counted Hyrox + multi-row split sessions each
--      separately, inflating the number vs the Training page's unique-day count.
--
--   3. Total km and longest run: running activities only.
--      Hyrox km is excluded here (plan sets hyrox km = 0; including it would
--      inflate the "running" volume stat).
--
-- ⚠ Sync rule: when coachPlan.ts BUILD_START changes, update the date here too.
-- Search "BUILD_START_ISO" across the codebase to find all dependents.

do $$
declare
  owner_uid uuid := '00000000-0000-0000-0000-000000000000';
  build_start text := '2026-05-04';   -- = race.ts BUILD_START_ISO
  run_types text[] := ARRAY['run','trailrun','virtualrun','race'];
begin
  -- ── Totals ────────────────────────────────────────────────────────────────
  execute format($v$
    create or replace view public.public_pb_totals
    with (security_invoker = true) as
    select
      -- Sessions = unique dates with at least one run (collapses split-recording
      -- same-day doubles; excludes Hyrox, strength, cross-training).
      count(distinct case when lower(type) = any(%L) then date end)::int  as sessions,
      -- km / longest = running activities only (Hyrox km excluded; plan shows 0).
      coalesce(round(sum(case when lower(type) = any(%L) then distance_km else 0 end)::numeric, 1), 0)::float
                                                                           as total_km,
      coalesce(round(max(case when lower(type) = any(%L) then distance_km end)::numeric, 1), 0)::float
                                                                           as longest_run_km,
      max(case when lower(type) = any(%L) then date end)                  as last_session_date
    from public.activities
    where user_id = %L
      and date >= %L  -- BUILD_START_ISO
  $v$, run_types, run_types, run_types, run_types, owner_uid, build_start);

  -- ── Weeks ────────────────────────────────────────────────────────────────
  execute format($v$
    create or replace view public.public_pb_weeks
    with (security_invoker = true) as
    select
      date_trunc('week', date)::date                                       as week_start,
      count(distinct date)::int                                            as sessions,
      coalesce(round(sum(distance_km)::numeric, 1), 0)::float             as km,
      coalesce(round(max(distance_km)::numeric, 1), 0)::float             as longest_km
    from public.activities
    where user_id = %L
      and date >= %L
      and lower(type) = any(%L)   -- runs only
      and distance_km is not null
    group by 1
    order by 1 desc
  $v$, owner_uid, build_start, run_types);
end $$;

-- Definer mode (postgres owns → bypasses RLS) so anon role can read.
alter view public.public_pb_totals set (security_invoker = false);
alter view public.public_pb_weeks  set (security_invoker = false);

grant select on public.public_pb_totals to anon, authenticated;
grant select on public.public_pb_weeks  to anon, authenticated;
