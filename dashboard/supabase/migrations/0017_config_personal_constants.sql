-- Move the athlete's personal constants out of the client bundle.
--
-- Height, date of birth and sex used to be read from VITE_HEIGHT_CM,
-- VITE_BIRTHDATE and VITE_SEX. Vite inlines every VITE_-prefixed variable
-- into the client bundle at build time, so those values ended up as literal
-- strings in a publicly downloadable .js asset. Keeping them out of a
-- committed file moved them from the repo into the bundle; it did not make
-- them private, and holding them as deploy-target secrets did not either,
-- because the build reads the secret and writes the value into the bundle.
--
-- Behind RLS on this table (`auth.uid() = user_id`) they reach only the
-- signed-in owner. The app reads them once, in AuthGuard, after the session
-- exists.
--
-- Not optional: run this one. Without it the age-derived tiles and the BMI
-- helper render their empty state.

alter table public.config
  add column if not exists birthdate date,
  add column if not exists height_cm  smallint,
  add column if not exists sex        text;

alter table public.config
  drop constraint if exists config_sex_check;
alter table public.config
  add constraint config_sex_check check (sex is null or sex in ('female', 'male'));

comment on column public.config.birthdate is
  'Personal. Drives age-derived tiles and age-group percentiles. Never expose through a public_pb_* view.';
comment on column public.config.height_cm is
  'Personal. Used by the BMI helper only.';
comment on column public.config.sex is
  'Personal. Used by a handful of sports-science reference ranges.';

-- Set your own values, then delete VITE_HEIGHT_CM / VITE_BIRTHDATE / VITE_SEX
-- from every .env file and deploy environment you have:
--
--   insert into public.config (user_id, birthdate, height_cm, sex)
--   values (auth.uid(), '1990-01-01', 175, 'female')
--   on conflict (user_id) do update
--     set birthdate = excluded.birthdate,
--         height_cm = excluded.height_cm,
--         sex       = excluded.sex,
--         updated_at = now();
