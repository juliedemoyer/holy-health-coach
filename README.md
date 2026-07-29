# HOLY · Your Daily Health & Energy Coach

An open-source, four-agent Claude swarm that coaches one athlete through a
training block: it reads your wearable data every morning, decides which
specialist actually needs to weigh in, and ships one short brief you read in
two minutes. A lead coach owns the relationship; a nutritionist, a sports
doctor, and a sports psychologist get called only when their expertise is
genuinely needed. Nothing diagnoses. Nothing sends. The dashboard is the
part you look at; the routing is the part that matters.

It grew out of a real marathon build and is published as a reference
implementation of a **hub-and-spoke agent swarm with trigger-based
delegation and structurally enforced guardrails**. Marathon training is the
concrete example, but the architecture (leader → conditional specialists →
one synthesised answer) generalizes to any domain where a single generalist
voice would be shallow and calling every specialist every turn would be
expensive noise.

**Try it without deploying anything:**

```bash
cd dashboard && npm install && npm run dev
```

then open `http://localhost:5173/?demo=1`. Demo mode skips auth, serves a
fictional athlete from `config/demo-data.json`, and drops every write, so you
can browse the whole dashboard with no Supabase project and no API keys.

*Every number in demo mode is invented. It is not anyone's health data, and
none of it should be read as a target or a reference range.*

## Why this exists

Endurance training generates an absurd amount of data and almost no
judgment. Your watch will tell you your HRV dropped. It will not tell you
whether that is the taper, a cold coming, a hard week at work, or nothing at
all. So you either ignore the number, which wastes it, or you google it at
11pm, which is worse.

The people who resolve that ambiguity well are coaches, dietitians, doctors
and sports psychologists, and almost nobody has all four. Most of us have
none, and fill the gap with forum posts and whatever the app's default
advice happens to be.

Holy is an attempt at the honest version of that gap. It reads the data
every morning, decides whether anything actually changed, and gives you one
paragraph and three small actions. When a trend crosses a line that a real
clinician should look at, it says so and stops, because the single most
dangerous thing a health agent can do is be confidently reassuring.

It is emphatically not built to replace a coach, a dietitian, or a doctor.
It is built to notice things between the appointments you already have, and
to make you better at using them: to walk into a check-up with a trend
chart instead of a vague feeling. If you have a real coach, this makes you a
better-briefed athlete for them. If you have none, this is not one.

And why publish it? Because a health agent is the easiest kind of agent to
make quietly harmful. The objective is measurable, the person is motivated,
and the failure mode looks exactly like progress: an agent optimising a
finish time will happily coach you into undereating and overtraining, and
every intermediate metric will improve while it does. The guardrails against
that are the interesting part of this repo, and they are worth more in
public than in private. See [docs/SAFETY.md](docs/SAFETY.md).

## What it does

- **Syncs** wearable and manual data into one store, once a day
- **Decides who to call.** Every specialist has an explicit trigger table.
  The nutritionist runs daily. The doctor runs when a biometric crosses a
  threshold for N consecutive days, or a check-in is due, or you report a
  symptom. The psychologist runs during taper and race week, after a bad
  session, or when your own language reads flat
- **Fans out in parallel** when more than one trigger fires, then
  synthesises everything into **one** message with every specialist quoted
  and attributed, so you can see the reasoning rather than a blended average
  of it
- **Escalates instead of diagnosing.** Any specialist touching medical
  territory names the real-world escalation path and stops
- **Proposes, never acts.** Plan changes land as proposals you confirm
- **Renders** the whole thing as a dashboard: vitals trends, plan versus
  actual, a regression explorer for "does sleep actually predict my pace",
  a nutrition log, and a knowledge base

## Architecture

```
                        morning trigger (cron or "morning")
                                     │
                                     ▼
                   ┌──────────────────────────────────┐
                   │  Coach: lead agent, owns voice   │
                   │  reads config/ + vault + data    │
                   └──────────────────────────────────┘
                        │  trigger tables decide who
        ┌───────────────┼───────────────┬──────────────────┐
        ▼               ▼               ▼                  │
    ┌────────┐     ┌────────┐     ┌────────┐               │
    │ Nutri  │     │  Doc   │     │  Mind  │   (parallel,  │
    │ always │     │ on     │     │ on     │    never      │
    │        │     │ breach │     │ stress │    serial)    │
    └────────┘     └────────┘     └────────┘               │
        └───────────────┴───────────────┘                  │
                        │  every answer quoted + attributed│
                        ▼                                  ▼
              one brief, ≤700 chars              shared vault + task board
                        │                        (async context, sync tasks)
                        ▼
              Supabase (Postgres + RLS + Storage)
                        │
                        ▼
              dashboard/ (Vite + React + Recharts)
```

Specialists never talk to each other. Everything routes through Coach, and
through the shared vault for slower cross-domain signals. Hub and spoke, not
a mesh: it is the difference between a system you can audit and a system you
can only observe.

## Repo layout

