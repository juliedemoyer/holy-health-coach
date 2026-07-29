-- Split grip_kg into right and left hand columns.
alter table public.scores
  add column if not exists grip_r_kg numeric(4,1),
  add column if not exists grip_l_kg numeric(4,1);

-- ---------------------------------------------------------------------------
-- REMOVED: anon read on the photo buckets.
--
-- An earlier version of this migration created three policies granting the
-- anon role `select` on storage.objects for bucket_id in (body, breakfasts,
-- hyrox). The stated reason was that createSignedUrl() returned "Object not
-- found" during initial page load.
--
-- That was the wrong fix, for two reasons:
--
--   1. It did not do what the comment claimed. A `select` policy for anon is
--      not scoped to signed-URL redemption. It makes every object in those
--      buckets readable and listable by anyone holding the anon key, and the
--      anon key is compiled into the deployed JavaScript bundle. Body photos
--      and meal photos become world-readable to anyone who views source.
--
--   2. The symptom had a different cause. signedUrl() was firing before the
--      Supabase client finished restoring the session from local storage, so
--      the request went out with the anon key alone. RLS then hid the row,
--      and the storage API reports a hidden row as "Object not found" rather
--      than as a permission error, which is what made this look like a policy
--      problem. The fix is in dashboard/src/lib/supabase.ts: signedUrl() now
--      awaits getSession() and refuses to sign when there is no session.
--
-- The owner-scoped policies from 0005 are the only ones these buckets need.
-- If you applied the earlier version of this migration, run
-- 0016_revoke_anon_photo_read.sql to drop the three policies.
-- ---------------------------------------------------------------------------
