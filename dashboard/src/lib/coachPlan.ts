/**
 * Coach's goal-race build plan — 20 weeks.
 *
 * Single source of truth for the plan-vs-actual visualisations on /training.
 * This is a generic 20-week marathon build. It is an example, not a
 * prescription: rewrite the weeks for your own athlete and your own race.
 *
 * Build start and race day both come from config/race.json.
 *
 * Each week has:
 *   - target weekly km
 *   - target long-run km
 *   - phase classification
 *   - one-line note (the Coach's reasoning; surfaced as a per-week note)
 *
 * Tweak: Coach reviews this every 4 weeks; the constant gets edited and
 * shipped. (No DB write path — keeping the source of truth in code keeps
 * the plan visible and version-controlled.)
 */

import { BUILD_START_ISO, RACE_DATE as CONFIGURED_RACE_DATE } from "./config";

export type Phase = "Base" | "Build" | "Peak" | "Taper" | "Race";

/** Type of training stress for a single session. */
export type SessionKind = "easy" | "tempo" | "interval" | "long" | "mp" | "strides" | "hyrox" | "shakeout";

export interface Session {
  kind: SessionKind;
  km: number;
  /** 0 = Mon, 1 = Tue, … 6 = Sun (used to map plan to days of the week). */
  dayOfWeek: number;
  label: string;
}

export interface PlanWeek {
  weekIdx: number;          // 1..21
  weekStart: string;        // ISO Friday of that week (build anchors Fri 1 May)
  phase: Phase;
  weeklyKm: number;
  longRunKm: number;
  /** Coach's note for the week — what to focus on / what to expect. */
  note: string;
  /** Whether this week's long run includes marathon-pace work. */
  mpSegment?: boolean;
  /** Whether this is a planned cutback / deload week. */
  cutback?: boolean;
}

/** A travel window that affects training scheduling. */
export interface TravelBlock {
  /** ISO YYYY-MM-DD, inclusive — first day running in the travel location. */
  startDate: string;
  /** ISO YYYY-MM-DD, inclusive — last day running in the travel location. */
  endDate: string;
  /** Short display label shown as a pill, e.g. "Work trip ✈️". */
  label: string;
  /** Optional Coach note surfaced as a tooltip. */
  note?: string;
}

/**
 * Known travel blocks that affect the training plan. Two illustrative
 * examples; replace them with your own trips as they get confirmed.
 *
 * Keep it to the shape of a trip (dates, a label, how it changes training).
 * Resist the urge to put why you were there.
 */
export const TRAVEL_BLOCKS: TravelBlock[] = [
  {
    startDate: "2027-06-07",
    endDate: "2027-06-11",
    label: "Work trip \u2708\ufe0f",
    note: "Long-haul: jet-lag protocol active, sessions moved to hotel or outdoor running",
  },
  {
    startDate: "2027-07-19",
    endDate: "2027-08-08",
    label: "Summer \ud83c\udfd6\ufe0f",
    note: "Running only, no cross-training equipment. Volume holds, intensity drops",
  },
];

/** Return the travel block containing a given ISO date, or null. */
export function travelBlockFor(dateIso: string): TravelBlock | null {
  for (const b of TRAVEL_BLOCKS) {
    if (dateIso >= b.startDate && dateIso <= b.endDate) return b;
  }
  return null;
}

/** Return all distinct travel blocks overlapping any day in the given plan week. */
export function weekHasTravel(week: PlanWeek): TravelBlock[] {
  const start = new Date(week.weekStart + "T00:00:00Z");
  const seen = new Set<string>();
  const out: TravelBlock[] = [];
  for (let d = 0; d < 7; d++) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + d);
    const block = travelBlockFor(day.toISOString().slice(0, 10));
    if (block && !seen.has(block.label)) {
      seen.add(block.label);
      out.push(block);
    }
  }
  return out;
}

