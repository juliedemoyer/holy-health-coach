-- Public-facing aggregates for the /public landing page.
--
-- OPTIONAL MIGRATION. This file and 0007, and 0012 to 0015, exist only to
-- power a public page. They grant the anon role read access to the data
-- described below. Nothing else in the app needs them. If you do not want a
-- public page, skip them: every private page works without them.
--
-- What this exposes to the anon role:
--   * Total session count and km from public.activities
--   * Per-week aggregates (week_start, sessions, km, longest run)
--   * NO user_id, NO HR, NO mood/sleep/HRV, NO weights, NO photos,
--     NO activity names (city info would leak), NO individual days.
--
-- Scoped to a single user_id baked in here so the view stays
-- correct if a second auth user ever exists.

do $$
declare
  owner_uid uuid := '00000000-0000-0000-0000-000000000000';
begin
  -- One-row totals
  execute format($v$
    create or replace view public.public_pb_totals
    with (security_invoker = true) as
    select
      count(*)::int                              as sessions,
      coalesce(round(sum(distance_km)::numeric, 1), 0)::float as total_km,
      coalesce(round(max(distance_km)::numeric, 1), 0)::float as longest_run_km,
      max(date)                                  as last_session_date
    from public.activities
    where user_id = %L
      and date >= '2026-05-06'  -- build start
  $v$, owner_uid);

  -- Weekly aggregates (Monday-anchored)
  execute format($v$
    create or replace view public.public_pb_weeks
    with (security_invoker = true) as
    select
      date_trunc('week', date)::date              as week_start,
      count(*)::int                               as sessions,
      coalesce(round(sum(distance_km)::numeric, 1), 0)::float as km,
      coalesce(round(max(distance_km)::numeric, 1), 0)::float as longest_km
    from public.activities
    where user_id = %L
      and date >= '2026-05-06'
    group by 1
    order by 1 desc
  $v$, owner_uid);
end $$;

-- IMPORTANT: views with security_invoker run under the *querying* role's
-- RLS. The anon role normally cannot see public.activities (RLS enforces
-- auth.uid() = user_id). For these two views, we bypass that by setting
-- security_invoker = false (definer mode) — owned by postgres, which
-- bypasses RLS but only exposes the curated columns above.
alter view public.public_pb_totals set (security_invoker = false);
alter view public.public_pb_weeks  set (security_invoker = false);

-- Grant explicit read to anon + authenticated roles.
grant select on public.public_pb_totals to anon, authenticated;
grant select on public.public_pb_weeks  to anon, authenticated;
