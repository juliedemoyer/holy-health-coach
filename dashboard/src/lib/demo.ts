/**
 * Demo mode.
 *
 * Append `?demo=1` to any URL and the dashboard runs with no backend:
 * Supabase auth is bypassed, every read is served from
 * `config/demo-data.json`, and every write is dropped. `?demo=0` exits.
 *
 * All numbers in demo mode are invented. They are not anyone's health
 * data, and nothing here should be read as a target or a reference range.
 *
 * The shim below implements only the slice of the Supabase query builder
 * this app actually uses: select / order / limit / gte / eq / in / not /
 * match / maybeSingle / update. It is deliberately small. If you add a
 * query shape, add it here too or demo mode will quietly return nothing.
 */

import demo from "../../../config/demo-data.json";

const FLAG = "holy_demo";

function readFlag(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search).get("demo");
  if (q === "1") {
    try { window.sessionStorage.setItem(FLAG, "1"); } catch { /* ignore */ }
    return true;
  }
  if (q === "0") {
    try { window.sessionStorage.removeItem(FLAG); } catch { /* ignore */ }
    return false;
  }
  try { return window.sessionStorage.getItem(FLAG) === "1"; } catch { return false; }
}

export const IS_DEMO = readFlag();

// ── Synthetic series ───────────────────────────────────────────────────────

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Deterministic pseudo-noise so the charts look organic but never change
 * between reloads. Not random: reproducible demos matter more than variety.
 */
function wobble(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1; // -1..1
}

type Ramp = { start: number; end: number; noise: number };

function series(spec: Ramp, i: number, total: number, seed: number): number {
  const t = total <= 1 ? 1 : i / (total - 1);
  const base = spec.start + (spec.end - spec.start) * t;
  return Math.round((base + wobble(seed + i) * spec.noise) * 10) / 10;
}

function buildScores() {
  const v = demo.vitals;
  const n = v.days;
  const rows = [];
  for (let i = 0; i < n; i++) {
    // i = 0 is the oldest day.
    const date = isoDaysAgo(n - 1 - i);
    rows.push({
      id: `demo-score-${i}`,
      date,
      hrv: Math.round(series(v.hrv, i, n, 1)),
      rhr: Math.round(series(v.restingHr, i, n, 2)),
      sleep_hours: series(v.sleepHours, i, n, 3),
      body_battery: Math.round(series(v.bodyBattery, i, n, 4)),
      vo2max: series(v.vo2max, i, n, 5),
      weight_kg: series(v.weightKg, i, n, 6),
      body_fat_percent: series(v.bodyFatPct, i, n, 7),
      mood: Math.max(1, Math.min(10, Math.round(series(v.mood, i, n, 8)))),
      sleep_score: Math.round(series(v.bodyBattery, i, n, 9)),
      score: Math.round(series(v.bodyBattery, i, n, 10)),
      cycle_day: null,
      cycle_phase: null,
      muscle_mass_kg: null,
      notes: null,
    });
  }
  return rows.reverse(); // newest first, matching the app's usual order
}

const SCORES = buildScores();

const TABLES: Record<string, Array<Record<string, unknown>>> = {
  scores: SCORES,
  check_ins: demo.checkIns.map((c, i) => ({
    id: `demo-checkin-${i}`, date: isoDaysAgo(i), created_at: isoDaysAgo(i), ...c,
  })),
  // Two activities per week across the synthetic window, newest first.
  activities: Array.from({ length: 24 }, (_, i) => {
    const a = demo.activities[i % demo.activities.length];
    return { id: 1000 + i, date: isoDaysAgo(Math.floor(i * 1.7)), created_at: isoDaysAgo(Math.floor(i * 1.7)), ...a };
  }),
  marathons: demo.marathons.map((m, i) => ({ id: `demo-marathon-${i}`, ...m })),
  tune_up_races: demo.tuneUpRaces.map((r, i) => ({
    id: `demo-tuneup-${i}`, ...r, date: isoDaysAgo(-7 * r.weeks_before_race),
  })),
  actions: demo.actions.map((a, i) => ({
    id: `demo-action-${i}`, date: isoDaysAgo(i), created_at: isoDaysAgo(i), resolved_at: null, ...a,
  })),
  meals: [],
  medical: [],
  recipes: [],
  body_photos: [],
  public_pb_agent_notes: demo.agentNotes.map((n) => ({ ...n, updated_at: isoDaysAgo(1) })),
  public_pb_latest_vitals: [SCORES[0]],
  public_pb_strength_weeks: [],
  public_pb_totals: [{ sessions: 41, km: 812, longest_km: 30 }],
  public_pb_weeks: [],
};

