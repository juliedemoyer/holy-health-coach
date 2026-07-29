-- public_pb_latest_vitals — anon-readable view for /public KPI tiles.
--
-- Single-user project; The owner has explicitly authorized exposing the raw
-- latest values on the public marketing page alongside the percentile
-- ranking. Same pattern as Bryan Johnson's Blueprint site.
--
-- Privacy guardrails preserved:
--   - no date column (defeats "what was your HRV on Tuesday" scraping)
--   - no age (matches the no-age-display rule in profile.ts)
--   - no user_id, no email, no auth metadata
--   - the underlying `scores` table keeps its RLS untouched; this view
--     is the only thing anon can read, and only the columns below.
--   - 7-day averages are aggregates over a rolling window; no individual
--     historical days are exposed.

CREATE OR REPLACE VIEW public.public_pb_latest_vitals AS
WITH last7 AS (
  SELECT
    avg(hrv)              AS hrv_avg7,
    avg(rhr)              AS rhr_avg7,
    avg(sleep_hours)      AS sleep_hours_avg7,
    avg(weight_kg)        AS weight_kg_avg7,
    avg(body_battery)     AS body_battery_avg7,
    avg(vo2max)           AS vo2max_avg7,
    avg(body_fat_percent) AS body_fat_percent_avg7
  FROM scores
  WHERE date >= (current_date - interval '7 days')
    AND date < current_date
)
SELECT
  (SELECT hrv               FROM scores WHERE hrv               IS NOT NULL ORDER BY date DESC LIMIT 1) AS hrv,
  (SELECT rhr               FROM scores WHERE rhr               IS NOT NULL ORDER BY date DESC LIMIT 1) AS rhr,
  (SELECT sleep_hours       FROM scores WHERE sleep_hours       IS NOT NULL ORDER BY date DESC LIMIT 1) AS sleep_hours,
  (SELECT weight_kg         FROM scores WHERE weight_kg         IS NOT NULL ORDER BY date DESC LIMIT 1) AS weight_kg,
  (SELECT body_battery      FROM scores WHERE body_battery      IS NOT NULL ORDER BY date DESC LIMIT 1) AS body_battery,
  (SELECT vo2max            FROM scores WHERE vo2max            IS NOT NULL ORDER BY date DESC LIMIT 1) AS vo2max,
  (SELECT body_fat_percent  FROM scores WHERE body_fat_percent  IS NOT NULL ORDER BY date DESC LIMIT 1) AS body_fat_percent,
  last7.hrv_avg7,
  last7.rhr_avg7,
  last7.sleep_hours_avg7,
  last7.weight_kg_avg7,
  last7.body_battery_avg7,
  last7.vo2max_avg7,
  last7.body_fat_percent_avg7
FROM last7;

GRANT SELECT ON public.public_pb_latest_vitals TO anon, authenticated;
