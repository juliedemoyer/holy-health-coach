/**
 * The only door between `config/*.json` and the app.
 *
 * Nothing in `src/` should hardcode a race name, a goal time, a body
 * measurement, or a date. It all comes from here, so a fork edits JSON and
 * two env vars and never touches component code.
 *
 * Anything genuinely personal (height, date of birth, sex) is read from env
 * at runtime and only falls back to the example values in `config/athlete.json`.
 * That way a public repo never carries a real person's measurements.
 */

import athlete from "../../../config/athlete.json";
import race from "../../../config/race.json";
import thresholds from "../../../config/thresholds.json";
import dnaInsights from "../../../config/dna-insights.json";
import supplements from "../../../config/supplements.json";
import { IS_DEMO } from "./demo";

export const ATHLETE = athlete;
export const RACE = race;

// ── Athlete ────────────────────────────────────────────────────────────────

/** Product name shown in the nav, the sign-in page, and the public page. */
export const APP_NAME = import.meta.env.VITE_APP_NAME || "Holy";

export const ATHLETE_NAME = import.meta.env.VITE_ATHLETE_NAME || athlete.athleteName;
export const COACH_NAME = athlete.coachName;

/** Height in cm, used for the BMI helper. Example fallback, not a real value. */
export const HEIGHT_CM = Number(import.meta.env.VITE_HEIGHT_CM) || athlete.heightCm;

/** ISO date of birth. Example fallback, not a real date. */
export const BIRTHDATE: string = import.meta.env.VITE_BIRTHDATE || athlete.birthdate;

/** Sex at birth. Relevant only to a handful of sports-science reference ranges. */
export const SEX = (import.meta.env.VITE_SEX || athlete.sex) as "female" | "male";

// ── Race ───────────────────────────────────────────────────────────────────

export const RACE_NAME = import.meta.env.VITE_RACE_NAME || race.raceName;
export const RACE_SHORT_NAME = import.meta.env.VITE_RACE_SHORT_NAME || race.raceShortName;
export const RACE_EMOJI = race.raceEmoji;
export const RACE_DISTANCE_KM = race.raceDistanceKm;
export const SESSIONS_GOAL = race.sessionsGoal;
export const BUILD_WEEKS = race.buildWeeks;

/**
 * Demo mode anchors the calendar around today so the dashboard has shape:
 * race day 12 weeks out, build start 8 weeks back, which puts "now" in the
 * middle of the Build phase. Real instances use the config dates as written.
 */
function isoDaysFromNow(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const BUILD_START_ISO = IS_DEMO ? isoDaysFromNow(-56) : race.buildStartDate;

export const THRESHOLDS = thresholds;
export const SUPPLEMENTS = supplements as {
  prioritySource: string;
  priority: Array<{ emoji: string; name: string; detail: string }>;
  generalSource: string;
  general: Array<{ emoji: string; name: string; detail: string }>;
  probiotic: { emoji: string; name: string; detail: string } | null;
};

export const DNA_INSIGHTS = dnaInsights.insights as Array<{ level: "green" | "amber" | "red"; title: string; action: string }>;

export const RACE_DATE = new Date(
  `${IS_DEMO ? isoDaysFromNow(84) : import.meta.env.VITE_RACE_DATE || race.raceDate}T00:00:00Z`,
);
