/**
 * sanitizeInterview — strip company / interviewer names from coach text
 * before rendering on any surface (private dashboard + public page).
 *
 * Rule: any text that names a specific company or person in the context of
 * an interview, call, panel, round, or screen is replaced with
 * "important meeting" — regardless of which company it is.
 *
 * What it does NOT touch: agent names (Coach, Nutri, Doc, Mind), days of the
 * week, race/training references, or generic words like "session" / "run".
 */

const SAFE_WORDS = /^(Coach|Nutri|Doc|Mind|Race|Holy|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Race|Base|Build|Peak|Taper)$/i;

function isSafeWord(word: string) {
  return SAFE_WORDS.test(word.replace(/[''s]/g, ""));
}

export function sanitizeInterview(text: string): string {
  let s = text;

  // 1. "[CapWord(s)] [optional modifier] interview[...]"
  //    e.g. "Google interview", "McKinsey final interview", "Stripe technical interview call"
  s = s.replace(
    /\b([A-Z][A-Za-z0-9&'.]{1,}(?:\s+[A-Z][A-Za-z0-9&'.]{1,}){0,3})\s+(?:final\s+|first\s+|second\s+|third\s+|technical\s+|behavioral\s+|culture\s+|initial\s+)?interview\b(?:\s+(?:call|round|day|loop|panel|tomorrow|today|prep|at|with))?/g,
    (_, company) => isSafeWord(company.split(" ")[0]) ? `${company} important meeting` : "important meeting"
  );

  // 2. Any remaining "interview" word
  s = s.replace(/\binterview(?:s|ing)?\b/gi, "important meeting");

  // 3. "[CapWord(s)] call/panel/round/screen/loop/debrief"
  //    e.g. "Google call", "McKinsey panel", "Stripe loop"
  //    But NOT "Coach call", "Mind session", "Race round"
  s = s.replace(
    /\b([A-Z][A-Za-z0-9&'.]{1,}(?:\s+[A-Z][A-Za-z0-9&'.]{1,})?)\s+(?:call|panel|round|screen(?:ing)?|loop|debrief)\b/g,
    (match, company) => isSafeWord(company.split(" ")[0]) ? match : "important meeting"
  );

  return s;
}
