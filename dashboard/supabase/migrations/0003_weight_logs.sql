-- weight_logs — multiple weigh-ins per day with time + food-state context.
-- The existing scores.weight_kg column is the daily summary; this table
-- captures the underlying readings so we can ask "fasted morning weight only"
-- or "before vs after meals" trends.
create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  -- time-of-day for the reading. Optional — older logs from holy_log.py
  -- pre-2026-05-08 won't have it.
  time_of_day time,
  weight_kg numeric(5,2) not null,
  -- Constrained to a small vocabulary so analysis stays clean. Mirrors
  -- WEIGHT_CONTEXTS in holy_log.py.
  context text check (context in (
    'fasted', 'before_breakfast', 'after_breakfast',
    'post_run', 'evening', 'other'
  )),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists weight_logs_user_date_idx
  on public.weight_logs(user_id, date desc, time_of_day desc);

alter table public.weight_logs enable row level security;

-- The owner owns their own data — same RLS pattern as scores.
-- Idempotent: drop-if-exists so the migration can be re-run safely after
-- a partial application (Supabase Studio doesn't wrap multi-statement
-- queries in a transaction).
drop policy if exists "weight_logs_select_own" on public.weight_logs;
create policy "weight_logs_select_own" on public.weight_logs
  for select using (auth.uid() = user_id);

drop policy if exists "weight_logs_insert_own" on public.weight_logs;
create policy "weight_logs_insert_own" on public.weight_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "weight_logs_update_own" on public.weight_logs;
create policy "weight_logs_update_own" on public.weight_logs
  for update using (auth.uid() = user_id);

drop policy if exists "weight_logs_delete_own" on public.weight_logs;
create policy "weight_logs_delete_own" on public.weight_logs
  for delete using (auth.uid() = user_id);
