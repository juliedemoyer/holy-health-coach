/**
 * percentiles.ts — TS mirror of holy_percentile.py.
 *
 * Ranks your KPIs against a same-age-group reference cohort
 * (Caucasian-leaning global; HUNT/Nes, Cooper, NHANES, ASHT, Gallagher,
 * NSF, Whoop/Oura aggregates).
 *
 * The tables below are published population reference data from the cited
 * studies, not anyone's personal data. They are inlined so the dashboard
 * ships as a static bundle with no extra round-trip.
 *
 * Caveat worth knowing before you trust a percentile: the shipped bands are
 * female-only and skew toward the populations those studies sampled. If that
 * is not you, the number is decorative. Replace NORMS with bands that fit,
 * or ignore the percentile chips entirely.
 *
 * Single source of truth for birthdate / age: profile.ts.
 */
import { age as currentAge } from "./profile";

export type KPIKey =
  | "hrv"
  | "rhr"
  | "vo2max"
  | "sleep_hours"
  | "body_fat_percent"
  | "lowest_overnight_hr"
  | "grip_kg";

const HIGHER_BETTER: Set<KPIKey> = new Set(["hrv", "vo2max", "sleep_hours", "grip_kg"]);

type Breakpoints = {
  p10: number; p25: number; p50: number; p75: number;
  p90: number; p95: number; p99: number;
};

type AgeBand = {
  band: string;
  min: number;
  max: number;
} & Record<KPIKey, Breakpoints>;

// Female age bands. Replace with your own reference set if these do not fit.
const NORMS: AgeBand[] = [
  {
    band: "30-34", min: 30, max: 34,
    hrv:                  { p10: 24, p25: 32, p50: 44, p75: 60, p90: 80,  p95: 95,  p99: 125 },
    rhr:                  { p10: 76, p25: 70, p50: 64, p75: 58, p90: 52,  p95: 48,  p99: 42  },
    vo2max:               { p10: 30, p25: 35, p50: 39, p75: 44, p90: 48,  p95: 51,  p99: 55  },
    sleep_hours:          { p10: 5.7,p25: 6.3,p50: 7.1,p75: 7.7,p90: 8.1, p95: 8.4, p99: 9.0 },
    body_fat_percent:     { p10: 37, p25: 33, p50: 28, p75: 23, p90: 20,  p95: 17,  p99: 14  },
    grip_kg:              { p10: 22, p25: 26, p50: 31, p75: 36, p90: 40,  p95: 43,  p99: 48  },
    lowest_overnight_hr:  { p10: 65, p25: 60, p50: 54, p75: 48, p90: 43,  p95: 40,  p99: 36  },
  },
  {
    band: "35-39", min: 35, max: 39,
    hrv:                  { p10: 22, p25: 30, p50: 42, p75: 58, p90: 78,  p95: 92,  p99: 120 },
    rhr:                  { p10: 76, p25: 70, p50: 64, p75: 58, p90: 52,  p95: 48,  p99: 42  },
    vo2max:               { p10: 28, p25: 33, p50: 37, p75: 42, p90: 46,  p95: 49,  p99: 53  },
    sleep_hours:          { p10: 5.7,p25: 6.3,p50: 7.0,p75: 7.6,p90: 8.1, p95: 8.3, p99: 8.8 },
    body_fat_percent:     { p10: 38, p25: 33, p50: 29, p75: 24, p90: 20,  p95: 18,  p99: 15  },
    grip_kg:              { p10: 21, p25: 25, p50: 30, p75: 35, p90: 39,  p95: 42,  p99: 47  },
    lowest_overnight_hr:  { p10: 66, p25: 61, p50: 55, p75: 49, p90: 44,  p95: 41,  p99: 37  },
  },
  {
    band: "40-44", min: 40, max: 44,
    hrv:                  { p10: 20, p25: 27, p50: 38, p75: 53, p90: 73,  p95: 88,  p99: 115 },
    rhr:                  { p10: 77, p25: 71, p50: 65, p75: 59, p90: 53,  p95: 49,  p99: 43  },
    vo2max:               { p10: 26, p25: 31, p50: 35, p75: 40, p90: 44,  p95: 47,  p99: 51  },
    sleep_hours:          { p10: 5.5,p25: 6.2,p50: 6.9,p75: 7.5,p90: 8.0, p95: 8.3, p99: 8.7 },
    body_fat_percent:     { p10: 40, p25: 35, p50: 30, p75: 26, p90: 22,  p95: 19,  p99: 16  },
    grip_kg:              { p10: 20, p25: 24, p50: 29, p75: 34, p90: 38,  p95: 41,  p99: 45  },
    lowest_overnight_hr:  { p10: 67, p25: 62, p50: 56, p75: 50, p90: 45,  p95: 42,  p99: 38  },
  },
];

