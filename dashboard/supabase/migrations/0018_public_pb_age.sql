-- OPTIONAL MIGRATION (public page). Grants the anon role read access.
-- Skip this file, and 0006, 0007, 0012 to 0015, if you do not want a
-- public page. See 0006_public_summary_view.sql for what gets exposed.
--
-- Age in whole years, for computation only.
--
-- The /public page ranks vitals into age-group percentile bands and derives a
-- fitness age. Both need a number. This view publishes the integer year and
-- nothing else, so the page can compute without the date of birth ever
-- reaching an unauthenticated client.
--
-- Read this before running it. It publishes an age. That is much coarser than
-- a date of birth, and if you already run the public vitals views then a
-- published VO2max next to a fitness age makes the year derivable anyway. It
-- is still a fact about a real person on the open internet, and the honest
-- default for a fork is to skip both this and the vitals views.
--
-- Whatever you decide here, keep the rule the reference instance follows:
-- the age is used by the sports-science helpers and never rendered or quoted.
-- Publishing a number the page then prints is a different decision from
-- publishing one it only computes with.

do $$
declare
  owner_uid uuid := '00000000-0000-0000-0000-000000000000';
begin
  execute format($v$
    create or replace view public.public_pb_age as
    select extract(year from age(current_date, c.birthdate))::int as age_years
    from public.config c
    where c.user_id = %L
      and c.birthdate is not null
  $v$, owner_uid);
end $$;

-- Definer mode so anon reads the curated column without reaching config.
alter view public.public_pb_age set (security_invoker = false);

grant select on public.public_pb_age to anon, authenticated;
