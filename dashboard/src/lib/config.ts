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

/**
 * Height, date of birth and sex are NOT here, and must not be.
 *
 * They used to be read from VITE_HEIGHT_CM, VITE_BIRTHDATE and VITE_SEX. Vite
 * inlines every VITE_-prefixed variable into the client bundle at build time,
 * so a real date of birth ended up as a literal string in a publicly
 * downloadable .js asset. Moving them out of `config/athlete.json` and into
 * env vars moved them from the repo into the bundle; it did not make them
 * private, and a deploy-target secret does not either, because the build reads
 * the secret and writes the value into the bundle.
 *
 * They now live in the RLS-locked `config` row and are hydrated at runtime by
 * AuthGuard. See `lib/profile.ts` and migration 0017.
 *
 * The example values in `config/athlete.json` stay as documentation of the
 * shape. They are not read at runtime any more.
 */

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

/**
 * Optional plan-revision banner on the training page. Ships null.
 *
 * Deliberately config-driven: an earlier version hardcoded one athlete's
 * revision note, complete with their HRV and VO2max readings, into the
 * component. Every fork then rendered a stranger's biometrics to its own user.
 */
export const PLAN_REVISION = (race as {
  planRevision?: { date: string; tag: string; body: string } | null;
}).planRevision ?? null;

/**
 * Optional photo strip on the public page. Ships null, so the section hides.
 * The images it points at are gitignored, so a fork starts with nothing to
 * show and no broken frames.
 */
export const PHOTO_STRIP = (race as {
  photoStrip?: {
    eyebrow: string;
    heading: string;
    aside: string;
    caption: string;
    mediaDir: string;
  } | null;
}).photoStrip ?? null;

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
