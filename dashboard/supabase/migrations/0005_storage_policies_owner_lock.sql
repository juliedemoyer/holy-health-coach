-- Tighten storage policies for body / breakfasts / hyrox buckets.
--
-- Why: 0002 granted all four CRUD ops to any authenticated user with
-- bucket_id = X. That is only safe while signups are off in Supabase
-- Auth. If a second account ever exists (intentionally or not), every
-- body photo becomes readable to that account.
--
-- Defence-in-depth: pin every policy to the owner's auth.uid() so even if
-- another user authenticates, they get zero rows from these buckets.
--
-- Note: storage.objects.owner is NULL on rows uploaded via service_role
-- (which is how upload_body_photo.py and upload_meal_photo.py upload),
-- so we cannot scope on owner. We scope on the JWT subject directly.
--
-- If the owner user_id ever changes (rare — only on full Auth re-init),
-- update the constant in one place at the top.

do $$
declare
  owner_uid uuid := '00000000-0000-0000-0000-000000000000';
  pname text;
begin
  -- Drop the loose 0002 policies (and any prior owner-lock variants)
  for pname in
    select polname from pg_policy
    where polrelid = 'storage.objects'::regclass
      and polname in (
        'authenticated_read_body','authenticated_write_body','authenticated_update_body','authenticated_delete_body',
        'authenticated_read_breakfasts','authenticated_write_breakfasts','authenticated_update_breakfasts','authenticated_delete_breakfasts',
        'authenticated_read_hyrox','authenticated_write_hyrox','authenticated_update_hyrox','authenticated_delete_hyrox',
        'owner_read_body','owner_write_body','owner_update_body','owner_delete_body',
        'owner_read_breakfasts','owner_write_breakfasts','owner_update_breakfasts','owner_delete_breakfasts',
        'owner_read_hyrox','owner_write_hyrox','owner_update_hyrox','owner_delete_hyrox'
      )
  loop
    execute format('drop policy %I on storage.objects', pname);
  end loop;

  -- BODY bucket — owner only
  execute format($p$create policy "owner_read_body" on storage.objects
    for select to authenticated using (bucket_id = 'body' and auth.uid() = %L)$p$, owner_uid);
  execute format($p$create policy "owner_write_body" on storage.objects
    for insert to authenticated with check (bucket_id = 'body' and auth.uid() = %L)$p$, owner_uid);
  execute format($p$create policy "owner_update_body" on storage.objects
    for update to authenticated using (bucket_id = 'body' and auth.uid() = %L)$p$, owner_uid);
  execute format($p$create policy "owner_delete_body" on storage.objects
    for delete to authenticated using (bucket_id = 'body' and auth.uid() = %L)$p$, owner_uid);

  -- BREAKFASTS bucket — owner only
  execute format($p$create policy "owner_read_breakfasts" on storage.objects
    for select to authenticated using (bucket_id = 'breakfasts' and auth.uid() = %L)$p$, owner_uid);
  execute format($p$create policy "owner_write_breakfasts" on storage.objects
    for insert to authenticated with check (bucket_id = 'breakfasts' and auth.uid() = %L)$p$, owner_uid);
  execute format($p$create policy "owner_update_breakfasts" on storage.objects
    for update to authenticated using (bucket_id = 'breakfasts' and auth.uid() = %L)$p$, owner_uid);
  execute format($p$create policy "owner_delete_breakfasts" on storage.objects
    for delete to authenticated using (bucket_id = 'breakfasts' and auth.uid() = %L)$p$, owner_uid);

  -- HYROX bucket — owner only
  execute format($p$create policy "owner_read_hyrox" on storage.objects
    for select to authenticated using (bucket_id = 'hyrox' and auth.uid() = %L)$p$, owner_uid);
  execute format($p$create policy "owner_write_hyrox" on storage.objects
    for insert to authenticated with check (bucket_id = 'hyrox' and auth.uid() = %L)$p$, owner_uid);
  execute format($p$create policy "owner_update_hyrox" on storage.objects
    for update to authenticated using (bucket_id = 'hyrox' and auth.uid() = %L)$p$, owner_uid);
  execute format($p$create policy "owner_delete_hyrox" on storage.objects
    for delete to authenticated using (bucket_id = 'hyrox' and auth.uid() = %L)$p$, owner_uid);
end $$;
