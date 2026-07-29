-- Body composition fields from the Garmin scale, refreshed daily on the
-- same path as Body Battery / VO₂max. Three new columns on `scores`:
--   body_fat_percent   — primary signal (athlete-relevant, trends slowly)
--   muscle_mass_kg     — supporting signal (worth watching during build)
--   body_water_percent — context for hydration / body-fat reads
--
-- All optional; existing rows backfill to NULL. No RLS changes (scores
-- already enforces auth.uid() = user_id). Idempotent: `add column if not
-- exists` so the migration can be re-run safely.

alter table public.scores add column if not exists body_fat_percent numeric(4,1);
alter table public.scores add column if not exists muscle_mass_kg numeric(5,2);
alter table public.scores add column if not exists body_water_percent numeric(4,1);

-- Sanity comment so future readers know where these come from.
comment on column public.scores.body_fat_percent is
  'Garmin scale body fat % (totalAverage.bodyFat). Daily refresh.';
comment on column public.scores.muscle_mass_kg is
  'Garmin scale muscle mass (totalAverage.muscleMass / 1000). Daily refresh.';
comment on column public.scores.body_water_percent is
  'Garmin scale body water % (totalAverage.bodyWater). Daily refresh.';
