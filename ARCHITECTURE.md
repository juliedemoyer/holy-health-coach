# Architecture — how the swarm actually works

This document is the generic, public-safe version of the orchestration
layer that runs this project day to day. The private original
that this was distilled from carried a real person's medical history,
family schedule, and other people's private data. None of that belongs in
a public repo, and none of it is here. Everything below is the pattern with the
personal details removed.

If you're evaluating this as an engineering sample: this file is the
part that matters. The [persona files](.claude/agents/) show voice and
tone; this file shows the system design underneath them.

---

## 1. The core pattern: one leader, N specialists

A single **leader agent** owns the relationship with the user. It has
its own voice and default authority — for most interactions, the user
only ever talks to the leader. Underneath it, **specialist subagents**
exist for domains where a single generalist voice would be shallow:
nutrition, medical interpretation, mental performance, whatever the
domain calls for.

The leader:
- Decides *when* a specialist's expertise is actually needed (see §2)
- Delegates with full relevant context in a single call — no back-and-forth
- Synthesizes every specialist's answer into **one final message** the
  user reads once. The user never has to reconcile four different voices
  themselves.
- Always attributes — "Nutri says: ...", "Doc flagged: ..." — because
  part of the value is *showing* the specialist reasoning, not hiding it
  behind the leader's paraphrase.

This is a **hub-and-spoke**, not a **mesh**. Specialists don't talk to
each other directly; everything routes through the leader, and through
one async channel (§3) for slower-moving cross-domain signals.

## 2. Trigger-based delegation, not always-on

