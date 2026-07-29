# Make It Yours

Holy ships configured for a fictional athlete training for a fictional race.
Before your first real run, answer the questions below. Every answer maps to
a field in `config/`, and nothing outside `config/` needs editing.

Read section 5 before you put any real health data anywhere near this.

## 1. Who is being coached? → `config/athlete.json`

| Question | Field | Shipped example |
|---|---|---|
| What should the coach call you? | `athleteName` | `"Alex Rivera"` |
| What do you want to call the coach? | `coachName` | `"Holy"` |
| How do you eat? | `dietaryPattern` | `"pescatarian (fish and eggs and dairy, no meat)"` |
| Which specialists do you want? | `specialists` | Coach, Nutri, Doc, Mind |

`dietaryPattern` is free text and it does real work: it is what stops the
nutrition specialist recommending a steak. Be specific about exclusions,
including the ones that are preferences rather than restrictions.

**Height, date of birth, and sex are deliberately not configured here.** They
are read from `VITE_HEIGHT_CM`, `VITE_BIRTHDATE` and `VITE_SEX` at runtime,
and the values in `athlete.json` are only fallbacks so the demo renders.
Put your real values in `dashboard/.env.local` and in your deploy target's
secrets, never in a committed file. This is a small discipline that costs
nothing and means a public fork never carries anyone's measurements.

Dropping a specialist is a real option. Three well-triggered agents beat four
where one never has anything useful to say.

## 2. What are you training for? → `config/race.json`

| Question | Field | Shipped example |
|---|---|---|
| What race? | `raceName`, `raceShortName` | `"Example City Marathon"` |
| When? | `raceDate` | `"2027-09-26"` (override with `VITE_RACE_DATE`) |
| How long is the build? | `buildStartDate`, `buildWeeks` | 20 weeks |
| How many sessions is the goal? | `sessionsGoal` | `100` |
| What are you actually aiming for? | `goals` | Three tiers |

**The three tiers deserve real thought.** One target is either soft enough
that you never have to be brave or brittle enough that a bad ten kilometres
turns the whole day into a failure. Three fixes that:

- **A-goal** — the stretch. Auditioned at tune-up races, not assumed.
- **Realistic** — what the coach actually trains toward. Every marathon-pace
  session anchors here, so this is the number that shapes the block.
- **Floor** — what still counts as a good day when race day goes sideways.

`targetTier` picks which one drives the pace bands. Setting it to the A-goal
is the classic mistake: you end up training at a pace you have not earned,
and the sessions that were supposed to build you break you instead.

The shipped times (3:30 / 3:40 / 3:50) are round placeholder numbers, not a
recommendation and not anyone's real targets.

## 3. What counts as a good day? → `config/thresholds.json`

This is the file to be most careful with, and the one most likely to be
copied without thinking.

Every number shipped there is a **generic population placeholder**. Overnight
HRV in particular varies enormously between people and between devices: two
healthy athletes can differ by a factor of three, and the same person reads
differently on two watches. A band that is correct for a stranger will
mislabel your good days as bad ones and train you to ignore the dashboard,
which is the worst outcome available.

Derive your own from your own trailing data:

1. Run for four to six weeks with the shipped thresholds and pay no attention
   to the colours.
2. Take your own distribution. The middle of your normal range is your
   baseline; roughly the bottom decile is the floor worth flagging.
3. Set the band from that, and revisit it after any big change in training
   load, altitude, illness, or device.

If you have a clinician who has seen your bloods, this is a good thing to
show them. If you do not, treat every colour as a prompt to pay attention
rather than a verdict.

`pulse` freshness aside, two other cuts matter: `staleAccountDays` style
windows and `bodyComposition.buildStartBodyFatPct`. Leave the latter `null`
and the dashboard compares against your first logged reading instead of a
pinned baseline, which is usually what you want.

## 4. When should each specialist fire? → `.claude/agents/*.md`

Each persona file has a trigger table near the top. These are the highest
leverage lines in the repo, because they decide what your morning actually
costs and whether the brief is worth reading.

- **Nutri** is unconditional. There is a useful nutrition action every day.
- **Doc** fires on measurable breaches: a biometric outside its band for N
  consecutive days, a scheduled check-in due within N days, or a symptom you
  reported in plain language. Tune N, not the thresholds, if Doc is too noisy.
- **Mind** fires on phase and on language: taper, race week, after a session
  you logged as bad, when a sibling agent flags a stacking external stressor,
  or when your own writing reads flat.

If a specialist fires every single day, its trigger is broken and it has
become expensive wallpaper. If it never fires, the trigger is too tight and
you would not notice the thing it exists to catch.

## 5. What are you willing to store, and where? → the honest question

Before you connect anything real, decide these three things.

**What goes in the database.** Everything in `dashboard/supabase/` is
RLS-locked to one user and storage policies are pinned to your `auth.uid()`.
That is a good default. It is still your Supabase project, subject to your
password and your recovery email.

**What goes in a public view.** The `public_pb_*` views exist to power the
public page and they are readable by anyone with the URL. Read
`dashboard/supabase/migrations/0006_public_summary_view.sql` and decide
deliberately. Publishing a training log is a normal thing to do. Publishing a
biometric trend is a different decision, and it is easy to make the second
one by accident while intending the first.

**What never goes in the repo.** `config/dna-insights.json` and
`config/supplements.json` ship empty for a reason. Genomic results and a
supplement regimen are the most identifying and most sensitive health data
most people hold. If you fill them in, they live in your working copy and
`.gitignore` should keep them there. Check before your first push, not after.

The same applies to body photos, medical documents, exports from a clinic,
and lab PDFs. `.gitignore` covers the obvious paths. The judgment is yours.

## 6. Sanity check

Run the dashboard in demo mode first (`npm run dev`, then `/?demo=1`) and
confirm the whole thing renders before you connect anything real. Then, with
your own data in:

- Does the phase road match where you actually are in the block?
- Do the colour cuts label a normal day as normal? If a routine Tuesday reads
  amber, go back to section 3 before you trust anything else.
- Ask Coach for a morning brief and check who it called. If it called all
  three specialists on an unremarkable day, tighten the triggers.

And the test that matters most: give it a day where a metric looks bad and
see whether it escalates cleanly or reassures you. An agent that talks you
out of a doctor's appointment has failed at the only job that carries real
consequences.
