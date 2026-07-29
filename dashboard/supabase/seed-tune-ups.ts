/**
 * seed-tune-ups.ts
 *
 * Seeds two example tune-up races into Supabase `tune_up_races`:
 *   - 10 km test, mid-July 2026 (~10 weeks before race day)
 *   - Half-marathon test, mid-August 2026 (~6 weeks before race day)
 *
 * Override either by editing the rows below, or insert directly via
 * the Supabase dashboard once you've picked actual events.
 *
 * Run: `npm run seed:tune-ups`
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY env vars.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL;
if (!OWNER_EMAIL) {
  console.error("SEED_OWNER_EMAIL env var is required (e.g. SEED_OWNER_EMAIL=you@example.com npm run seed:tune-ups)");
  process.exit(1);
}

const TUNE_UPS = [
  {
    date: "2026-05-10",
    distance_km: 10,
    label: "Baseline 10 km — UNICEF Bois de Boulogne",
    status: "planned" as const,
    notes: "Pre-build baseline 10k, UNICEF run in Bois de Boulogne. Run by feel — current-fitness reference, not a race.",
  },
  {
    date: "2026-07-10",
    distance_km: 10,
    label: "10 km Avondjogging Zevergem",
    status: "planned" as const,
    notes: "End-of-base fitness check. Race at 5K-PB pace + 10 sec/km — fitness test, not all-out.",
  },
  {
    date: "2026-08-10",
    distance_km: 8,
    label: "Corrida da Baia de Monte Gordo (sand run)",
    status: "planned" as const,
    notes: "Sand run in Algarve — fun effort, not a race. Treat as a strength session.",
  },
  {
    date: "2026-08-16",
    distance_km: 21.1,
    label: "Half-marathon test",
    status: "planned" as const,
    notes: "Peak-fitness check + race-day kit/fuel rehearsal. Practice gel cadence (every 5 km from km 5).",
  },
];

async function resolveOwnerId(): Promise<string> {
  const { data, error } = await sb.auth.admin.listUsers();
  if (error) throw new Error(`auth.admin.listUsers failed: ${error.message}`);
  const u = data.users.find((x) => x.email === OWNER_EMAIL);
  if (!u) throw new Error(`No Supabase user found with email ${OWNER_EMAIL}`);
  return u.id;
}

async function main() {
  const userId = await resolveOwnerId();
  console.log(`Owner: ${OWNER_EMAIL} (${userId})`);

  let ok = 0;
  for (const t of TUNE_UPS) {
    const { error } = await sb.from("tune_up_races").upsert({ ...t, user_id: userId }, {
      onConflict: "user_id,date,label",
      ignoreDuplicates: false,
    });
    if (error) {
      console.error(`  ERROR ${t.label}: ${error.message}`);
    } else {
      console.log(`  ✓ ${t.date}  ${t.label}`);
      ok++;
    }
  }
  console.log();
  console.log(`Done — ${ok}/${TUNE_UPS.length} tune-up races seeded.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
