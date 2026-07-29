// Goal-race countdown, phase logic, and pace helpers.
//
// Everything race-specific comes from config/race.json via lib/config.ts.
// Nothing here knows which race it is.

import { COACH_PLAN } from "./coachPlan";
import {
  RACE,
  RACE_DATE as CONFIGURED_RACE_DATE,
  RACE_NAME as CONFIGURED_RACE_NAME,
  RACE_DISTANCE_KM,
  SESSIONS_GOAL as CONFIGURED_SESSIONS_GOAL,
  BUILD_START_ISO as CONFIGURED_BUILD_START,
  BUILD_WEEKS,
} from "./config";

export const RACE_DATE = CONFIGURED_RACE_DATE;
export const RACE_NAME = CONFIGURED_RACE_NAME;
export const SESSIONS_GOAL = CONFIGURED_SESSIONS_GOAL;

// ── Goal tiers ────────────────────────────────────────────────────────────
// Three tiers, because one target is either too soft to train against or too
// brittle to race against. Coach trains toward the target tier; the A-goal is
// auditioned at tune-up races; the floor is what still counts as a good day.
// The predicted-pace tile shows where fitness actually is; the pace BANDS and
// every marathon-pace cue anchor to GOAL_TARGET, which is where you are aiming.

export type GoalTier = "A" | "Realistic" | "Floor";

export interface RaceGoal {
  tier: GoalTier;
  label: string;       // human label for the chip
  timeLabel: string;   // e.g. "3:40"
  finishSeconds: number;
  mpSecPerKm: number;  // marathon pace implied by the goal
  note: string;        // how Coach treats this tier
}


export const RACE_GOALS: RaceGoal[] = RACE.goals.map((g) => ({
  tier: g.tier as GoalTier,
  label: g.label,
  timeLabel: g.timeLabel,
  finishSeconds: g.finishSeconds,
  mpSecPerKm: Math.round(g.finishSeconds / RACE_DISTANCE_KM),
  note: g.note,
}));

/** The tier Coach actively coaches to — drives every pace band. */
export const GOAL_TARGET: RaceGoal =
  RACE_GOALS.find((g) => g.tier === RACE.targetTier) ?? RACE_GOALS[1];

// Single source of truth for the build start date, from config/race.json.
// SQL migrations reference this as a comment — search "BUILD_START_ISO".
// coachPlan.ts BUILD_START derives from this same date.
export const BUILD_START_ISO = CONFIGURED_BUILD_START;

export type Phase = "Base" | "Build" | "Peak" | "Taper" | "Race week";

export interface RaceStatus {
  today: Date;
  raceName: string;
  daysToRace: number;
  weeksToRace: number;
  phase: Phase;
  phaseProgressPct: number;
}

export function raceStatus(today = new Date()): RaceStatus {
  // Strip time so "days" is calendar-day-accurate
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const r = new Date(
    RACE_DATE.getUTCFullYear(),
    RACE_DATE.getUTCMonth(),
    RACE_DATE.getUTCDate(),
  );
  const days = Math.round((r.getTime() - t.getTime()) / 86_400_000);
  const { phase, pct } = phaseFor(days);
  return {
    today: t,
    raceName: RACE_NAME,
    daysToRace: days,
    weeksToRace: Math.floor(days / 7),
    phase,
    phaseProgressPct: pct,
  };
}

function phaseFor(daysToRace: number): { phase: Phase; pct: number } {
  if (daysToRace <= 7) return { phase: "Race week", pct: 100 };
  if (daysToRace <= 28)
    return { phase: "Taper", pct: round(((28 - daysToRace) / (28 - 7)) * 100) };
  if (daysToRace <= 56)
    return { phase: "Peak", pct: round(((56 - daysToRace) / (56 - 28)) * 100) };
  if (daysToRace <= 112)
    return { phase: "Build", pct: round(((112 - daysToRace) / (112 - 56)) * 100) };
  // Base phase: percent elapsed since build start. Derived from the two
  // configured dates so changing the race never leaves a stale constant here.
  const BASE_START = Math.round(
    (RACE_DATE.getTime() - new Date(`${BUILD_START_ISO}T00:00:00Z`).getTime()) / 86_400_000,
  );
  const basePct = round(Math.max(0, Math.min(100,
    ((BASE_START - daysToRace) / (BASE_START - 112)) * 100,
  )));
  return { phase: "Base", pct: basePct };
}

