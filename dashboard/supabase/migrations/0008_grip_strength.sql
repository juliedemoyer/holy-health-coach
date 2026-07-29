-- Grip strength — weekly Sunday-evening test, a CNS-fatigue / recovery
-- indicator. One new column on `scores`:
--   grip_kg — the weekly grip reading (kg) Coach logs via
--             holy_log.py grip-strength. Sparse: only set on test days.
--
-- Optional; existing rows backfill to NULL. No RLS changes (scores already
-- enforces auth.uid() = user_id). Idempotent: `add column if not exists`
-- so the migration can be re-run safely.

alter table public.scores add column if not exists grip_kg numeric(4,1);

comment on column public.scores.grip_kg is
  'Weekly grip strength test (kg), logged via holy_log.py grip-strength. '
  'Sunday-evening cadence; NULL on non-test days. CNS-fatigue indicator.';
