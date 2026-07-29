-- Storage policies for the three private buckets.
-- Apply once in Supabase SQL Editor. Without these, anon-key signed-URL
-- requests fail and photos don't render in the dashboard.
--
-- Pattern: any authenticated user (you, signed in via magic link) can
-- read + write all three buckets. RLS on the metadata tables (body_photos,
-- meals) already restricts what's visible per row by user_id, so this
-- bucket-level grant is safe for a single-user app.

-- Drop any pre-existing policies of these names (idempotent re-run)
do $$
declare
  pname text;
begin
  for pname in
    select polname from pg_policy
    where polrelid = 'storage.objects'::regclass
      and polname in (
        'authenticated_read_body','authenticated_write_body','authenticated_update_body','authenticated_delete_body',
        'authenticated_read_breakfasts','authenticated_write_breakfasts','authenticated_update_breakfasts','authenticated_delete_breakfasts',
        'authenticated_read_hyrox','authenticated_write_hyrox','authenticated_update_hyrox','authenticated_delete_hyrox'
      )
  loop
    execute format('drop policy %I on storage.objects', pname);
  end loop;
end $$;

-- BODY bucket
create policy "authenticated_read_body" on storage.objects
  for select to authenticated using (bucket_id = 'body');
create policy "authenticated_write_body" on storage.objects
  for insert to authenticated with check (bucket_id = 'body');
create policy "authenticated_update_body" on storage.objects
  for update to authenticated using (bucket_id = 'body');
create policy "authenticated_delete_body" on storage.objects
  for delete to authenticated using (bucket_id = 'body');

-- BREAKFASTS bucket
create policy "authenticated_read_breakfasts" on storage.objects
  for select to authenticated using (bucket_id = 'breakfasts');
create policy "authenticated_write_breakfasts" on storage.objects
  for insert to authenticated with check (bucket_id = 'breakfasts');
create policy "authenticated_update_breakfasts" on storage.objects
  for update to authenticated using (bucket_id = 'breakfasts');
create policy "authenticated_delete_breakfasts" on storage.objects
  for delete to authenticated using (bucket_id = 'breakfasts');

-- HYROX bucket
create policy "authenticated_read_hyrox" on storage.objects
  for select to authenticated using (bucket_id = 'hyrox');
create policy "authenticated_write_hyrox" on storage.objects
  for insert to authenticated with check (bucket_id = 'hyrox');
create policy "authenticated_update_hyrox" on storage.objects
  for update to authenticated using (bucket_id = 'hyrox');
create policy "authenticated_delete_hyrox" on storage.objects
  for delete to authenticated using (bucket_id = 'hyrox');