| Path | What it is |
|---|---|
| `.claude/agents/*.md` | The four persona files, loaded as Claude Code subagents. Voice, trigger tables, guardrails |
| `config/` | Everything specific to you. The only files a fork needs to edit |
| `dashboard/` | The read surface. Vite + React + Supabase, deploys to Cloudflare Pages |
| `knowledge/` | Coaching rules, recipes, and a podcast library the agents read |
| `ARCHITECTURE.md` | The orchestration pattern in detail, domain-agnostic |
| `docs/SAFETY.md` | Why a health agent needs guardrails, and which ones are here |

## What Holy reads

The same source list as [the one-pager](docs/holy-one-pager.pdf), with one
extra column, because a public repo owes you the difference between what the
system does and what you get when you clone it. **Shipped** means it is in this
repo. **Schema only** means the table, columns and dashboard that consume the
source are here, but the connector that fills them is not: it runs on one
machine against one set of vendor credentials, and you write your own.

### External

| Source | Via | What it contributes | In this repo |
|---|---|---|---|
| Wearable sync | API | Overnight HRV, resting HR, sleep, readiness | Schema only (`scores`) |
| Activity feed | API | Runs and sessions, plan versus actual | Schema only (`activities`) |
| Blood test output | CLI | Lab panels and biomarkers over time, plus the next-due date Doc triggers on | Schema only (`medical`) |
| Digital scale | API | Weight and body-composition trend | Schema only (`scores`, migration 0004) |
| Manual quick-log | CLI | Grip strength, mood, meals, how it actually felt | Schema only (`scores`, `meals`) |
| Pictures | CLI | Photos of food, weight and body composition | Schema only (`body_photos` + private buckets) |
| Gmail and Calendar | MCP | Jetlag and timezones, agenda load, competition dates | Not shipped: per-machine MCP servers |

### Internal

| Source | Via | What it contributes | In this repo |
|---|---|---|---|
| `config/` | CLI | Athlete, race, goal tiers, thresholds | Shipped |
| Coach plan | CLI | The 20-week build, sessions and overrides | Shipped (`dashboard/src/lib/coachPlan.ts`) |
| Persona files | CLI | `coach` · `nutri` · `doc` · `mind` trigger tables | Shipped (`.claude/agents/`) |
| Shared vault | CLI | Sibling-agent notes, discovered rather than hardcoded | Not shipped: a local Markdown folder, gitignored |

Two more things you cannot clone. **The scheduler:** the 07:00 and 22:00 runs
are local `launchd` jobs, and a cron job, a GitHub Action or typing "morning"
into Claude Code all work instead. **Any image:** `.gitignore` excludes image
files wholesale so no fork inherits anyone's body, meal or race photos, and the
`/public` page renders those frames empty rather than broken when they are
absent.

## Quickstart

```bash
git clone https://github.com/juliedemoyer/holy-health-coach.git
cd holy-health-coach/dashboard
npm install
npm run dev          # then open http://localhost:5173/?demo=1
```

For a real instance:

1. Create a Supabase project. Run `dashboard/supabase/schema.sql`, then
   migrations 0001 to 0005 and 0008 to 0011, in order. Stop there unless you
   want a public page: 0006, 0007 and 0012 to 0015 grant the anon role read
   access to build up the `/public` view, and every private page works without
   them. See Security and privacy notes below. If you ran an early copy of
   0010, also run 0016.
2. Copy `dashboard/.env.example` to `dashboard/.env.local` and fill in the
   Supabase URL and anon key.
3. Answer the questions in **[docs/MAKE-IT-YOURS.md](docs/MAKE-IT-YOURS.md)**.
   They walk you through `config/athlete.json`, `config/race.json`, and
   `config/thresholds.json`.
4. Copy `CLAUDE.md.example` to `CLAUDE.md` and edit the bracketed parts, if
   you want to drive the swarm from Claude Code.

## Cost

The dashboard runs inside Supabase's free tier. The agent side is one
orchestration pass per morning: Coach plus one to three specialists, each with
a small context, on Sonnet with Haiku for retrieval.

What you actually pay turns almost entirely on how often the conditional
specialists fire, which is the whole point of the trigger tables: waking all
four every morning costs four times as much and produces a wall of text nobody
reads by Thursday. Price it against current model rates rather than trusting a
figure in someone else's README.

## Design decisions

- **Trigger tables, not always-on.** Calling four specialists every morning
  costs four times as much and produces a wall of text nobody reads by
  Thursday. Each specialist has explicit, measurable conditions. The doctor
  firing is itself information.
- **One voice out.** Specialists are quoted and attributed inside a single
  message rather than presented as four separate replies. You should never
  have to reconcile your own agents.
- **Structural guardrails, not prompt guardrails.** "Never diagnose" is a
  sentence a model can talk itself out of at 6am. The stronger version is
  architectural: the doctor persona has no write access, its only outputs are
  a flag level and an escalation path, and the escalation path is a required
  field. See [docs/SAFETY.md](docs/SAFETY.md).
