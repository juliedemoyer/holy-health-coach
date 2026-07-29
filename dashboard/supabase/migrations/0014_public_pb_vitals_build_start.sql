-- OPTIONAL MIGRATION (public page). Grants the anon role read access.
-- Skip this file, and 0006, 0007, 0012 to 0015, if you do not want a
-- public page. See 0006_public_summary_view.sql for what gets exposed.
--
-- Add *_build_start fields to public_pb_latest_vitals so the public page
-- can show "vs build start" deltas for each metric — matching the private
-- ExecSummary tiles on /vitals.
--
-- build_start value = first non-null reading for the metric on or after
-- 2026-05-04 (= race.ts BUILD_START_ISO).
--
-- ⚠ Sync rule: if BUILD_START_ISO changes, update '2026-05-04' here too.

drop view if exists public.public_pb_latest_vitals;

do $$
declare
  owner_uid  uuid := '00000000-0000-0000-0000-000000000000';
  build_start text := '2026-05-04';
begin
  execute format($v$
    create view public.public_pb_latest_vitals
    with (security_invoker = true) as
    select
      -- ── Latest non-null value per metric ─────────────────────────────────
      (select s.hrv              from public.scores s where s.user_id = %L and s.hrv              is not null order by s.date desc limit 1) as hrv,
      (select s.rhr              from public.scores s where s.user_id = %L and s.rhr              is not null order by s.date desc limit 1) as rhr,
      (select s.sleep_hours      from public.scores s where s.user_id = %L and s.sleep_hours      is not null order by s.date desc limit 1) as sleep_hours,
      (select s.sleep_score      from public.scores s where s.user_id = %L and s.sleep_score      is not null order by s.date desc limit 1) as sleep_score,
      (select s.weight_kg        from public.scores s where s.user_id = %L and s.weight_kg        is not null order by s.date desc limit 1) as weight_kg,
      (select s.body_battery     from public.scores s where s.user_id = %L and s.body_battery     is not null order by s.date desc limit 1) as body_battery,
      (select s.vo2max           from public.scores s where s.user_id = %L and s.vo2max           is not null order by s.date desc limit 1) as vo2max,
      (select s.body_fat_percent from public.scores s where s.user_id = %L and s.body_fat_percent is not null order by s.date desc limit 1) as body_fat_percent,
      (select s.muscle_mass_kg   from public.scores s where s.user_id = %L and s.muscle_mass_kg   is not null order by s.date desc limit 1) as muscle_mass_kg,
      (select s.grip_kg          from public.scores s where s.user_id = %L and s.grip_kg          is not null order by s.date desc limit 1) as grip_kg,
      (select s.grip_r_kg        from public.scores s where s.user_id = %L and s.grip_r_kg        is not null order by s.date desc limit 1) as grip_r_kg,
      (select s.grip_l_kg        from public.scores s where s.user_id = %L and s.grip_l_kg        is not null order by s.date desc limit 1) as grip_l_kg,
      -- ── 7-day rolling averages ────────────────────────────────────────────
      (select round(avg(s.hrv)::numeric,              1) from public.scores s where s.user_id = %L and s.hrv              is not null and s.date >= current_date - 6) as hrv_avg7,
      (select round(avg(s.rhr)::numeric,              1) from public.scores s where s.user_id = %L and s.rhr              is not null and s.date >= current_date - 6) as rhr_avg7,
      (select round(avg(s.sleep_hours)::numeric,      2) from public.scores s where s.user_id = %L and s.sleep_hours      is not null and s.date >= current_date - 6) as sleep_hours_avg7,
      (select round(avg(s.sleep_score)::numeric,      1) from public.scores s where s.user_id = %L and s.sleep_score      is not null and s.date >= current_date - 6) as sleep_score_avg7,
      (select round(avg(s.weight_kg)::numeric,        2) from public.scores s where s.user_id = %L and s.weight_kg        is not null and s.date >= current_date - 6) as weight_kg_avg7,
      (select round(avg(s.body_battery)::numeric,     1) from public.scores s where s.user_id = %L and s.body_battery     is not null and s.date >= current_date - 6) as body_battery_avg7,
      (select round(avg(s.vo2max)::numeric,           2) from public.scores s where s.user_id = %L and s.vo2max           is not null and s.date >= current_date - 6) as vo2max_avg7,
      (select round(avg(s.body_fat_percent)::numeric, 2) from public.scores s where s.user_id = %L and s.body_fat_percent is not null and s.date >= current_date - 6) as body_fat_percent_avg7,
      (select round(avg(s.muscle_mass_kg)::numeric,   2) from public.scores s where s.user_id = %L and s.muscle_mass_kg   is not null and s.date >= current_date - 6) as muscle_mass_kg_avg7,
      -- grip avg uses 28d (weekly cadence)
      (select round(avg(s.grip_kg)::numeric,    2) from public.scores s where s.user_id = %L and s.grip_kg    is not null and s.date >= current_date - 27) as grip_kg_avg7,
      (select round(avg(s.grip_r_kg)::numeric,  2) from public.scores s where s.user_id = %L and s.grip_r_kg  is not null and s.date >= current_date - 27) as grip_r_kg_avg7,
      (select round(avg(s.grip_l_kg)::numeric,  2) from public.scores s where s.user_id = %L and s.grip_l_kg  is not null and s.date >= current_date - 27) as grip_l_kg_avg7,
      -- ── Build-start baseline (first non-null reading on/after BUILD_START_ISO) ──
      (select s.hrv              from public.scores s where s.user_id = %L and s.hrv              is not null and s.date >= %L order by s.date asc limit 1) as hrv_build_start,
      (select s.rhr              from public.scores s where s.user_id = %L and s.rhr              is not null and s.date >= %L order by s.date asc limit 1) as rhr_build_start,
      (select s.sleep_hours      from public.scores s where s.user_id = %L and s.sleep_hours      is not null and s.date >= %L order by s.date asc limit 1) as sleep_hours_build_start,
      (select s.sleep_score      from public.scores s where s.user_id = %L and s.sleep_score      is not null and s.date >= %L order by s.date asc limit 1) as sleep_score_build_start,
      (select s.weight_kg        from public.scores s where s.user_id = %L and s.weight_kg        is not null and s.date >= %L order by s.date asc limit 1) as weight_kg_build_start,
      (select s.body_battery     from public.scores s where s.user_id = %L and s.body_battery     is not null and s.date >= %L order by s.date asc limit 1) as body_battery_build_start,
      (select s.vo2max           from public.scores s where s.user_id = %L and s.vo2max           is not null and s.date >= %L order by s.date asc limit 1) as vo2max_build_start,
      (select s.body_fat_percent from public.scores s where s.user_id = %L and s.body_fat_percent is not null and s.date >= %L order by s.date asc limit 1) as body_fat_percent_build_start,
      (select s.muscle_mass_kg   from public.scores s where s.user_id = %L and s.muscle_mass_kg   is not null and s.date >= %L order by s.date asc limit 1) as muscle_mass_kg_build_start,
      (select s.grip_kg          from public.scores s where s.user_id = %L and s.grip_kg          is not null and s.date >= %L order by s.date asc limit 1) as grip_kg_build_start,
      (select s.grip_r_kg        from public.scores s where s.user_id = %L and s.grip_r_kg        is not null and s.date >= %L order by s.date asc limit 1) as grip_r_kg_build_start,
      (select s.grip_l_kg        from public.scores s where s.user_id = %L and s.grip_l_kg        is not null and s.date >= %L order by s.date asc limit 1) as grip_l_kg_build_start
  $v$,
  -- latest (12 × owner_uid)
  owner_uid, owner_uid, owner_uid, owner_uid,
  owner_uid, owner_uid, owner_uid, owner_uid,
  owner_uid, owner_uid, owner_uid, owner_uid,
  -- avg7 (12 × owner_uid)
  owner_uid, owner_uid, owner_uid, owner_uid,
  owner_uid, owner_uid, owner_uid, owner_uid,
  owner_uid, owner_uid, owner_uid, owner_uid,
  -- build_start (12 × owner_uid + build_start interleaved)
  owner_uid, build_start,
  owner_uid, build_start,
  owner_uid, build_start,
  owner_uid, build_start,
  owner_uid, build_start,
  owner_uid, build_start,
  owner_uid, build_start,
  owner_uid, build_start,
  owner_uid, build_start,
  owner_uid, build_start,
  owner_uid, build_start,
  owner_uid, build_start
  );
end $$;

alter view public.public_pb_latest_vitals set (security_invoker = false);
grant select on public.public_pb_latest_vitals to anon, authenticated;
