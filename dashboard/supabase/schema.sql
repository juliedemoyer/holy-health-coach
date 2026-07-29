-- Holy V3 — Supabase schema
-- ----------------------------------------------------------------------
-- Apply via: supabase login → supabase db push, or paste in SQL Editor.
-- Storage buckets must be created separately (see bottom of file).
-- All tables are RLS-locked to a single user. The Holy app
-- authenticates via Supabase magic link to whichever email the project's
-- auth.users row belongs to (set SEED_OWNER_EMAIL when running the seed
-- scripts, and use the matching VITE_OWNER_EMAIL in the dashboard).
-- ----------------------------------------------------------------------

-- Allow array helpers + uuid
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------
-- 1. Daily score (one row per day)
-- ----------------------------------------------------------------------
create table if not exists scores (
  user_id        uuid not null default auth.uid(),
  date           date not null,
  score          numeric,
  hrv            numeric,
  rhr            numeric,
  sleep_hours    numeric,
  vo2max         numeric,
  body_battery   numeric,
  weight_kg      numeric,
  mood           int,
  cycle_day      int,
  cycle_phase    text check (cycle_phase in ('menstrual','follicular','ovulation','luteal')),
  notes          text,
  created_at     timestamptz default now(),
  primary key (user_id, date)
);
create index if not exists scores_date_idx on scores(date desc);

-- ----------------------------------------------------------------------
-- 2. Morning check-ins (full markdown for journal)
-- ----------------------------------------------------------------------
create table if not exists check_ins (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null default auth.uid(),
  date           date not null,
  content_md     text not null,
  coach_read     text,
  micro_actions  jsonb,
  closer         text,
  created_at     timestamptz default now()
);
create index if not exists check_ins_date_idx on check_ins(date desc);

-- ----------------------------------------------------------------------
-- 3. Strava activities (running + cross-training)
-- ----------------------------------------------------------------------
create table if not exists activities (
  id             bigint primary key,           -- Strava activity id
  user_id        uuid not null default auth.uid(),
  date           date not null,
  type           text,                          -- run / trailrun / virtualrun / strength / etc.
  name           text,
  distance_km    numeric,
  duration_s     int,
  avg_pace_s_per_km int,
  avg_hr         int,
  max_hr         int,
  avg_power      int,
  elevation_m    int,
  perceived_effort int,
  feel           text check (feel in ('great','good','ok','flat','bad') or feel is null),
  notes          text,
  raw            jsonb,
  created_at     timestamptz default now()
);
create index if not exists activities_date_idx on activities(date desc);
create index if not exists activities_type_idx on activities(type);

-- ----------------------------------------------------------------------
-- 4. Meals + breakfast vision
-- ----------------------------------------------------------------------
create table if not exists meals (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null default auth.uid(),
  date           date not null,
  slot           text check (slot in ('breakfast','lunch','dinner','snack')),
  photo_path     text,                          -- Supabase Storage path under breakfasts/
  foods          text[],                        -- ['oats', 'banana', 'almond butter', ...]
  protein_g      numeric,
  carbs_g        numeric,
  fat_g          numeric,
  calories       numeric,
  vision_notes   text,                          -- Nutri's one-liner from holy_vision.py
  created_at     timestamptz default now()
);
create index if not exists meals_date_idx on meals(date desc);

-- ----------------------------------------------------------------------
-- 5. Body progress photos (weekly training build + Hyrox)
-- ----------------------------------------------------------------------
create table if not exists body_photos (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null default auth.uid(),
  date           date not null,
  kind           text not null check (kind in ('build_weekly','hyrox')),
  build_week     int,                           -- 1..20 for build_weekly (NULL for hyrox)
  storage_path   text not null,                 -- private bucket, signed URL only
  caption        text,
  created_at     timestamptz default now()
);
create index if not exists body_photos_date_idx on body_photos(date desc);

-- ----------------------------------------------------------------------
-- 6. Action proposals (the agent proposes, you confirm)
-- ----------------------------------------------------------------------
create table if not exists actions (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null default auth.uid(),
  date           date not null,
  kind           text check (kind in ('block_recovery','block_training','draft_email','add_meal_reminder','flag_medical')),
  title          text not null,
  description    text,
  status         text default 'pending' check (status in ('pending','confirmed','skipped','done','expired')),
  proposed_by    text default 'coach' check (proposed_by in ('coach','nutri','doc','mind')),
  payload        jsonb,
  created_at     timestamptz default now(),
  resolved_at    timestamptz
);
create index if not exists actions_date_idx on actions(date desc);
create index if not exists actions_status_idx on actions(status);