- **Nothing personal in the repo.** Height, date of birth and sex come from env
  vars rather than a committed file, and the genomics and supplement panels ship
  empty on purpose: that is the most identifying health data there is, and no
  example set belongs in a public repository. Read the caveat in Security and
  privacy notes before you trust the env-var half of that sentence: `VITE_`
  variables are inlined into the client bundle, so they are out of the repo but
  not out of public view.
- **The plan bends to reality.** Illness, travel, and a bad week edit the
  plan rather than being scored against it. A training plan that is defended
  against what actually happened is just a guilt generator.
- **Hub and spoke.** Specialists cannot call each other. Every path goes
  through the leader, which means every decision has one place to look.

## What's configurable vs. what's code

| File | Controls |
|---|---|
| `config/athlete.json` | Who is being coached: name, dietary pattern, the specialist roster |
| `config/race.json` | The goal race, the goal tiers, build start, phase boundaries |
| `config/thresholds.json` | Every colour cut the dashboard uses. Placeholders, not advice |
| `config/dna-insights.json` | Optional genomics notes. **Ships empty** |
| `config/supplements.json` | Optional supplement card. **Ships empty** |
| `config/demo-data.json` | The fictional athlete served in `?demo=1` |
| `knowledge/` | Coaching rules and recipes the agents read as domain context |

## Security and privacy notes

- **This is not a medical device.** It renders your own data against
  thresholds you chose. It does not diagnose, and it is not a substitute for
  a clinician. The thresholds shipped in `config/thresholds.json` are generic
  population placeholders and will not fit you.
- Every table is RLS-locked to a single user. The storage policies are pinned
  to the owner's `auth.uid()` (see migration 0005) as defence in depth, so a
  policy mistake in one place does not open a bucket. Nothing grants the anon
  role read access to a photo bucket. If you cloned this repo before
  2026-07-29, an earlier version of migration 0010 did exactly that: run
  `0016_revoke_anon_photo_read.sql` and redeploy.
- Private photos are served through time-limited signed URLs, and `signedUrl()`
  refuses to sign without an authenticated session. If signing ever fails
  during page load, that is the session not being restored yet. Do not fix it
  by granting the anon role bucket access: the anon key ships inside the
  deployed bundle, so that makes every photo world-readable.
- **The public page is opt-in and off by default.** Migrations 0006, 0007 and
  0012 to 0015 are the only ones that grant the anon role anything, and every
  private page works without them. Each carries a banner saying so. Read
  `0006_public_summary_view.sql` and `0012_public_pb_latest_vitals.sql` before
  running either: between them they publish session totals, weekly volume,
  HRV, resting heart rate, sleep, weight, body-fat percentage, muscle mass and
  grip strength to anyone on the internet. That is a deliberate choice for one
  athlete's public page. It is unlikely to be yours.
- Demo mode (`?demo=1`) bypasses auth by design. It also short-circuits every
  write, so it cannot touch a real project. Do not extend it to real data.
- **`VITE_` env vars are public. All of them.** Vite inlines every variable
  with that prefix into the client bundle at build time, so
  `VITE_BIRTHDATE`, `VITE_HEIGHT_CM` and `VITE_SEX` end up as literal strings
  in the JavaScript your deployment serves. Keeping them out of a committed
  file moves them from the repo into the bundle; it does not make them private,
  and a deploy-target secret does not change that either. Treat anything
  `VITE_`-prefixed as published. If you want those three values genuinely
  private, put them in the RLS-locked `config` table and read them after
  sign-in, or leave them unset and accept the `config/athlete.json` fallbacks.
  The anon key is the one `VITE_` value that is *designed* to be public: RLS is
  what protects the data behind it.
- `.gitignore` covers `.env.local`, and body photos, medical documents and
  exports are excluded wholesale.
- The agents have **no write access to app code or schema**, and no ability
  to send anything. Plan changes are proposals you confirm.

## Part of a multi-agent team (optional)

Holy runs standalone, but it was designed as one member of a small team of
domain agents, each with its own repo and schedule. They coordinate through
two lightweight channels rather than a framework: a shared Markdown vault for
async narrative context, and a shared kanban board for task-level handoff.
A heavy week flagged by a sibling agent is exactly the signal that should
make Coach pace the week differently. See ARCHITECTURE.md §3 and §4.

Sibling repos:

- [josh-career-agent](https://github.com/juliedemoyer/josh-career-agent): a daily-autonomous career transition agent
- [rachel-retail-analyst](https://github.com/juliedemoyer/rachel-retail-analyst): a grounded, citation-first research analyst

## Docs

- [One-page overview](docs/holy-one-pager.pdf): two-page visual summary (PDF). Also served at `/one-pager.html` once deployed
- [docs/MAKE-IT-YOURS.md](docs/MAKE-IT-YOURS.md): the questions to answer before your first run
- [ARCHITECTURE.md](ARCHITECTURE.md): the orchestration pattern, domain-agnostic
- [docs/SAFETY.md](docs/SAFETY.md): why a health agent needs guardrails, and which ones are here
- [CLAUDE.md.example](CLAUDE.md.example): template for driving the swarm from Claude Code

## License

MIT. See [LICENSE](LICENSE).