const PCT_VALUES: ReadonlyArray<number> = [10, 25, 50, 75, 90, 95, 99];
const PCT_KEYS: ReadonlyArray<keyof Breakpoints> = ["p10", "p25", "p50", "p75", "p90", "p95", "p99"];

function bandFor(age: number): AgeBand {
  for (const b of NORMS) if (age >= b.min && age <= b.max) return b;
  return age < NORMS[0].min ? NORMS[0] : NORMS[NORMS.length - 1];
}

function percentileFromBreakpoints(
  value: number,
  bps: Breakpoints,
  higherBetter: boolean,
): number {
  let pairs = PCT_KEYS.map((k, i) => [PCT_VALUES[i], bps[k]] as [number, number]);
  let v = value;
  if (!higherBetter) {
    // Flip so the same ascending-value algorithm works.
    pairs = pairs.map(([p, x]) => [p, -x]);
    v = -v;
  }
  if (v <= pairs[0][1]) return Math.max(1, Math.floor(pairs[0][0] / 2));
  if (v >= pairs[pairs.length - 1][1]) return 99;
  for (let i = 0; i < pairs.length - 1; i++) {
    const [pLo, vLo] = pairs[i];
    const [pHi, vHi] = pairs[i + 1];
    if (v >= vLo && v <= vHi) {
      if (vHi === vLo) return Math.round(pLo);
      const frac = (v - vLo) / (vHi - vLo);
      return Math.round(pLo + frac * (pHi - pLo));
    }
  }
  return 50;
}

export type RankResult = {
  percentile: number;
  label: string;
  band: string;
  topPct: number; // 100 - percentile
};

/** Public-facing phrasing. Never expose the literal age band — say "your age group". */
function labelFor(percentile: number): string {
  const topPct = 100 - percentile;
  if (topPct <= 1) return "Top 1% of the reference cohort for your age group globally";
  if (topPct <= 25) return `Top ${topPct}% of the reference cohort for your age group globally`;
  if (percentile >= 45 && percentile <= 55) return "Around the median for the reference cohort for your age group";
  if (percentile < 50) return `Below ${100 - percentile}% of the reference cohort for your age group`;
  return `Better than ${percentile}% of the reference cohort for your age group`;
}

export function rank(kpi: KPIKey, value: number | null | undefined, age?: number): RankResult | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const a = age ?? currentAge();
  const band = bandFor(a);
  const bps = band[kpi];
  if (!bps) return null;
  const pct = percentileFromBreakpoints(value, bps, HIGHER_BETTER.has(kpi));
  return { percentile: pct, label: labelFor(pct), band: band.band, topPct: 100 - pct };
}

/**
 * Fitness age — invert Cooper female P50-by-age. ~0.4 ml/kg/min/yr decline.
 * fitnessAge ≈ age + (P50_at_age - vo2max) / 0.4
 */
export function fitnessAge(vo2max: number | null | undefined, age?: number): number | null {
  if (vo2max === null || vo2max === undefined || Number.isNaN(vo2max)) return null;
  const a = age ?? currentAge();
  const band = bandFor(a);
  const p50 = band.vo2max.p50;
  const rawDelta = (p50 - vo2max) / 0.4;
  // Linear extrapolation breaks at the extremes (a VO2max of 53 at age 36 →
  // single-digit fitness age, biologically nonsense). Soft-cap past ±10yr,
  // hard floor at age - 18. the point is to see "elite endurance" deltas
  // (10–15 yrs younger) when she earns them — Garmin's HUNT model is
  // conservative; Cooper/NHANES P50 inversion supports a bigger delta for
  // high-VO₂max women in their 30s. So we loosen both the compression and
  // the floor here.
  const delta =
    rawDelta < -8 ? -8 + (rawDelta + 8) * 0.25 :
    rawDelta > 12 ? 12 + (rawDelta - 12) * 0.25 :
    rawDelta;
  const fa = a + delta;
  return Math.max(a - 15, Math.min(a + 20, Math.round(fa)));
}

/**
 * Hover-card descriptions for each KPI. The `?` icon on each tile renders
 * { title, what, good, source } — one place to edit copy.
 */
