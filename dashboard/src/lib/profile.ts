/**
 * Athlete profile constants.
 *
 * Height, date of birth and sex are genuinely personal, so they are read from
 * env vars at runtime and only fall back to the example values in
 * `config/athlete.json`. Set VITE_HEIGHT_CM, VITE_BIRTHDATE and VITE_SEX in
 * `.env.local` for dev and in your deploy target's env vars for production.
 * Nothing real about a real person ever needs to sit in committed source.
 *
 * Single-athlete app by design. If you ever coach a second person, promote
 * these to a `profiles` row keyed on auth.uid().
 */

export { HEIGHT_CM, BIRTHDATE, SEX } from "./config";
import { HEIGHT_CM, BIRTHDATE } from "./config";

// ---- BMI helpers ---------------------------------------------------------

export type BMICategory =
  | "underweight"
  | "healthy"
  | "overweight"
  | "obese";

/**
 * BMI = kg / m². Returns null if height isn't configured. For endurance
 * athletes BMI is a coarse proxy (muscle mass inflates it, low body fat
 * doesn't show up) — the Nutri commentary on the weight tile carries that
 * caveat so the number doesn't read as a verdict.
 */
export function bmi(weightKg: number | null | undefined): number | null {
  if (typeof weightKg !== "number" || !HEIGHT_CM) return null;
  const m = HEIGHT_CM / 100;
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

/** Current age in whole years from BIRTHDATE. */
export function age(today = new Date()): number {
  const dob = new Date(BIRTHDATE + "T00:00:00");
  let a = today.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    today.getMonth() < dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
  if (beforeBirthday) a -= 1;
  return a;
}

/** Days until the next birthday. Negative on the birthday itself? No — 0. */
export function daysUntilBirthday(today = new Date()): number {
  const dob = new Date(BIRTHDATE + "T00:00:00");
  const next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    next.setFullYear(next.getFullYear() + 1);
  }
  const ms = next.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}