// Build runs Mon 4 May 2026 → Sun 27 Sept 2026 (21 Mon-Sun weeks; race day
// is Sunday of Wk 21). Mon-Sun anchoring matches the standard runner week
// (long run on Sunday closes the week). The 100-session tracker on /
// counts from Fri 1 May separately — it has its own date filter and
// includes any pre-build runs that landed in the May 1–3 transition window.
// Both come from config/race.json (via lib/config), so a fork edits JSON and
// nothing here. Imported from ./config rather than ./race because race.ts
// imports this module, and the other direction would be a cycle.
//
// The week grid assumes buildStartDate is a Monday and raceDate the Sunday
// that closes the final week. The shipped example config satisfies both.
export const BUILD_START = new Date(`${BUILD_START_ISO}T00:00:00Z`);
export const RACE_DAY = CONFIGURED_RACE_DATE;

function mondayOfWeek(idx: number): string {
  const d = new Date(BUILD_START);
  d.setUTCDate(d.getUTCDate() + (idx - 1) * 7);
  return d.toISOString().slice(0, 10);
}

const RAW: Array<Omit<PlanWeek, "weekStart">> = [
  // Base (1–6): rebuild volume from base
  { weekIdx: 1,  phase: "Base",  weeklyKm: 45, longRunKm: 18, note: "Welcome back to the build. Easy paces only — let the legs ease in." },
  { weekIdx: 2,  phase: "Base",  weeklyKm: 50, longRunKm: 20, note: "Add 5 km to weekly volume. Long run climbs to 20 km." },
  { weekIdx: 3,  phase: "Base",  weeklyKm: 52, longRunKm: 22, note: "Strides 6×100m on Monday — wake the fast-twitch fibres up. Saturday is a rest day." },
  { weekIdx: 4,  phase: "Base",  weeklyKm: 48, longRunKm: 18, cutback: true, note: "Cutback week. Lower volume so adaptation banks." },
  { weekIdx: 5,  phase: "Base",  weeklyKm: 55, longRunKm: 23, note: "First tempo session — 3×8 min @ threshold." },
  { weekIdx: 6,  phase: "Base",  weeklyKm: 55, longRunKm: 24, note: "Top of base. Travel week: 55 km is the realistic target. Long run moved to Saturday." },
  // Build (7–12): add quality, marathon-pace appears
  { weekIdx: 7,  phase: "Build", weeklyKm: 62, longRunKm: 26, note: "Build phase opens. Long run with last 5 km @ MP." },
  { weekIdx: 8,  phase: "Build", weeklyKm: 65, longRunKm: 27, mpSegment: true, note: "10 km @ MP inside the long run on Sunday." },
  { weekIdx: 9,  phase: "Build", weeklyKm: 68, longRunKm: 28, note: "Threshold session — 5×6 min." },
  // Weeks 10 to 12 are a worked example of the plan bending rather than
  // breaking. A stretch of disrupted weeks (life load plus one long run
  // abandoned to heat) collapsed volume, while the recovery markers stayed
  // healthy. That combination calls for a re-entry ramp, not an injury
  // rebuild: cut the cutback week hard, rebuild in two controlled steps, and
  // lower the peak-volume cap rather than trying to win the lost kilometres
  // back. Consistency beats peak volume, and a plan that is defended against
  // what actually happened is just a guilt generator.
  //
  // Later weeks show the opposite adjustment. A travel block with good sleep
  // and no gym access is a chance to add easy volume, so rest days become slow
  // recovery runs and the cap goes up for one peak week only. The guardrail
  // matters more than the number: every added kilometre is recovery pace, and
  // those runs are the first thing dropped at the first niggle.
  //
  // Replace this whole array with your own block. Keep the notes about
  // training decisions, and keep your biometric readings out of them: this
  // file is compiled into the client bundle.
  { weekIdx: 10, phase: "Build", weeklyKm: 25, longRunKm: 14, cutback: true, note: "Reset week. Easy running only, cross-training counts. Gentle 14 km reintroduction long run, no watch pressure." },
  { weekIdx: 11, phase: "Build", weeklyKm: 54, longRunKm: 18, note: "Rebuild 1, built around a 10 km test at the end of the week (A-goal audition). Long run pulled midweek so the legs are fresh to race. Cross-training dropped: nothing hard before a test. Everything easy Z2 except the test itself." },
  { weekIdx: 12, phase: "Build", weeklyKm: 52, longRunKm: 24, note: "Rebuild 2. Optional 10 km tune-up as a rust-buster at controlled effort — only if energy is genuinely back." },
  { weekIdx: 13, phase: "Build", weeklyKm: 65, longRunKm: 26, mpSegment: true, note: "Build resumes. Long run with last 5 km @ MP. Weekly speed block starts: at least one VO₂ session per week, Yasso 800s every Monday through Peak." },
  { weekIdx: 14, phase: "Build", weeklyKm: 71, longRunKm: 28, mpSegment: true, note: "10 km time trial to open the week: the A-goal audition, rescheduled after the disrupted block. Long run drops its MP segment (the TT covers intensity); keep the fuel-cadence rehearsal." },
  // Peak (15–18): highest load, longest runs, race-rehearsal
  { weekIdx: 15, phase: "Peak",  weeklyKm: 57, longRunKm: 22, cutback: true, note: "Cutback — protect the adaptation before the two biggest weeks. Light Yasso dose + Fri recovery 5 km stay in." },
  { weekIdx: 16, phase: "Peak",  weeklyKm: 75, longRunKm: 32, mpSegment: true, note: "Biggest week of the build: 32 km long run (last 12 km @ MP) at the new 75 km cap." },
  { weekIdx: 17, phase: "Peak",  weeklyKm: 66, longRunKm: 30, note: "Half-marathon tune-up race — pace check, gel cadence rehearsal. This audition sets the goal tier." },
  { weekIdx: 18, phase: "Peak",  weeklyKm: 68, longRunKm: 30, mpSegment: true, note: "Last big one: 30 km with 10 km @ MP. Full race-rehearsal — kit, race-morning oats, fuel cadence." },
  // Taper (19–20): drop volume, hold intensity, sleep is the lever
  { weekIdx: 19, phase: "Taper", weeklyKm: 55, longRunKm: 24, note: "Taper week 1. Volume drops 25%; intensity stays." },
  { weekIdx: 20, phase: "Taper", weeklyKm: 40, longRunKm: 16, note: "Taper week 2. -40% volume. Sleep target +30 min/night." },
  { weekIdx: 21, phase: "Race",  weeklyKm: 22, longRunKm: 0,  note: "Race week. Easy shake-outs. Carb load Thu/Fri/Sat. Race Sun 27 Sept." },
];