-- ----------------------------------------------------------------------
-- 7. Medical reference (read from desktop ~/Holy/data/medical/*.md)
-- ----------------------------------------------------------------------
create table if not exists medical (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null default auth.uid(),
  topic          text not null,                 -- 'gp', 'gynaecology', 'bloodwork', 'dentist'
  visit_date     date,
  next_due       date,
  summary        text,
  full_md        text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists medical_next_due_idx on medical(next_due);

-- ----------------------------------------------------------------------
-- 8. Recipes library (Nutri's source)
-- ----------------------------------------------------------------------
create table if not exists recipes (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null default auth.uid(),
  slug           text unique not null,
  title          text not null,
  tags           text[],                        -- ['long-run-fuel', 'recovery', 'pre-race', 'pescatarian', ...]
  ingredients    jsonb,
  steps          text[],
  protein_g      numeric,
  carbs_g        numeric,
  fat_g          numeric,
  prep_time_min  int,
  cook_time_min  int,
  source_md_path text,
  created_at     timestamptz default now()
);
create index if not exists recipes_tags_idx on recipes using gin(tags);

-- ----------------------------------------------------------------------
-- 9. Marathon history (seeded once from Excels in Knowledge/Marathon Data/)
-- ----------------------------------------------------------------------
create table if not exists marathons (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null default auth.uid(),
  race_date      date not null,
  race_name      text not null,
  finish_time_s  int not null,
  avg_pace_s_per_km int,
  weather        text,                          -- 'cool dry' / 'humid 24C' / etc.
  weekly_volume_km numeric,                     -- avg in build
  longest_run_km numeric,
  notes          text,
  unique (user_id, race_date, race_name)
);
create index if not exists marathons_date_idx on marathons(race_date desc);

-- ----------------------------------------------------------------------
-- 10. Tune-up races (10k + half-marathon test races for the goal race)
-- ----------------------------------------------------------------------
create table if not exists tune_up_races (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null default auth.uid(),
  date           date not null,
  distance_km    numeric not null,
  label          text,                          -- '10 km test', 'Half-marathon test'
  status         text default 'planned' check (status in ('planned','done','cancelled','tbd')),
  finish_time_s  int,
  notes          text,
  link           text,                          -- official event URL (rendered as a hyperlink on /)
  unique (user_id, date, label)
);
alter table tune_up_races add column if not exists link text;
create index if not exists tune_up_races_date_idx on tune_up_races(date);

-- ----------------------------------------------------------------------
-- 11. Cycle log (opt-in: ON in V3)
-- ----------------------------------------------------------------------
create table if not exists cycles (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null default auth.uid(),
  lmp_date       date not null,                 -- last menstrual period start
  cycle_length_days int default 28,
  notes          text,
  created_at     timestamptz default now()
);
create index if not exists cycles_lmp_idx on cycles(lmp_date desc);

-- ----------------------------------------------------------------------
-- 12. Config (feature flags + tune-up overrides + race date if it ever changes)
-- ----------------------------------------------------------------------
create table if not exists config (
  user_id        uuid primary key default auth.uid(),
  cycle_tracking boolean default true,
  vision_macros  boolean default true,
  race_date      date default '2026-09-27',
  race_name      text default 'Example City Marathon',
  sessions_goal  int default 100,
  sessions_start date default '2026-05-06',
  updated_at     timestamptz default now()
);

-- ----------------------------------------------------------------------
-- Row-level security — every table is locked to the authenticated user
-- ----------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename in (
    'scores','check_ins','activities','meals','body_photos','actions',
    'medical','recipes','marathons','tune_up_races','cycles','config'
  ) loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_owner on %I', t, t);
    execute format(
      'create policy %I_owner on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t, t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------
-- Storage buckets — create via Supabase dashboard or storage API
-- ----------------------------------------------------------------------
-- Run these from the dashboard SQL editor (storage.buckets is restricted):
--
--   insert into storage.buckets (id, name, public) values
--     ('breakfasts', 'breakfasts', false),
--     ('body',       'body',       false),
--     ('hyrox',      'hyrox',      false)
--   on conflict (id) do nothing;
--
-- Then storage policies:
--
--   create policy "Owner can read body" on storage.objects for select
--     using (bucket_id = 'body' and auth.uid() = owner);
--   create policy "Owner can write body" on storage.objects for insert
--     with check (bucket_id = 'body' and auth.uid() = owner);
--   (repeat for breakfasts + hyrox)
--
-- Signed URLs only — never set buckets to public.
