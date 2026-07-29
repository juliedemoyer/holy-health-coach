-- Add sleep score column to scores table.
-- Garmin returns an overall sleep score (0–100) in:
--   sleep.dailySleepDTO.sleepScores.overall.value
-- This is distinct from sleep_hours (duration). NULL on days without a reading.

ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS sleep_score INTEGER;