export const COACH_PLAN: PlanWeek[] = RAW.map((w) => ({
  ...w,
  weekStart: mondayOfWeek(w.weekIdx),
}));

/** Sum across the whole plan. */
export const TOTAL_PLANNED_KM = COACH_PLAN.reduce((s, w) => s + w.weeklyKm, 0);
export const TOTAL_LONG_RUN_KM = COACH_PLAN.reduce((s, w) => s + w.longRunKm, 0);

/**
 * Expand a planned week into a list of individual sessions.
 *
 * We don't hard-code 21 weeks × 5–7 sessions; instead a per-phase template
 * generates a coherent week from `weeklyKm`, `longRunKm`, `cutback`, and
 * `mpSegment`. The result lets us:
 *   - show "still to go this week" in Coach's Read card
 *   - stack the weekly-volume bar chart by session kind
 *
 * Day mapping (an example week — edit expandSessions for your own shape):
 *   Mon: Quality — tempo / interval / strides depending on phase
 *   Tue: Easy 50–60 min recovery run
 *   Wed: LONG RUN (keystone — MP segment when flagged)
 *   Thu: Easy 50 min recovery run
 *   Fri: Hyrox (noon)
 *   Sat: Hyrox (10h)
 *   Sun: Rest or 20–25 min shakeout
 *
 * Hyrox sessions contribute 0 km to the running-volume math (weeklyKm tracks
 * running only). They appear on the calendar/list for completeness.
 */
