-- OPTIONAL MIGRATION (public page). Grants the anon role read access.
-- Skip this file, and 0006, 0007, 0012 to 0015, if you do not want a
-- public page. See 0006_public_summary_view.sql for what gets exposed.
--
-- Create (or replace) the public_pb_latest_vitals view that powers the
-- "Today's vitals" section on the /public landing page.
--
-- Returns a single row: the most recent non-null value for each metric,
-- plus a 7-day rolling average for every metric that has a trend chip.
--
-- Intentionally public (anon readable). The owner explicitly chose to expose these KPIs
-- on the public page as part of the "coached by AI" transparency narrative.
-- NO user_id, NO mood, NO cycle data, NO activity names leak through.

-- DROP first: CREATE OR REPLACE VIEW can't insert new columns in the middle.
drop view if exists public.public_pb_latest_vitals;

do $$
declare
  owner_uid uuid := '00000000-0000-0000-0000-000000000000';
begin
  execute format($v$
    create view public.public_pb_latest_vitals
    with (security_invoker = true) as
    select
      -- Latest non-null value per metric
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
      -- 7-day rolling averages (used for trend chips on each tile)
      (select round(avg(s.hrv)::numeric, 1)              from public.scores s where s.user_id = %L and s.hrv              is not null and s.date >= current_date - 6) as hrv_avg7,
      (select round(avg(s.rhr)::numeric, 1)              from public.scores s where s.user_id = %L and s.rhr              is not null and s.date >= current_date - 6) as rhr_avg7,
      (select round(avg(s.sleep_hours)::numeric, 2)      from public.scores s where s.user_id = %L and s.sleep_hours      is not null and s.date >= current_date - 6) as sleep_hours_avg7,
      (select round(avg(s.sleep_score)::numeric, 1)      from public.scores s where s.user_id = %L and s.sleep_score      is not null and s.date >= current_date - 6) as sleep_score_avg7,
      (select round(avg(s.weight_kg)::numeric, 2)        from public.scores s where s.user_id = %L and s.weight_kg        is not null and s.date >= current_date - 6) as weight_kg_avg7,
      (select round(avg(s.body_battery)::numeric, 1)     from public.scores s where s.user_id = %L and s.body_battery     is not null and s.date >= current_date - 6) as body_battery_avg7,
      (select round(avg(s.vo2max)::numeric, 2)           from public.scores s where s.user_id = %L and s.vo2max           is not null and s.date >= current_date - 6) as vo2max_avg7,
      (select round(avg(s.body_fat_percent)::numeric, 2) from public.scores s where s.user_id = %L and s.body_fat_percent is not null and s.date >= current_date - 6) as body_fat_percent_avg7,
      (select round(avg(s.muscle_mass_kg)::numeric, 2)   from public.scores s where s.user_id = %L and s.muscle_mass_kg   is not null and s.date >= current_date - 6) as muscle_mass_kg_avg7,
      -- Grip avg7 uses 28d window (only updates weekly on Sundays)
      (select round(avg(s.grip_kg)::numeric, 2)          from public.scores s where s.user_id = %L and s.grip_kg          is not null and s.date >= current_date - 27) as grip_kg_avg7,
      (select round(avg(s.grip_r_kg)::numeric, 2)        from public.scores s where s.user_id = %L and s.grip_r_kg        is not null and s.date >= current_date - 27) as grip_r_kg_avg7,
      (select round(avg(s.grip_l_kg)::numeric, 2)        from public.scores s where s.user_id = %L and s.grip_l_kg        is not null and s.date >= current_date - 27) as grip_l_kg_avg7
  $v$,
  -- 24 %L placeholders = 24 copies of owner_uid
  owner_uid, owner_uid, owner_uid, owner_uid, owner_uid, owner_uid,
  owner_uid, owner_uid, owner_uid, owner_uid, owner_uid, owner_uid,
  owner_uid, owner_uid, owner_uid, owner_uid, owner_uid, owner_uid,
  owner_uid, owner_uid, owner_uid, owner_uid, owner_uid, owner_uid);
end $$;

-- Bypass RLS (definer mode = postgres, which owns the view) so anon can read it.
alter view public.public_pb_latest_vitals set (security_invoker = false);

grant select on public.public_pb_latest_vitals to anon, authenticated;
