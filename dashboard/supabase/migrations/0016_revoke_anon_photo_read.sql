-- Revoke anon read on the private photo buckets.
--
-- Run this if you applied an earlier version of 0010, which created three
-- policies granting the anon role `select` on storage.objects for the body,
-- breakfasts and hyrox buckets. Those policies made every photo in those
-- buckets readable and listable by anyone holding the anon key, which is
-- published in the deployed JavaScript bundle.
--
-- Safe to run unconditionally: it drops the policies only if they exist, and
-- the owner-scoped policies from 0005 are untouched.
--
-- After running this, confirm photos still load in the dashboard while
-- signed in. If they do not, you are on a build from before the
-- signedUrl() session fix in dashboard/src/lib/supabase.ts. Deploy that
-- first. Do not restore the anon policies.

do $$
declare
  pname text;
begin
  for pname in
    select polname from pg_policy
    where polrelid = 'storage.objects'::regclass
      and polname in (
        'anon_signed_url_body',
        'anon_signed_url_breakfasts',
        'anon_signed_url_hyrox'
      )
  loop
    execute format('drop policy %I on storage.objects', pname);
    raise notice 'dropped policy % on storage.objects', pname;
  end loop;
end $$;

-- Verification: this should return zero rows.
--
--   select polname
--   from pg_policy
--   where polrelid = 'storage.objects'::regclass
--     and 'anon' = any (
--       select rolname from pg_roles where oid = any (polroles)
--     );