export function expandSessions(week: PlanWeek): Session[] {
  // Race week — minimal sessions, race day = Sunday
  if (week.phase === "Race") {
    return [
      { kind: "easy",     km: 6,  dayOfWeek: 0, label: "Easy 6 km — shake legs" },
      { kind: "shakeout", km: 4,  dayOfWeek: 2, label: "Shake-out 4 km + 4×100 m strides" },
      { kind: "shakeout", km: 3,  dayOfWeek: 3, label: "Shake-out 3 km" },
      { kind: "long",     km: 42, dayOfWeek: 6, label: "Race day 🏁" },
    ];
  }

  const long: Session = {
    kind: week.mpSegment ? "mp" : "long",
    km: week.longRunKm,
    dayOfWeek: 2, // Wednesday — the keystone day in this example week
    label: week.mpSegment
      ? `Long run with MP segment (${week.longRunKm} km)`
      : `Long run (${week.longRunKm} km)`,
  };

  // Hyrox sessions are constant — Friday noon, Saturday 10h.
  const hyroxSessions: Session[] = [
    { kind: "hyrox", km: 0, dayOfWeek: 4, label: "Hyrox · noon" },
    { kind: "hyrox", km: 0, dayOfWeek: 5, label: "Hyrox · 10h" },
  ];

  const sessions: Session[] = [long, ...hyroxSessions];
  let remaining = Math.max(0, week.weeklyKm - week.longRunKm);

  // Sunday shakeout — small, optional. 3 km when there's room, otherwise rest.
  const shakeoutKm = remaining >= 12 ? 3 : 0;
  if (shakeoutKm > 0) {
    sessions.push({
      kind: "shakeout",
      km: shakeoutKm,
      dayOfWeek: 6,
      label: `Shakeout ${shakeoutKm} km — or rest`,
    });
    remaining -= shakeoutKm;
  }

  // Cutback weeks — skip Monday quality. Distribute remaining across Tue + Thu only.
  if (week.cutback) {
    const each = Math.round((remaining / 2) * 10) / 10;
    sessions.push({ kind: "easy", km: each, dayOfWeek: 1, label: `Easy ${each} km` });
    sessions.push({ kind: "easy", km: each, dayOfWeek: 3, label: `Easy ${each} km recovery` });
    sessions.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    return sessions;
  }

  // Monday quality session by phase.
  let qualityKm = 0;
  if (week.phase === "Base") {
    qualityKm = Math.min(8, Math.round(remaining * 0.18));
    sessions.push({
      kind: "strides",
      km: qualityKm,
      dayOfWeek: 0,
      label: `${qualityKm} km incl. 6×100 m strides`,
    });
    if (week.weekIdx >= 5) {
      const tempoKm = Math.min(8, Math.round(remaining * 0.16));
      sessions.push({
        kind: "tempo",
        km: tempoKm,
        dayOfWeek: 0,
        label: `${tempoKm} km incl. 3×8 min @ threshold`,
      });
      qualityKm += tempoKm;
    }
  } else if (week.phase === "Build") {
    const tempoKm = Math.round(remaining * 0.20);
    sessions.push({
      kind: "tempo",
      km: tempoKm,
      dayOfWeek: 0,
      label: `${tempoKm} km incl. 5×6 min @ threshold`,
    });
    qualityKm = tempoKm;
  } else if (week.phase === "Peak") {
    const intervalKm = Math.round(remaining * 0.20);
    sessions.push({
      kind: "interval",
      km: intervalKm,
      dayOfWeek: 0,
      label: `${intervalKm} km incl. 6×800 m @ VO₂`,
    });
    qualityKm = intervalKm;
  } else if (week.phase === "Taper") {
    const tempoKm = Math.round(remaining * 0.22);
    sessions.push({
      kind: "tempo",
      km: tempoKm,
      dayOfWeek: 0,
      label: `${tempoKm} km incl. 3×6 min @ MP`,
    });
    qualityKm = tempoKm;
  }
  remaining -= qualityKm;

  // Distribute remaining easy km across Tue + Thu.
  const easyDays = [
    { day: 1, label: "Easy" },
    { day: 3, label: "Easy recovery" },
  ];
  const each = Math.round((remaining / easyDays.length) * 10) / 10;
  for (const d of easyDays) {
    sessions.push({
      kind: "easy",
      km: each,
      dayOfWeek: d.day,
      label: `${d.label} ${each} km`,
    });
  }

  sessions.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  return sessions;
}

