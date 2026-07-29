-- Add wall_km column (km where the runner started to drift or hit the wall)
alter table public.marathons
  add column if not exists wall_km integer;

-- Fix Oslo finish time: 3:22:23 = 12143 seconds
update public.marathons
set finish_time_s = 12143
where race_name ilike '%oslo%'
  and finish_time_s <> 12143;