Calling every specialist on every turn is expensive and produces noise.
Each specialist has an explicit trigger table — some unconditional
("always call the nutrition specialist for the daily nutrition
micro-action"), most conditional on a measurable threshold:

```
Call the medical specialist if ANY of:
  - a tracked biometric has crossed its baseline for N consecutive days
  - a scheduled check-in (blood panel, physical) is due within N days
  - the user reports a symptom in plain language
  - a domain-specific anomaly needs normalizing against a known cycle
    (e.g. hormonal, seasonal, workload periodization)

Call the mental-performance specialist if ANY of:
  - the user is in a known high-stakes phase (taper, exam week, launch week)
  - the last tracked session/attempt was logged as a failure or DNF
  - a cross-agent signal (§3) flags a stacking external stressor
  - self-reported mood/energy drops below a floor
  - the user's own language reads flat, defeated, or checked-out
```

Conditional calls fan out **in parallel**, not sequentially, when more
than one trigger fires the same turn — there's no reason to serialize
independent specialist calls and make the user wait for round-trips
that don't depend on each other.

## 3. Shared memory: the vault pattern

Specialists (and sibling agents outside this swarm entirely — a
work-focused agent, a different life-domain agent) write short,
dated notes to a **shared, filesystem-based vault**: one folder per
agent, each agent owning its own `latest.md` that it overwrites at the
end of its day.

```
vault/
  leader/latest.md
  specialist-a/latest.md
  specialist-b/latest.md
  ...
```

At the start of a session, the leader reads its own prior note plus its
default set of sibling notes for cross-domain context — "sibling agent
flagged a high-stakes week" changes how the leader paces recommendations
even though that agent has nothing to do with this domain. The
mechanism is generic: **discover who's in the vault by listing the
directory**, don't hardcode a fixed roster. Agents join and leave a
team; the code that reads the vault shouldn't need to change when they
do.

This channel is **async and narrative** — it's for context, not
task tracking. It answers "what should I know," not "what's blocking."

## 4. Task-level handoff: the shared board

For synchronous, actionable cross-agent work, the swarm uses a shared
kanban-style task board (a small REST API: sprints, tasks, tags) rather
than the vault. The distinction that matters:

| | Vault (§3) | Board (this section) |
|---|---|---|
| Cadence | Once a day, end of day | Anytime, live |
| Content | "Here's what happened and why" | "Here's a discrete task, its status" |
| Consumption | Read at next session start | Polled/filtered by agent + tag |
| Failure mode if missed | Stale context, recoverable | A real task silently drops |

Tags carry two kinds of information: which internal role did the work
(`role:leader`, `role:specialist-a`), and which *other* agent on the
team should see it (`collab:<agent>`). A task tagged
`role:specialist-c, collab:teammate-x` means "the mental-performance
specialist produced this, and it's relevant to a sibling agent working
with a different person entirely."

**Operational lesson worth stating explicitly:** don't assume an API
capability is missing because a stale note says so. A previous session
recorded "there's no sprint-creation endpoint" based on one failed
assumption; the endpoint existed. Verify capabilities directly before
building a workaround around a gap that might not be real.

## 5. The daily cadence: one deterministic pipeline

The highest-frequency behavior — a daily check-in — runs the same
pipeline every time, whether triggered by a scheduler or a live chat
message:

1. **Sync**: pull raw data from whatever device/API integrations exist
   (wearable, activity tracker, manual quick-log). Local files are
   authoritative; any dashboard mirror is downstream and best-effort.
2. **Score**: collapse raw metrics into one unified number against
   personal targets — a single score is easier to trend than five raw
   series, and it's what unlocks "how am I doing, generally" as a
   one-word answer.
3. **Recall**: surface "this looks like a past day" context from a
   local vector-memory store, if one exists — pattern-matching against
   history the user themselves wouldn't think to check.
4. **Delegate**: run §2's trigger table, fan out in parallel.
5. **Synthesize**: leader writes the single final message — numbers
   first (so the user can judge the advice against the data), then
   the day's action, then each specialist's one-liner, then the
   leader's own close.
6. **Persist**: write the brief to disk / a database *and* confirm in
   chat. A brief that isn't persisted didn't happen as far as any
   downstream surface (dashboard, other agents) is concerned.
7. **Signal outward**: if anything in today's brief is relevant to a
   sibling agent, write one line to that agent's inbox in the vault —
   don't wait for their session to start, don't assume they'll infer it.

## 6. Guardrails as architecture, not afterthought

A few rules are enforced structurally, not just requested in a prompt:

- **Never diagnose. Escalate instead.** Any specialist touching health,
  legal, or financial domains states patterns and recommends a licensed
  professional — it does not render a verdict.
- **Trends over points.** A single data point (weight, a bad session, one
  low mood score) never gets commented on in isolation; everything is
  read against a rolling baseline.
- **No irreversible actions without confirmation.** Proposed actions are
  drafts. Sends, purchases, and publishes wait for explicit user sign-off.
- **No guilt as a mechanic.** Missed sessions, off-plan days, and lapses
  are logged as data, not narrated as failure.

These exist because a personal-coaching agent sits closer to a user's
wellbeing than most software — the cost of getting the tone wrong here
is higher than in a typical app, so the constraints are written into
the routing logic itself, not left to hope the leader's prompt holds.

## 7. Adapting this pattern

Nothing above is marathon-specific, or even fitness-specific. The same
shape — one leader, conditionally-triggered specialists, a shared vault
for narrative context, a shared board for actionable handoff, one daily
synthesis pipeline — works for any domain where a single generalist
voice would flatten expertise that's genuinely different: a financial
coach with a tax specialist and a behavioral-finance specialist, a
learning coach with a domain-tutor and a study-habits specialist, and
so on. The parts worth keeping if you fork this:

- The **trigger table**, not the specific triggers
- The **vault's discovery mechanism** (list the directory; don't
  hardcode the roster), not the specific agents in it
- The **numbers-first synthesis order**, not the specific metrics
- The **guardrails-as-routing-logic** habit, not the specific rules

The parts to throw away and rebuild for your own case: literally
everything else — the specialists, the triggers, the data sources, the
domain rules.

---

*Companion documents: [`.claude/agents/`](.claude/agents/) for the
persona/voice layer this architecture drives, and
[`dashboard/`](dashboard/) for the dashboard that
visualizes its output.*