/**
 * Per-date overrides for when the real week deviates from the parametric
 * template — a group class moves, a rest day is taken, sessions get swapped.
 * Keyed by ISO date (YYYY-MM-DD); an empty array means "rest day, 0 sessions".
 * Coach edits this map as the week's real shape drifts from the plan.
 */
export const SESSION_OVERRIDES: Record<string, Session[]> = {
  // Two illustrative examples of the shape. Replace with your own week as it
  // drifts. Keep them to what happened to the training, not to your calendar:
  // "rest day" is the useful fact, and where you were that day is not.
  //
  // A rest day taken instead of the generated session:
  "2027-05-13": [],
  // A day where the generated session was swapped for something else:
  "2027-05-14": [
    { kind: "easy",  km: 6, dayOfWeek: 4, label: "Easy 6 km — slow Z2" },
    { kind: "hyrox", km: 0, dayOfWeek: 4, label: "Cross-training · group session" },
  ],
};

/**
 * Expand a week's sessions, then substitute any SESSION_OVERRIDES whose date
 * falls inside that week. The generated sessions for an overridden weekday
 * are dropped and the override's sessions spliced in (empty array = rest day).
 */
export function expandSessionsWithOverrides(week: PlanWeek): Session[] {
  const base = expandSessions(week);
  const weekStart = new Date(week.weekStart + "T00:00:00Z");
  let out = [...base];
  for (const [dateIso, override] of Object.entries(SESSION_OVERRIDES)) {
    const d = new Date(dateIso + "T00:00:00Z");
    const dow = Math.floor((d.getTime() - weekStart.getTime()) / 86_400_000);
    if (dow < 0 || dow > 6) continue; // date is not in this week
    out = out.filter((s) => s.dayOfWeek !== dow);
    out.push(...override.map((s) => ({ ...s, dayOfWeek: dow })));
  }
  out.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  return out;
}

/**
 * Classify a Strava activity into one of our session kinds.
 *
 * Heuristics tuned for typical Strava names — ordered by specificity.
 * Falls back to distance-based defaults.
 */
export function classifyActual(act: {
  name: string | null;
  distance_km: number | null;
  type: string | null;
}): SessionKind | null {
  const isRun = (t: string | null | undefined) =>
    !!t && ["run", "trailrun", "virtualrun", "race"].includes(t.toLowerCase());
  if (!isRun(act.type) || !act.distance_km) return null;

  const name = (act.name ?? "").toLowerCase();
  const km = act.distance_km;

  // Specific quality-session patterns first
  if (/\b(tempo|threshold|seuil)\b/.test(name)) return "tempo";
  if (/\b(mp|marathon[\s-]*pace)\b/.test(name)) return "mp";
  if (
    /\b(interval|fartlek|repeat|hill|cote|côte|x\s*\d|\d+\s*x\b|\d+m\b|\d+\s*min)\b/.test(name)
  ) {
    return "interval";
  }
  if (/\b(stride|accel)/.test(name)) return "strides";

  // Distance-based fallback
  if (km >= 14) return "long";
  return "easy";
}

/** Volume per kind across a week. */
export function aggregateByKind(sessions: Session[]): Record<SessionKind, number> {
  const out: Record<SessionKind, number> = {
    easy: 0, tempo: 0, interval: 0, long: 0, mp: 0, strides: 0, hyrox: 0, shakeout: 0,
  };
  for (const s of sessions) out[s.kind] += s.km;
  return out;
}

