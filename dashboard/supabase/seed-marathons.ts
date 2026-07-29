/**
 * seed-marathons.ts
 *
 * One-time importer for your marathon history. Walks the Garmin lap CSVs
 * in `1. Knowledge/Marathon Data/`, extracts race name + date from the
 * filename, computes finish time + avg pace + longest split from the lap
 * data, and upserts one row per race into Supabase `marathons`.
 *
 * Run:
 *   cd "2. Holy" && npm run seed:marathons
 *
 * Requires:
 *   SUPABASE_URL=…           (env)
 *   SUPABASE_SERVICE_KEY=…   (env, service-role; this is a server-side script)
 *
 * The CSVs come from Garmin Connect's "Splits" export. Each row is a 1 km
 * split with columns including Time, Cumulative Time, Distance, Avg Pace,
 * Avg HR, etc. We only care about Cumulative Time on the last row.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const KNOWLEDGE_DIR = join(
  process.cwd(),
  "..",
  "1. Knowledge",
  "Marathon Data",
);

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. Either export them or:",
  );
  console.error("  export $(grep -v '^#' ~/Holy/.env | xargs)");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL;
if (!OWNER_EMAIL) {
  console.error("SEED_OWNER_EMAIL env var is required (e.g. SEED_OWNER_EMAIL=you@example.com npm run seed:marathons)");
  process.exit(1);
}

async function resolveOwnerId(): Promise<string> {
  // service-role can list users; find the owner user_id by email so we can
  // stamp each seeded row with the correct owner.
  const { data, error } = await sb.auth.admin.listUsers();
  if (error) throw new Error(`auth.admin.listUsers failed: ${error.message}`);
  const u = data.users.find((x) => x.email === OWNER_EMAIL);
  if (!u) throw new Error(`No Supabase user found with email ${OWNER_EMAIL}`);
  return u.id;
}

// -------------------------- helpers --------------------------------------

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, sept: 9, october: 10, november: 11, december: 12,
};

interface ParsedFilename {
  race_name: string;
  race_date: string; // ISO YYYY-MM-DD
  is_half: boolean;
}

function parseFilename(name: string): ParsedFilename | null {
  // Strip .csv
  const base = name.replace(/\.csv$/i, "").trim();

  // Detect half-marathon vs marathon (skip halves for now — separate table later)
  const is_half = /half[\s-]?marathon/i.test(base);

  // Extract race name: take everything before the first " - " or before the first month name
  let race_name = base;
  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;

  // Try patterns:
  //   "<race> - <Month> <Year>"
  //   "<race> - <Day> <Month> <Year>"
  //   "<race> <Day> <Month> <Year>"
  const m1 = base.match(/^(.+?)\s*-\s*(?:(\d{1,2})\s+)?(\w+)\s+(\d{4})$/i);
  const m2 = base.match(/^(.+?)\s+(\d{1,2})\s+(\w+)\s+(\d{4})$/i);

  let nameRaw: string | undefined;
  if (m1) {
    nameRaw = m1[1];
    if (m1[2]) day = Number(m1[2]);
    month = MONTHS[m1[3].toLowerCase()] ?? null;
    year = Number(m1[4]);
  } else if (m2) {
    nameRaw = m2[1];
    day = Number(m2[2]);
    month = MONTHS[m2[3].toLowerCase()] ?? null;
    year = Number(m2[4]);
  }

  if (!nameRaw || !month || !year) return null;

  // Tidy "ParisHalfMarathon" → "Paris Half Marathon"
  race_name = nameRaw.replace(/([a-z])([A-Z])/g, "$1 $2").trim();

  const dd = (day ?? 1).toString().padStart(2, "0");
  const mm = month.toString().padStart(2, "0");
  return { race_name, race_date: `${year}-${mm}-${dd}`, is_half };
}

function timeToSeconds(t: string): number | null {
  // Supports "4:35.3", "4:35:01.4", "1:23:45", etc.
  if (!t || t === "--") return null;
  const parts = t.trim().split(":");
  if (parts.length === 1) return parseFloat(parts[0]);
  if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  if (parts.length === 3) {
    return (
      parseFloat(parts[0]) * 3600 +
      parseFloat(parts[1]) * 60 +
      parseFloat(parts[2])
    );
  }
  return null;
}

function parseCsv(content: string): string[][] {
  // Header may contain newlines inside quoted fields ("Distance\nkm").
  // Quick CSV parser: handles quoted fields and embedded commas/newlines.
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"' && content[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cell += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(cell);
        cell = "";
      } else if (c === "\n" || c === "\r") {
        if (cell !== "" || row.length > 0) {
          row.push(cell);
          rows.push(row);
          row = [];
          cell = "";
        }
        if (c === "\r" && content[i + 1] === "\n") i++;
      } else {
        cell += c;
      }
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

interface RaceSummary {
  finish_time_s: number;
  total_distance_km: number;
  longest_split_km: number;
  avg_pace_s_per_km: number;
  avg_hr: number | null;
}

function summarise(rows: string[][]): RaceSummary | null {
  if (rows.length < 2) return null;

  // Header may span multiple lines; column indices vary slightly. Look up by name.
  const header = rows[0].map((h) => h.replace(/\s+/g, " ").trim().toLowerCase());
  const idxCumulTime = header.findIndex((h) => h.startsWith("cumulative"));
  const idxDistance = header.findIndex((h) => h === "distance" || h.startsWith("distance"));
  const idxHR = header.findIndex((h) => h === "avg hr");

  // Garmin appends a final "Summary" row. Skip non-numeric "Laps" rows.
  let totalDist = 0;
  let lastCumul = 0;
  let longest = 0;
  let hrAccum = 0;
  let hrCount = 0;
  for (let r = 1; r < rows.length; r++) {
    const lap = rows[r][0]?.trim();
    if (!lap || isNaN(Number(lap))) continue; // skip "Summary" row
    const dist = Number(rows[r][idxDistance]);
    const cumul = timeToSeconds(rows[r][idxCumulTime] ?? "");
    if (Number.isFinite(dist)) {
      totalDist += dist;
      if (dist > longest) longest = dist;
    }
    if (cumul !== null) lastCumul = cumul;
    const hr = idxHR >= 0 ? Number(rows[r][idxHR]) : NaN;
    if (Number.isFinite(hr) && hr > 0) {
      hrAccum += hr;
      hrCount++;
    }
  }

  if (lastCumul === 0 || totalDist === 0) return null;
  return {
    finish_time_s: Math.round(lastCumul),
    total_distance_km: Math.round(totalDist * 100) / 100,
    longest_split_km: Math.round(longest * 100) / 100,
    avg_pace_s_per_km: Math.round(lastCumul / totalDist),
    avg_hr: hrCount > 0 ? Math.round(hrAccum / hrCount) : null,
  };
}

// -------------------------- main -----------------------------------------

async function main() {
  let files: string[];
  try {
    files = readdirSync(KNOWLEDGE_DIR);
  } catch (e) {
    console.error(`Cannot read ${KNOWLEDGE_DIR}:`, e);
    process.exit(1);
  }

  const userId = await resolveOwnerId();
  console.log(`Owner: ${OWNER_EMAIL} (${userId})`);

  const csvFiles = files.filter((f) => f.toLowerCase().endsWith(".csv"));
  console.log(`Found ${csvFiles.length} CSVs in ${KNOWLEDGE_DIR}`);

  let imported = 0;
  let skipped = 0;
  const halves: string[] = [];

  for (const f of csvFiles) {
    const parsed = parseFilename(f);
    if (!parsed) {
      console.warn(`  skip (filename parse failed): ${f}`);
      skipped++;
      continue;
    }
    if (parsed.is_half) {
      halves.push(`${parsed.race_date} ${parsed.race_name}`);
      continue; // halves go in tune_up_races, not marathons
    }

    const csv = readFileSync(join(KNOWLEDGE_DIR, f), "utf-8");
    const rows = parseCsv(csv);
    const summary = summarise(rows);
    if (!summary) {
      console.warn(`  skip (no summary): ${f}`);
      skipped++;
      continue;
    }

    const row = {
      user_id: userId,
      race_date: parsed.race_date,
      race_name: parsed.race_name,
      finish_time_s: summary.finish_time_s,
      avg_pace_s_per_km: summary.avg_pace_s_per_km,
      longest_run_km: summary.longest_split_km,
      notes: `Imported from ${f} · total distance ${summary.total_distance_km} km · avg HR ${summary.avg_hr ?? "—"}`,
    };

    const { error } = await sb.from("marathons").upsert(row, {
      onConflict: "user_id,race_date,race_name",
    });
    if (error) {
      console.error(`  ERROR ${f}: ${error.message}`);
      skipped++;
    } else {
      console.log(
        `  ✓ ${parsed.race_date}  ${parsed.race_name.padEnd(28)} ` +
          `${formatHMS(summary.finish_time_s)}  (${summary.total_distance_km} km)`,
      );
      imported++;
    }
  }

  console.log();
  console.log(`Done — ${imported} marathons imported, ${skipped} skipped.`);
  if (halves.length) {
    console.log(`Halves found (not imported as marathons): ${halves.length}`);
    halves.forEach((h) => console.log(`  - ${h}`));
  }
}

function formatHMS(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
    : `${m}:${sec.toString().padStart(2, "0")}`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
