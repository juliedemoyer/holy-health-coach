-- OPTIONAL MIGRATION (public page). Grants the anon role read access.
-- Skip this file, and 0006, 0007, 0012 to 0015, if you do not want a
-- public page. See 0006_public_summary_view.sql for what gets exposed.
--
-- Public view: non-running sessions (strength / Hyrox / HIIT) per build week.
-- Used by /public to show "2 × Hyrox" below the km-per-week chart.
--
-- Included activity types (lower-cased):
--   hyrox, weighttraining, weight_training, workout, crossfit, hiit, crosstraining
--
-- type_label:
--   'hyrox'    → at least one Hyrox session this week
--   'hiit'     → HIIT / CrossFit (no Hyrox)
--   'strength' → generic weight training / workout
--
-- ⚠ Sync rule: if BUILD_START_ISO changes, update '2026-05-04' here too.

do $$
declare
  owner_uid  uuid := '00000000-0000-0000-0000-000000000000';
  build_start text := '2026-05-04';
begin
  execute format($v$
    create or replace view public.public_pb_strength_weeks
    with (security_invoker = true) as
    select
      date_trunc('week', date)::date                               as week_start,
      count(*)::int                                                as sessions,
      case
        when bool_or(lower(type) = 'hyrox')                       then 'hyrox'
        when bool_or(lower(type) in ('hiit','crossfit','crosstraining')) then 'hiit'
        else 'strength'
      end                                                          as type_label
    from public.activities
    where user_id = %L
      and date   >= %L
      and lower(type) = any(
            ARRAY['hyrox','weighttraining','weight_training',
                  'workout','crossfit','hiit','crosstraining']
          )
    group by 1
    order by 1 desc
  $v$, owner_uid, build_start);
end $$;

alter view public.public_pb_strength_weeks set (security_invoker = false);
grant select on public.public_pb_strength_weeks to anon, authenticated;