/** Look up the plan week containing a given date (Monday boundary). */
export function planWeekFor(dateIso: string): PlanWeek | null {
  for (const w of COACH_PLAN) {
    const start = new Date(w.weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const d = new Date(dateIso);
    if (d >= start && d < end) return w;
  }
  return null;
}

/** Per-week actual aggregate, including breakdown by session kind. */
export interface WeeklyActual {
  weeklyKm: number;
  longRunKm: number;
  byKind: Record<SessionKind, number>;
  /** Activities in this week, with their classified kind. */
  activities: Array<{
    date: string;
    name: string | null;
    distance_km: number;
    kind: SessionKind;
  }>;
}

/** Map activity dates → weekly actuals (for plotting alongside the plan). */
export function aggregateActuals(
  activities: Array<{ date: string; distance_km: number | null; type: string | null; name: string | null }>,
): Map<string, WeeklyActual> {
  const out = new Map<string, WeeklyActual>();
  // Per-week per-date sums: lets us treat split-recorded activities (e.g. one
  // long run logged as 3 km + 11 km on the same day) as one day's volume when
  // picking the long run for the long-run progression chart.
  const dayKmByWeek = new Map<string, Map<string, number>>();

  for (const a of activities) {
    const kind = classifyActual(a);
    if (!kind || !a.distance_km) continue;
    const w = planWeekFor(a.date);
    if (!w) continue;
    const existing =
      out.get(w.weekStart) ??
      {
        weeklyKm: 0,
        longRunKm: 0,
        byKind: { easy: 0, tempo: 0, interval: 0, long: 0, mp: 0, strides: 0, hyrox: 0, shakeout: 0 },
        activities: [],
      };
    existing.weeklyKm += a.distance_km;
    existing.byKind[kind] += a.distance_km;
    existing.activities.push({
      date: a.date,
      name: a.name,
      distance_km: a.distance_km,
      kind,
    });
    out.set(w.weekStart, existing);

    const days = dayKmByWeek.get(w.weekStart) ?? new Map<string, number>();
    days.set(a.date, (days.get(a.date) ?? 0) + a.distance_km);
    dayKmByWeek.set(w.weekStart, days);
  }
  // Long run = max single-day total km within the week.
  for (const [weekStart, days] of dayKmByWeek) {
    const maxDayKm = Math.max(...days.values());
    const w = out.get(weekStart);
    if (w) w.longRunKm = maxDayKm;
  }
  // Round to 1 dp
  for (const [k, v] of out) {
    out.set(k, {
      weeklyKm: Math.round(v.weeklyKm * 10) / 10,
      longRunKm: Math.round(v.longRunKm * 10) / 10,
      byKind: Object.fromEntries(
        Object.entries(v.byKind).map(([kk, vv]) => [kk, Math.round(vv * 10) / 10]),
      ) as Record<SessionKind, number>,
      activities: v.activities,
    });
  }
  return out;
}

/**
 * Compute the "still to go this week" view — driven by the calendar, not by
 * fuzzy kind-matching:
 *   - A planned session's day is read off `dayOfWeek` (0 = Mon).
 *   - `done`    — a day that has passed (or is today) AND has a logged run.
 *   - `left`    — today + future days with no run logged yet, priority-ranked.
 *   - `dropped` — past days with no run logged: genuinely missed, never
 *                 resurfaced as "still to go". Coach carries the load forward.
 *
 * This fixes two bugs: a Monday run no longer matches a Thursday easy slot,
 * and a session whose day is already in the past can't sit in "still to go".
 */
export function whatsLeftThisWeek(
  week: PlanWeek,
  actual: WeeklyActual | undefined,
  today: Date = new Date(),
): {
  done: Session[];
  left: Session[];        // today + future, not yet done, priority-ranked
  dropped: Session[];     // past days with nothing logged — missed
  daysLeft: number;
} {
  const planned = expandSessionsWithOverrides(week);
  const weekStart = new Date(week.weekStart + "T00:00:00Z");

  // Today's offset within the plan week (0 = Mon … 6 = Sun).
  const todayUtc = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const todayDow = Math.floor(
    (todayUtc.getTime() - weekStart.getTime()) / 86_400_000,
  );

  // Which weekday offsets actually have a logged run.
  const ranDows = new Set<number>();
  if (actual) {
    for (const a of actual.activities) {
      const d = new Date(a.date + "T00:00:00Z");
      const dow = Math.floor((d.getTime() - weekStart.getTime()) / 86_400_000);
      if (dow >= 0 && dow <= 6) ranDows.add(dow);
    }
  }

  const done: Session[] = [];
  const missed: Session[] = [];
  const upcoming: Session[] = [];
  for (const s of planned) {
    const ran = ranDows.has(s.dayOfWeek);
    if (s.dayOfWeek < todayDow) {
      // Day already passed.
      (ran ? done : missed).push(s);
    } else if (s.dayOfWeek === todayDow) {
      // Today — done if a run is already on the books, else still to do.
      (ran ? done : upcoming).push(s);
    } else {
      // Future day.
      upcoming.push(s);
    }
  }

  // Days left in the plan week — today through Sunday, inclusive.
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  const daysLeft = Math.max(
    0,
    Math.floor((weekEnd.getTime() - todayUtc.getTime()) / 86_400_000) + 1,
  );

  // Rank what's left by priority (long is non-negotiable, shakeout optional).
  const PRIORITY: Record<SessionKind, number> = {
    long: 0, mp: 0,
    tempo: 1, interval: 1,
    hyrox: 2,
    strides: 2,
    easy: 3,
    shakeout: 4,
  };
  const left = [...upcoming].sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind]);

  return { done, left, dropped: missed, daysLeft };
}