// ── Query-builder shim ─────────────────────────────────────────────────────

type Row = Record<string, unknown>;

class DemoQuery implements PromiseLike<{ data: Row[] | Row | null; error: null }> {
  private rows: Row[];
  private single = false;

  constructor(table: string) {
    this.rows = [...(TABLES[table] ?? [])];
  }

  select() { return this; }
  eq(col: string, val: unknown) { this.rows = this.rows.filter((r) => r[col] === val); return this; }
  neq(col: string, val: unknown) { this.rows = this.rows.filter((r) => r[col] !== val); return this; }
  not(col: string, _op: string, val: unknown) { this.rows = this.rows.filter((r) => r[col] !== val); return this; }
  in(col: string, vals: unknown[]) { this.rows = this.rows.filter((r) => vals.includes(r[col])); return this; }
  gte(col: string, val: string | number) { this.rows = this.rows.filter((r) => (r[col] as never) >= (val as never)); return this; }
  lte(col: string, val: string | number) { this.rows = this.rows.filter((r) => (r[col] as never) <= (val as never)); return this; }
  gt(col: string, val: string | number) { this.rows = this.rows.filter((r) => (r[col] as never) > (val as never)); return this; }
  lt(col: string, val: string | number) { this.rows = this.rows.filter((r) => (r[col] as never) < (val as never)); return this; }
  match(spec: Row) {
    this.rows = this.rows.filter((r) => Object.entries(spec).every(([k, v]) => r[k] === v));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    const asc = opts?.ascending ?? true;
    this.rows.sort((a, b) => {
      const x = a[col] as never, y = b[col] as never;
      if (x === y) return 0;
      return (x < y ? -1 : 1) * (asc ? 1 : -1);
    });
    return this;
  }
  limit(n: number) { this.rows = this.rows.slice(0, n); return this; }
  range(from: number, to: number) { this.rows = this.rows.slice(from, to + 1); return this; }
  maybeSingle() { this.single = true; return this; }
  /** Writes are dropped in demo mode. */
  update() { return this; }
  insert() { return this; }
  upsert() { return this; }
  delete() { return this; }

  then<R1 = { data: Row[] | Row | null; error: null }, R2 = never>(
    onfulfilled?: ((v: { data: Row[] | Row | null; error: null }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((r: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    const data = this.single ? (this.rows[0] ?? null) : this.rows;
    return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
  }
}

const DEMO_SESSION = {
  access_token: "demo",
  user: { id: "demo-user", email: "demo@example.com" },
};

/** A stand-in for the Supabase client, covering only what this app calls. */
export const demoClient = {
  from: (table: string) => new DemoQuery(table),
  auth: {
    getSession: async () => ({ data: { session: DEMO_SESSION }, error: null }),
    onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
      queueMicrotask(() => cb("SIGNED_IN", DEMO_SESSION));
      return { data: { subscription: { unsubscribe() {} } } };
    },
    signInWithOtp: async () => ({ data: {}, error: null }),
    signOut: async () => ({ error: null }),
  },
  storage: {
    from: () => ({
      // No images in demo mode. Callers fall back to their empty state.
      createSignedUrl: async () => ({ data: null, error: new Error("demo mode") }),
    }),
  },
} as const;

export const DEMO_ATHLETE_NAME = demo.athlete.displayName;