function round(n: number, d = 1) {
  const k = 10 ** d;
  return Math.round(n * k) / k;
}

/** Build-week (1..BUILD_WEEKS). Returns null outside the window. */
export function buildWeek(today = new Date()): number | null {
  const { daysToRace } = raceStatus(today);
  if (daysToRace < 0 || daysToRace > (BUILD_WEEKS + 1) * 7) return null;
  return Math.max(1, Math.min(BUILD_WEEKS, BUILD_WEEKS + 1 - Math.floor(daysToRace / 7)));
}

/**
 * Long-run opportunities remaining before race day.
 * Convention: 1 long run per weekend (Sat or Sun, picked once per week).
 * Last "real" long run is typically 2 weeks before race day (taper rule).
 *
 * Returns the count of weekends still available for long runs:
 *   - includes the upcoming Sunday if today is Mon-Sat
 *   - excludes race week entirely
 *   - excludes the final taper week (last 14 days)
 */
export function longRunsRemaining(today = new Date()): number {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const r = new Date(
    RACE_DATE.getUTCFullYear(),
    RACE_DATE.getUTCMonth(),
    RACE_DATE.getUTCDate(),
  );
  // Last viable long run = 2 weeks before race
  const lastLongRunDate = new Date(r);
  lastLongRunDate.setDate(r.getDate() - 14);

  if (t > lastLongRunDate) return 0;

  let count = 0;
  // Walk forward from the next Sunday
  const cursor = new Date(t);
  // Move cursor to next Sunday (or stay if today is Sunday)
  const daysUntilSunday = (7 - cursor.getDay()) % 7;
  cursor.setDate(cursor.getDate() + daysUntilSunday);

  while (cursor <= lastLongRunDate) {
    count++;
    cursor.setDate(cursor.getDate() + 7);
  }
  return count;
}

export function formatPace(secondsPerKm: number | null | undefined) {
  if (!secondsPerKm) return "—";
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}/km`;
}

export function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Expected weekly km for build week 1..21, derived from Coach's actual plan
 * (COACH_PLAN in coachPlan.ts) so /public always matches /training. Was a
 * hardcoded array that drifted from the plan through the July revisions.
 */
export function expectedWeeklyKm(weekNum: number): number | null {
  if (weekNum < 1 || weekNum > COACH_PLAN.length) return null;
  return COACH_PLAN[weekNum - 1].weeklyKm;
}

/** Mind's daily mental cue, anchored to days-to-race. */
export function dailyRaceCue(daysToRace: number): string {
  if (daysToRace <= 0) return "Race day. The work is done. Now run.";
  if (daysToRace <= 1) return "Tomorrow. Nothing to prove. You've earned this.";
  if (daysToRace <= 3) return "Race week. Sleep is the lever. Trust the taper.";
  if (daysToRace <= 7) return "Final week. The hay is in the barn.";
  if (daysToRace <= 14) return "Taper. Restless is normal. Resist over-doing.";
  if (daysToRace <= 28) return "Peak banked. Begin the descent. Sharpen, don't strain.";
  if (daysToRace <= 56) return "Peak phase. The work that defines race day.";
  if (daysToRace <= 84) return "Build phase. Add quality. Practice race fuel.";
  if (daysToRace <= 112) return "Trust the build. Volume before speed.";
  if (daysToRace <= 140) return "Base phase. Steady accumulation wins marathons.";
  return "Build the base. Long arc, small consistent steps.";
}
