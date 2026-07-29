/**
 * Per-metric insight engine.
 *
 * Every threshold comes from `config/thresholds.json`. Nothing in this file
 * knows anyone's actual numbers, and nothing here is medical advice: it
 * renders your own data against cuts you chose.
 *
 * Design notes worth keeping:
 *   - The comparator is the rolling prior 7 days, EXCLUDING today. Including
 *     today contaminates the baseline as the day progresses.
 *   - Sleep is coloured by device sleep score when one is available, and
 *     falls back to hour thresholds. A hard 8h cut flags too much.
 *   - All breach-based insights use the same prior-7d comparator.
 */

import type { Database } from "@/types/db";
import type { AgentKey } from "@/components/AgentAvatar";
import { THRESHOLDS } from "./config";

export type Score = Database["public"]["Tables"]["scores"]["Row"];

// Overnight HRV band. Derive yours from your own trailing distribution.
export const HRV_BASE_LOW = THRESHOLDS.hrv.baselineLow;
export const HRV_BASE_HIGH = THRESHOLDS.hrv.baselineHigh;

// Resting HR preferred zone.
export const RHR_GOOD_LOW = THRESHOLDS.restingHeartRate.goodLow;
export const RHR_GOOD_HIGH = THRESHOLDS.restingHeartRate.goodHigh;

// Sleep colour cuts.
export const SLEEP_GOOD_HOURS = THRESHOLDS.sleep.goodHours;
export const SLEEP_AMBER_HOURS = THRESHOLDS.sleep.amberHours;
export const SLEEP_HARD_TARGET = THRESHOLDS.sleep.hardTargetHours;

// Device readiness score floor.
export const BB_GOOD_FLOOR = THRESHOLDS.bodyBattery.goodFloor;

// Estimated VO2max floor.
export const VO2_GOOD_FLOOR = THRESHOLDS.vo2max.goodFloor;

// Body-fat anchor for the "vs build start" comparison. Null means compare
// against the first logged value instead of a pinned baseline.
export const BODY_FAT_BUILD_START: number | null =
  THRESHOLDS.bodyComposition.buildStartBodyFatPct;

export interface Insight {
  agent: AgentKey;
  tone: "good" | "watch" | "bad" | "neutral";
  title: string;
  body: string;
  context?: string;
}

// ---------- helpers --------------------------------------------------------

function avg(values: (number | null | undefined)[]): number | null {
  const xs = values.filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Average of the **prior** 7 days (excluding today). Take rows ordered
 * ascending by date; compute mean of the last 7 *before* the most recent.
 */
export function prior7dAvg(rows: Score[], field: keyof Score): number | null {
  if (rows.length < 2) return null;
  const slice = rows.slice(-8, -1); // last 7 before today
  return avg(slice.map((r) => r[field] as number | null | undefined));
}

export function todaysValue(rows: Score[], field: keyof Score): number | null {
  if (!rows.length) return null;
  const v = rows[rows.length - 1][field];
  return typeof v === "number" ? v : null;
}

/** Most recent non-null (used for sparse metrics like VO₂max). */
export function mostRecent(rows: Score[], field: keyof Score): number | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = rows[i][field];
    if (typeof v === "number") return v;
  }
  return null;
}

export interface Comparison {
  current: number | null;
  prior7d: number | null;
  diff: number | null;          // absolute current - prior7d
  direction: "up" | "down" | "flat" | "n/a";
}

export function compare(rows: Score[], field: keyof Score): Comparison {
  const current = todaysValue(rows, field) ?? mostRecent(rows, field);
  const prior7d = prior7dAvg(rows, field);
  const diff = current !== null && prior7d !== null ? current - prior7d : null;
  let direction: Comparison["direction"] = "n/a";
  if (diff !== null) {
    if (Math.abs(diff) < 0.05) direction = "flat";
    else if (diff > 0) direction = "up";
    else direction = "down";
  }
  return { current, prior7d, diff, direction };
}

