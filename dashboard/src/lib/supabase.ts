import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import { IS_DEMO, demoClient } from "./demo";

const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

if (!IS_DEMO && (!url || !key)) {
  // Don't crash in dev when env vars are missing — surface a clear error
  // when any query is attempted instead.
  console.warn(
    "[holy] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — copy .env.example to .env.local, or append ?demo=1 to browse with fictional data",
  );
}

const realClient: SupabaseClient<Database> = createClient<Database>(
  url || "https://placeholder.supabase.co",
  key || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "holy-coach-auth",
    },
  },
);

/**
 * In demo mode (`?demo=1`) this is a local shim over config/demo-data.json:
 * no network, no auth, and every write is dropped. See lib/demo.ts.
 */
export const supabase: SupabaseClient<Database> = (
  IS_DEMO ? (demoClient as unknown as SupabaseClient<Database>) : realClient
);

/**
 * `activities.distance_km` is a Postgres `numeric` column, which PostgREST
 * serializes as a JSON string to avoid float precision loss — even though the
 * generated types say `number`. Left uncoerced, `weeklyKm += a.distance_km`
 * and similar sums silently do string concatenation instead of addition
 * (e.g. "10.08.7623.51"). Call this on every row coming out of an
 * `activities` query.
 */
export function coerceActivityDistance<T extends { distance_km: number | null }>(row: T): T {
  return row.distance_km == null ? row : { ...row, distance_km: Number(row.distance_km) };
}

/**
 * Get a signed URL for a private storage bucket object.
 *
 * Waits for the session before signing. Without that wait, a call made during
 * initial page load races the client's restore-from-storage step and goes out
 * with the anon key alone. RLS then hides the row, and the storage API reports
 * a hidden row as "Object not found" rather than as a permission error, which
 * makes a timing bug look like a missing policy. The tempting fix (grant the
 * anon role select on the bucket) makes every private photo world-readable,
 * because the anon key ships inside the deployed bundle. See
 * supabase/migrations/0016_revoke_anon_photo_read.sql.
 */
export async function signedUrl(bucket: string, path: string, expiresIn = 3600) {
  if (IS_DEMO) throw new Error("demo mode: no stored images");

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error(
      "not signed in: private photos need an authenticated session",
    );
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
