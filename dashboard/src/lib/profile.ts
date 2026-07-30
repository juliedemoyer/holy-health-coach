/**
 * Athlete profile constants — height, date of birth, sex.
 *
 * Hydrated at runtime from the RLS-locked `config` row. Never compiled into
 * the bundle.
 *
 * Why: height was a hardcoded literal and date of birth came from
 * VITE_BIRTHDATE. Vite inlines every VITE_-prefixed variable into the client
 * bundle at build time, so both sat as literal strings in a publicly
 * downloadable .js asset. Reading them from Postgres behind
 * `auth.uid() = user_id` means they reach only the signed-in owner.
 *
 * Hydration happens once, in AuthGuard, before any authed page renders.
 * The unauthenticated /public page never hydrates and must never need to:
 * the project guardrail is that age never renders to a public audience.
 *
 * Everything here returns null until hydrated, so a caller that runs early
 * shows an empty state rather than a wrong number.
 */

let birthdateIso: string | null = null;
let heightCm: number | null = null;
let sexValue: "female" | "male" | null = null;

/**
 * Age in whole years, for the unauthenticated /public page.
 *
 * That page ranks vitals into age-group percentiles and derives a fitness age,
 * both of which need a number. It gets the integer from public_pb_age and
 * never the date. Used for computation only: age is never rendered or quoted.
 */
let publicAgeYears: number | null = null;

export interface ProfileRow {
  birthdate: string | null;
  height_cm: number | null;
  sex: string | null;
}

/** Hydrate from the owner's `config` row. Called once, after the session exists. */
export function hydrateProfile(row: ProfileRow | null): void {
  birthdateIso = row?.birthdate ?? null;
  heightCm = row?.height_cm ?? null;
  sexValue = row?.sex === "female" || row?.sex === "male" ? row.sex : null;
}

/**
 * Hydrate the year alone, for the unauthenticated /public page.
 * Never pass a date here: this path is readable by anyone.
 */
export function hydratePublicAge(years: number | null): void {
  publicAgeYears = years;
}

/** True once the profile row has been read. */
export function isProfileHydrated(): boolean {
  return birthdateIso !== null || heightCm !== null;
}

/** Height in cm, or null when unknown. */
export function heightCmOrNull(): number | null {
  return heightCm;
}

/** Sex at birth, relevant to a handful of sports-science reference ranges. */
export function sexOrNull(): "female" | "male" | null {
  return sexValue;
}

// ---- BMI helpers ---------------------------------------------------------

export type BMICategory =
  | "underweight"
  | "healthy"
  | "overweight"
  | "obese";

/**
 * BMI = kg / m². Null when weight or height is unknown. For endurance
 * athletes BMI is a coarse proxy (muscle mass inflates it, low body fat
 * doesn't show up) — the Nutri commentary on the weight tile carries that
 * caveat so the number doesn't read as a verdict.
 */
export function bmi(weightKg: number | null | undefined): number | null {
  if (typeof weightKg !== "number" || !heightCm) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/**
 * WHO categories — the standard framing. Athletes routinely sit at the top
 * of "healthy" or into "overweight" because of muscle; that's not a flag,
 * it's a known BMI limitation.
 */
export function bmiCategory(b: number | null): BMICategory | null {
  if (b === null) return null;
  if (b < 18.5) return "underweight";
  if (b < 25) return "healthy";
  if (b < 30) return "overweight";
  return "obese";
}

export const BMI_CATEGORY_LABEL: Record<BMICategory, string> = {
  underweight: "Below WHO floor",
  healthy: "Healthy weight",
  overweight: "Overweight (WHO)",
  obese: "Obese (WHO)",
};

// ---- Age helpers ---------------------------------------------------------

/**
 * Current age in whole years, or null before hydration.
 *
 * Internal sports-science use only: age-group percentile bands and fitness-age
 * comparisons. It must not be rendered in the UI or quoted to any audience.
 */
export function age(today = new Date()): number | null {
  // Falls back to the published integer on /public, where the date is absent
  // by design. Still computation-only: never render this.
  if (!birthdateIso) return publicAgeYears;

  const dob = new Date(birthdateIso + "T00:00:00");
  let a = today.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    today.getMonth() < dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
  if (beforeBirthday) a -= 1;
  return a;
}

/** Days until the next birthday, or null before hydration. */
export function daysUntilBirthday(today = new Date()): number | null {
  if (!birthdateIso) return null;

  const dob = new Date(birthdateIso + "T00:00:00");
  const next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    next.setFullYear(next.getFullYear() + 1);
  }
  const ms =
    next.getTime() -
    new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}