/**
 * Average of the FIRST 7 days of data in `rows` — the build-start baseline.
 * `rows` is expected to be the since-build-start window (ascending by date),
 * so rows[0..6] is the opening week of the build (~1 May 2026).
 */
export function buildStartAvg(rows: Score[], field: keyof Score): number | null {
  if (!rows.length) return null;
  return avg(rows.slice(0, 7).map((r) => r[field] as number | null | undefined));
}

/**
 * Compare today's value against the build-start baseline (first 7 days of
 * the window). Shape mirrors `compare()` so ExecSummary can swap it in
 * directly — the `prior7d` field carries the build-start baseline value.
 */
export function compareSinceBuildStart(
  rows: Score[],
  field: keyof Score,
  /** Pin the build-start baseline to a known value instead of averaging the
   *  opening week. Used for metrics (e.g. body fat) where early readings are
   *  sparse but the true starting point is known. */
  fixedBaseline?: number,
): Comparison {
  const current = todaysValue(rows, field) ?? mostRecent(rows, field);
  const baseline = fixedBaseline ?? buildStartAvg(rows, field);
  const diff = current !== null && baseline !== null ? current - baseline : null;
  let direction: Comparison["direction"] = "n/a";
  if (diff !== null) {
    if (Math.abs(diff) < 0.05) direction = "flat";
    else if (diff > 0) direction = "up";
    else direction = "down";
  }
  return { current, prior7d: baseline, diff, direction };
}

/** Multi-day rolling breach detector — Doc's "3-of-5 rule". */
export function rollingBreach(
  rows: Score[],
  field: keyof Score,
  predicate: (v: number) => boolean,
  windowDays = 5,
  minHits = 3,
): boolean {
  const slice = rows.slice(-windowDays);
  let hits = 0;
  for (const r of slice) {
    const v = r[field];
    if (typeof v === "number" && predicate(v)) hits++;
  }
  return hits >= minHits;
}

// ---------- per-metric insight generators ----------------------------------

export function hrvInsight(rows: Score[]): Insight | null {
  const today = todaysValue(rows, "hrv");
  if (today === null) return null;
  const prior = prior7dAvg(rows, "hrv");
  const sustained = rollingBreach(rows, "hrv", (v) => v < HRV_BASE_LOW);

  if (today < HRV_BASE_LOW) {
    return {
      agent: "doc",
      tone: sustained || today < HRV_BASE_LOW - 10 ? "bad" : "watch",
      title: `HRV ${Math.round(today)} ms — below your ${HRV_BASE_LOW}–${HRV_BASE_HIGH} band`,
      body: sustained
        ? `Three-of-five-day rolling breach. That's not noise. Common drivers: late food, alcohol, illness, accumulated training load. If RHR is also up, ease today and consider a GP visit if it persists 5+ more days.`
        : `One-day dip — could be a late dinner or a stressful day. Watch the next 48h alongside RHR; flag only if it stays under ${HRV_BASE_LOW} for 3 of 5 days.`,
      context: "vs personal baseline",
    };
  }
  if (today >= HRV_BASE_HIGH) {
    return {
      agent: "coach",
      tone: "good",
      title: `HRV ${Math.round(today)} ms — top of your range`,
      body: prior
        ? `Prior 7d avg ${Math.round(prior)} ms. If today's plan calls for quality work, this is the green light.`
        : `Body says yes. Don't waste it.`,
      context: "peak recovery",
    };
  }
  return {
    agent: "coach",
    tone: "good",
    title: `HRV ${Math.round(today)} ms — in your sweet spot`,
    body: prior
      ? `Prior 7d ${Math.round(prior)} ms. Standard training day; no recovery flags.`
      : `Sitting in the ${HRV_BASE_LOW}–${HRV_BASE_HIGH} band. No flags.`,
  };
}