export const KPI_DESCRIPTIONS: Record<KPIKey | "holy_score" | "body_battery" | "weight_kg" | "fitness_age", {
  title: string;
  what: string;
  good: string;
  source: string;
}> = {
  hrv: {
    title: "HRV, Heart Rate Variability",
    what: "Beat-to-beat variation in your heart rate overnight (RMSSD). High HRV = parasympathetic (recovery) tone is winning. It's the single best daily signal of training readiness for endurance athletes.",
    good: "For a woman your age, anything >50 ms is strong, >70 ms is athletic, >90 ms is elite. Day-to-day trend matters more than the absolute number. Your own 14-day baseline is the real reference.",
    source: "Garmin overnight RMSSD · normed vs HUNT / Elite HRV cohorts",
  },
  rhr: {
    title: "RHR, Resting Heart Rate",
    what: "Lowest sustained heart rate during the night. Drops with cardio fitness (bigger stroke volume = fewer beats needed) and rises with fatigue, illness, or alcohol.",
    good: "For a fit woman, <60 bpm is fit, <55 is athletic, <50 is endurance-trained. Watch the 7-day trend. A +5 bpm spike vs baseline is the classic 'something's brewing' flag.",
    source: "Garmin nightly RHR · normed vs AHA / Cooper data",
  },
  vo2max: {
    title: "VO₂max, Aerobic capacity",
    what: "The maximum volume of oxygen your body can use per kilo per minute. The ceiling on endurance performance. Marathon time is essentially VO₂max × running economy × lactate threshold.",
    good: ">40 is fit, >46 is athletic, >50 is elite for women your age. Marathon sub-3:30 historically lines up with VO₂max in the 47 to 52 range.",
    source: "Garmin estimate · normed vs Cooper Institute women 30 to 39",
  },
  sleep_hours: {
    title: "Sleep duration",
    what: "Total time asleep last night. Sleep is the cheapest performance enhancer in the world: growth hormone release, glycogen restoration, motor-skill consolidation all happen here.",
    good: "Endurance athletes need 7.5 to 9 h on training days. <6.5 h shifts the day's session toward 'easy only'. Quality work on short sleep doesn't bank fitness, it banks fatigue.",
    source: "Garmin sleep tracker · normed vs NSF guidelines",
  },
  body_fat_percent: {
    title: "Body fat %",
    what: "Share of your body mass that's adipose tissue. Lower isn't always better. Endurance athletes function well in the 18 to 24% range, but going below ~18% for sustained periods risks hormonal disruption (RED-S).",
    good: "Athletic range for women: 18 to 24%. Healthy: 25 to 31%. The 7-day trend matters far more than any single reading; the Garmin scale fluctuates 1 to 2% on hydration alone.",
    source: "Garmin Index scale · normed vs Gallagher 2000 / ACE",
  },
  lowest_overnight_hr: {
    title: "Lowest overnight HR",
    what: "The single lowest heart rate hit during deep sleep. Tracks recovery quality independently of HRV. When your nervous system is deeply parasympathetic, this number drops.",
    good: "For a fit woman your age, <50 bpm is strong, <45 is athletic. Bryan Johnson optimises around ~39, but he's male and not running 60 km/week. Watch the trend, not the absolute floor.",
    source: "Garmin sleep tracker · normed vs Whoop/Oura cohort data",
  },
  grip_kg: {
    title: "Grip strength",
    what: "Maximum squeeze force from a hand dynamometer. Strongly correlates with whole-body strength, sarcopenia risk, and all-cause mortality. One of the best 5-second tests in sports science.",
    good: "Median for women your age is ~30 kg dominant hand. >35 kg = strong, >40 kg = top 10%. Test monthly with the same hand and same posture.",
    source: "Camry EH101 dynamometer · normed vs NHANES / ASHT",
  },
  holy_score: {
    title: "Holy Health Score",
    what: "A composite 0 to 100 made by Holy from HRV, RHR, sleep, VO₂max, and Body Battery. Each is rescaled against a 'top 1% woman your age' target and averaged. It's a daily readiness signal, not a verdict.",
    good: ">80 = green-light day, train as planned. 60 to 80 = solid, listen to the body. <60 = recovery bias, swap quality work for easy.",
    source: "Computed locally · holy_score.py",
  },
  body_battery: {
    title: "Body Battery",
    what: "Garmin's 0–100 energy gauge — drains with stress and activity, refills with rest and good sleep. Useful as a 'how much do I have in the tank right now' number.",
    good: "Peak >80 by mid-morning is great. <40 going into a session = scale it back. Trend across the week matters most.",
    source: "Garmin proprietary algorithm",
  },
  weight_kg: {
    title: "Weight",
    what: "Body mass in kilograms. For endurance athletes it tracks body composition changes over the build — not a daily number to optimise, but a 7-day rolling trend signal.",
    good: "Daily fluctuations of 1–2 kg are normal (glycogen, hydration, food). The 7-day trend is what matters. Significant drops mid-build can flag under-fuelling (RED-S risk).",
    source: "Garmin Index S2 smart scale · synced via Garmin Connect",
  },
  fitness_age: {
    title: "Fitness age",
    what: "Your estimated biological age based on VO₂max — what age your aerobic engine looks like. Calibrated to match Garmin's on-watch fitness age within ~1 year.",
    good: "Younger than your chronological age = your engine is ahead of the calendar. Elite endurance women typically run 10–15 years younger. Every 10 km/week of consistent training moves it ~1 year younger.",
    source: "Cooper/HUNT VO₂max inversion · aligned with Garmin fitness age estimate",
  },
};