/** "Consistency %" — sessions completed / sessions planned. Mind's headline metric.
 *
 * Planned: count actual scheduled run-sessions (excluding hyrox) from
 * `expandSessions(week)` for each fully elapsed week, plus the proportional
 * count for the partial current week (sessions whose dayOfWeek has already
 * passed). Fixes the "5 of 0" bug where week 1 had floor(6 days / 7) = 0
 * weeks elapsed and therefore 0 planned sessions.
 *
 * Completed: count of unique dates with at least one run logged. Same-day
 * split recordings (e.g. 3 km + 11 km) collapse to one completed session.
 */
export function consistencyPct(
  activities: Array<{ date: string; type: string | null }>,
  today = new Date(),
): { completed: number; planned: number; pct: number } {
  const isRun = (t: string | null | undefined) =>
    !!t && ["run", "trailrun", "virtualrun", "race"].includes(t.toLowerCase());

  const dayMs = 86_400_000;
  const daysSinceStart = Math.floor((today.getTime() - BUILD_START.getTime()) / dayMs);
  if (daysSinceStart < 0) return { completed: 0, planned: 0, pct: 0 };

  const weeksFullyElapsed = Math.floor(daysSinceStart / 7);
  const dayInCurrentWeek = daysSinceStart % 7; // 0 = Mon, 6 = Sun

  let planned = 0;
  for (let i = 0; i < weeksFullyElapsed && i < COACH_PLAN.length; i++) {
    planned += expandSessions(COACH_PLAN[i]).filter((s) => s.kind !== "hyrox").length;
  }
  if (weeksFullyElapsed < COACH_PLAN.length) {
    const cur = COACH_PLAN[weeksFullyElapsed];
    planned += expandSessions(cur).filter(
      (s) => s.kind !== "hyrox" && s.dayOfWeek <= dayInCurrentWeek,
    ).length;
  }

  const completedDates = new Set<string>();
  for (const a of activities) {
    if (!isRun(a.type)) continue;
    const d = new Date(a.date);
    if (d >= BUILD_START && d <= today) completedDates.add(a.date);
  }
  const completed = completedDates.size;
  const pct = planned > 0 ? Math.round((completed / planned) * 100) : 0;
  return { completed, planned, pct };
}