export function rhrInsight(rows: Score[]): Insight | null {
  const today = todaysValue(rows, "rhr");
  if (today === null) return null;
  const sustained = rollingBreach(rows, "rhr", (v) => v > RHR_GOOD_HIGH);

  if (today > RHR_GOOD_HIGH) {
    return {
      agent: "doc",
      tone: sustained || today > RHR_GOOD_HIGH + 5 ? "bad" : "watch",
      title: `Resting HR ${Math.round(today)} bpm — above your ${RHR_GOOD_LOW}–${RHR_GOOD_HIGH} window`,
      body: sustained
        ? `Three-of-five-day rolling rise. Classic overreaching, illness, or alcohol pattern. If HRV is also down today, deload + book a check-up if it persists.`
        : `Today only — likely fatigue or short sleep. If both HRV and RHR are off tomorrow, take it easy.`,
      context: "elevated",
    };
  }
  return {
    agent: "doc",
    tone: "good",
    title: `Resting HR ${Math.round(today)} bpm — in fit-athlete range`,
    body: `Cardiovascular system well-recovered. Where it should be for you.`,
  };
}

export function sleepInsight(rows: Score[]): Insight | null {
  const today = todaysValue(rows, "sleep_hours");
  if (today === null) return null;
  const prior = prior7dAvg(rows, "sleep_hours");

  if (today < SLEEP_AMBER_HOURS) {
    return {
      agent: "doc",
      tone: "bad",
      title: `Slept ${today.toFixed(1)}h — short`,
      body: prior && prior < SLEEP_GOOD_HOURS
        ? `Running on ${prior.toFixed(1)}h average over prior week. Sleep debt accumulates fast in a build. Hit ${SLEEP_HARD_TARGET}h tonight, even if it means dropping the morning workout.`
        : `One short night isn't a problem; a streak is. Hit ${SLEEP_HARD_TARGET}h tonight to rebound.`,
      context: "short night",
    };
  }
  if (today < SLEEP_GOOD_HOURS) {
    return {
      agent: "coach",
      tone: "watch",
      title: `Slept ${today.toFixed(1)}h — borderline`,
      body: `Below the ${SLEEP_GOOD_HOURS}h floor. Aim for ${SLEEP_HARD_TARGET}h tonight.`,
    };
  }
  return {
    agent: "coach",
    tone: "good",
    title: `Slept ${today.toFixed(1)}h — recovered`,
    body: prior
      ? `Prior 7d avg ${prior.toFixed(1)}h. Recovery's covered.`
      : `Nothing to fix on the sleep front.`,
  };
}

export function weightInsight(rows: Score[]): Insight | null {
  const today = todaysValue(rows, "weight_kg");
  if (today === null) {
    const messages = [
      "No weight today. The scale isn't going to step on itself, ma chérie. 30 seconds, no judgement, just a number for the trend.",
      "Skipped the weigh-in — fine for one day. But two empty days in a row and the trend gets uglier than necessary.",
      "Pas de chiffre aujourd'hui? Trends only work with data. Step on, log it, move on. We never coach to a single day's number anyway.",
    ];
    const idx = new Date().getDate() % messages.length;
    return {
      agent: "nutri",
      tone: "neutral",
      title: "No weight logged",
      body: messages[idx],
      context: "missing",
    };
  }

  const rolling = prior7dAvg(rows, "weight_kg");
  const arrow = rolling === null ? "" : today > rolling + 0.1 ? "↗" : today < rolling - 0.1 ? "↘" : "→";
  const diff = rolling !== null ? today - rolling : null;

  return {
    agent: "nutri",
    tone: "neutral",
    title: rolling !== null
      ? `${today.toFixed(1)} kg · ${rolling.toFixed(1)} kg 7d avg · ${arrow} ${diff !== null ? (diff >= 0 ? "+" : "") + diff.toFixed(1) : ""}`
      : `${today.toFixed(1)} kg today`,
    body: `Trend is what matters during a build. Daily swings are water + glycogen. Keep fuelling the work.`,
  };
}

export function bodyBatteryInsight(rows: Score[]): Insight | null {
  const today = todaysValue(rows, "body_battery");
  if (today === null) return null;

  if (today < BB_GOOD_FLOOR) {
    const yesterdaySleep = rows[rows.length - 1]?.sleep_hours;
    return {
      agent: "coach",
      tone: today < 60 ? "bad" : "watch",
      title: `Body Battery peaked at ${Math.round(today)} — below the ${BB_GOOD_FLOOR} floor`,
      body: yesterdaySleep && yesterdaySleep < SLEEP_GOOD_HOURS
        ? `Yesterday's ${yesterdaySleep.toFixed(1)}h sleep is the obvious culprit. BB floor follows sleep almost 1:1. Tonight: aim for ${SLEEP_HARD_TARGET}.5h.`
        : `Battery never charged fully — could be late food, alcohol, screens, or carry-over training stress. Look at sleep score (not just hours) tonight.`,
      context: "low recharge",
    };
  }
  return {
    agent: "coach",
    tone: "good",
    title: `Body Battery ${Math.round(today)} — fully charged`,
    body: `Plenty in the tank. Train hard if the plan calls for it.`,
  };
}

export function vo2Insight(rows: Score[]): Insight | null {
  const today = mostRecent(rows, "vo2max");
  if (today === null) return null;
  if (today >= VO2_GOOD_FLOOR) {
    return {
      agent: "coach",
      tone: "good",
      title: `VO₂max ${today.toFixed(1)} — marathon-grade`,
      body: `Above the ${VO2_GOOD_FLOOR} floor. The ceiling is met by training quality, not by chasing VO₂ for its own sake.`,
    };
  }
  return {
    agent: "coach",
    tone: "watch",
    title: `VO₂max ${today.toFixed(1)} — building back`,
    body: `Below the ${VO2_GOOD_FLOOR} floor for now. VO₂ rises with consistent threshold + interval work. The training build will lift this; don't chase it directly.`,
  };
}

/** Rolling-window illness composite — Doc's "pre-viral pattern" (RHR↑ + HRV↓ + sleep↓ in 48h). */
export function illnessInsight(rows: Score[]): Insight | null {
  if (rows.length < 8) return null;
  const baselineHrv = prior7dAvg(rows, "hrv");
  const baselineRhr = prior7dAvg(rows, "rhr");
  if (baselineHrv === null || baselineRhr === null) return null;

  const last2 = rows.slice(-2);
  const recentHrv = avg(last2.map((r) => r.hrv));
  const recentRhr = avg(last2.map((r) => r.rhr));
  const recentSleep = avg(last2.map((r) => r.sleep_hours));
  if (recentHrv === null || recentRhr === null) return null;

  const hrvDownPct = ((recentHrv - baselineHrv) / baselineHrv) * 100;
  const rhrUp = recentRhr - baselineRhr;
  const sleepShort = recentSleep !== null && recentSleep < 7;

  if (hrvDownPct <= -15 && rhrUp >= 7 && sleepShort) {
    return {
      agent: "doc",
      tone: "bad",
      title: "Pre-viral pattern — RHR up, HRV down, sleep short over 48h",
      body: `Classic three-signal cluster suggesting your body's fighting something. Take an easy day, log temperature if any, and contact your GP if symptoms appear. Don't push training until at least one of the three normalises.`,
      context: "illness watch",
    };
  }
  return null;
}

/** Build the deck — illness first if present, then per-metric, sorted by tone. */
export function buildInsights(rows: Score[]): Insight[] {
  const generators = [
    illnessInsight,
    hrvInsight,
    rhrInsight,
    sleepInsight,
    bodyBatteryInsight,
    vo2Insight,
    weightInsight,
  ];
  const all = generators.map((g) => g(rows)).filter((i): i is Insight => i !== null);
  const order = { bad: 0, watch: 1, good: 2, neutral: 3 } as const;
  return all.sort((a, b) => order[a.tone] - order[b.tone]);
}

// Backwards-compat alias for existing callers
export { compare as computeDelta };