/** Acute:Chronic Workload Ratio — Coach's injury-risk number. */
export function acwr(
  activities: Array<{ date: string; distance_km: number | null; type: string | null }>,
  today = new Date(),
): { acute: number; chronic: number; ratio: number; flag: "low" | "ok" | "high" | "n/a" } {
  const isRun = (t: string | null | undefined) =>
    !!t && ["run", "trailrun", "virtualrun", "race"].includes(t.toLowerCase());

  const cutAcute = new Date(today);
  cutAcute.setDate(cutAcute.getDate() - 7);
  const cutChronic = new Date(today);
  cutChronic.setDate(cutChronic.getDate() - 28);

  let acute7 = 0;
  let chronic28 = 0;
  for (const a of activities) {
    if (!isRun(a.type) || !a.distance_km) continue;
    const d = new Date(a.date);
    if (d >= cutAcute && d <= today) acute7 += a.distance_km;
    if (d >= cutChronic && d <= today) chronic28 += a.distance_km;
  }
  const acuteAvg = acute7 / 7;
  const chronicAvg = chronic28 / 28;
  const ratio = chronicAvg > 0 ? acuteAvg / chronicAvg : 0;
  let flag: "low" | "ok" | "high" | "n/a" = "n/a";
  if (chronic28 < 10) flag = "n/a";
  else if (ratio < 0.8) flag = "low";
  else if (ratio > 1.3) flag = "high";
  else flag = "ok";
  return {
    acute: Math.round(acute7 * 10) / 10,
    chronic: Math.round(chronic28 / 4 * 10) / 10,  // weekly equivalent
    ratio: Math.round(ratio * 100) / 100,
    flag,
  };
}

/**
 * Race-pace zones from a marathon goal pace (sec/km), with HR ranges
 * if a max HR is provided. Coach's 4-band card.
 *
 * Pace multipliers tuned to Daniels VDOT for a sub-3:30 marathoner:
 *   - Easy:      1.15–1.25 × MP   (was 1.20–1.30; tightened because the
 *                                  upper end felt unreasonably slow, and the
 *                                  faster half matches typical Z2 pace for
 *                                  her recent HR avg ~141 bpm)
 *   - Marathon:  ~MP
 *   - Threshold: 0.92–0.95 × MP
 *   - VO₂:       0.85–0.88 × MP
 *
 * HR ranges (% of max HR) per Daniels:
 *   - Easy:      65–78%
 *   - Marathon:  79–87%
 *   - Threshold: 87–92%
 *   - VO₂:       92–100%
 */
export function racePaceZones(marathonPaceSecPerKm: number, maxHr?: number) {
  const pace = (lo: number, hi: number) => ({
    paceLow: marathonPaceSecPerKm * lo,
    paceHigh: marathonPaceSecPerKm * hi,
  });
  const hr = (lo: number, hi: number) =>
    maxHr ? { hrLow: Math.round(maxHr * lo), hrHigh: Math.round(maxHr * hi) } : {};
  return {
    easy:      { ...pace(1.15, 1.25), ...hr(0.65, 0.78) },
    marathon:  { ...pace(0.99, 1.01), ...hr(0.79, 0.87) },
    threshold: { ...pace(0.92, 0.95), ...hr(0.87, 0.92) },
    vo2:       { ...pace(0.85, 0.88), ...hr(0.92, 1.00) },
  };
}

/**
 * Estimate max HR from a list of activities. Uses the 95th percentile of
 * `max_hr` rather than the absolute max to avoid sensor spikes. Returns
 * null if there's not enough data.
 */
export function estimateMaxHr(
  activities: Array<{ max_hr: number | null; type: string | null }>,
): number | null {
  const isRun = (t: string | null | undefined) =>
    !!t && ["run", "trailrun", "virtualrun", "race"].includes(t.toLowerCase());
  const hrs = activities
    .filter((a) => isRun(a.type) && typeof a.max_hr === "number" && (a.max_hr ?? 0) > 100)
    .map((a) => a.max_hr as number)
    .sort((a, b) => a - b);
  if (hrs.length < 5) return null;
  const idx = Math.floor(hrs.length * 0.95);
  return hrs[Math.min(idx, hrs.length - 1)];
}
