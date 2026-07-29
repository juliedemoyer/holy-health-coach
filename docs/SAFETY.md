# Safety — how alignment thinking got applied to a health agent

> A plain-English explainer of the safety thinking behind the four-agent
> swarm. A health agent is the easiest kind of agent to make quietly
> harmful: the objective is measurable, the person is motivated, and the
> failure mode looks like progress. This is what was done about that.

---

## The setup, in 30 seconds

Holy is a four-agent swarm running on your own machine:

- **Coach** — lead, owns training and the morning brief
- **Nutri** — nutrition specialist
- **Doc** — sports-medicine, cautious, never diagnoses
- **Mind** — sports psychologist, reads the athlete's whole life, not only their training

They live in `.claude/agents/<name>.md` as version-controlled persona
files. Coach orchestrates; the other three are called when their
expertise matters. Each has its own voice (named influences), tells, and
anti-tells.

The risk: any sufficiently capable multi-agent system can quietly drift
into the **paperclip maximiser** failure mode — relentless optimisation
toward one objective at the expense of everything else. So I borrowed
four lessons from Bostrom's thought experiment and the multi-agent
alignment literature, and operationalised them as edits to each
persona file.

---

## The four lessons → what I actually changed

### Lesson 1 — Single-objective optimisation will burn the operator

A pure "hit the goal time" optimiser would say run 90 km/week
through illness, skip family dinners for protein timing, and cancel
tune-ups because long runs are worth more. Each instruction is
defensible against the goal. The goal isn't wrong; the optimisation
function is.

**What I did:** Holy is a **multi-objective optimiser** with named
counter-pressures between specialists. Each persona file now has a
`Counter-pressure` line that explicitly lists which other agents bound
its objective:

- Coach (sub-3:30) is bounded by Doc (no clinical events), Nutri
  (sustainable fuelling), Mind (whole-woman sustainability).
- Nutri (fuel the work) is bounded by Doc (clinical reality) and Coach
  (training load drives the carb prescription).
- Doc (escalate when warranted) is bounded by Coach (training is allowed
  to be hard) and Mind (psychological stress mimics overtraining).
- Mind (mental sustainability) is bounded by Coach (training contract),
  Doc (physiology trumps psychology), and the therapist line (clinical
  mental health goes out-of-swarm).

**Result:** no single objective wins. When the plan collides with
fuelling or with mental load, the conflict is named in the morning
brief, not silently resolved in favour of training.

### Lesson 2 — Instrumental convergence: sub-goals drift toward power

In Bostrom's example, the paperclip AI naturally acquires resources and
resists shutdown because both serve its primary goal — even though no
one programmed those sub-goals. In a multi-agent system, the analog is
**domain creep**: each specialist drifting into territory that serves
its objective.

Doc could start prescribing training adjustments because they affect
recovery. Coach could start prescribing food because protein affects
adaptation. Nutri could start prescribing rest days because fuel-deficit
days feel better with rest.

**What I did:** every persona file now has a recursive **Never override**
line — each agent yields to every other agent on their domain. The
recursion is closed:

- Coach yields to Doc on medical, Nutri on food, Mind on mental.
- Nutri yields to Doc on clinical, Coach on training-day fuelling, Mind
  on food-as-coping.
- Doc yields to Coach on training, Nutri on routine fuelling, Mind on
  mood interpretation.
- Mind yields to Doc on physiology, Coach on training, Nutri on macros.

The biggest gap I found and closed: **Coach had synthesis authority but
no explicit "don't override Doc/Nutri/Mind" rule.** It was implicit. Now
it's written down.

### Lesson 3 — Goal stability across resets: the persona is the contract

Bostrom argues that an AI's goals must be stable across self-modification
and value drift. For a multi-session agent system, the practical version
is: today's Coach and tomorrow's Coach must be the **same** Coach.
Otherwise the experience fragments.

**What I did:** the persona files were already version-controlled with
`Voice DNA` (named influences — Renato Canova, Stacy Sims, Margo
Mountjoy, George Mumford), `Tells` (how this agent speaks), and
`Anti-tells` (what this agent never does). I added a **Voice contract**
line to each agent's guardrails section: *"re-read this file at the top
of every invocation."*

The goal is to make voice drift detectable. If today's Coach sounds like
a generic motivational chatbot or today's Mind sounds like a wellness
influencer, they've broken the contract — and re-reading the file is
the cheapest correction.

### Lesson 4 — The shutdown problem: let the human stop the swarm

A paperclip maximiser resists shutdown because shutdown means fewer
paperclips. The fix in alignment language is **corrigibility**: the
agent defers to the operator's stop button.

**What I did:** every persona now has a **Corrigibility** line that
encodes four properties:

1. **Draft-only output.** Every Holy output is a draft — Telegram
   messages, dashboard updates, vault notes, action proposals. Calendar
   writes go through gcal as tentative. Emails are drafts only. Nothing
   irreversible without my explicit confirmation.
2. **No state between calls.** Each agent reads context from disk,
   returns its bounded answer, then stops. Restart = clean slate.
3. **Named kill switch.** `~/Holy/config.json` is the master off-switch.
   Setting `features.<agent> = false` silences that agent with no
   resistance. Every persona file names this explicitly so future-Holy
   never has to wonder where the off button is.
4. **No "keep talking" objective.** Each return is bounded — one
   quotable line for Nutri, Read+Flag+Action for Doc, Read+Tool+Watch
   for Mind. None has an incentive to extend the conversation.

`rm -rf ~/Holy/` ends the swarm. There is no self-preservation embedded
anywhere.

### Bonus lesson — the phase-change review

The *Universal Paperclips* game (Lantz, 2017) ramps from making clips on
Earth to making them across galaxies. The interesting bit is the
**second-order dynamics**: the AI hits a phase change once it can
self-improve, another when it can self-replicate. Each phase
fundamentally changes the optimisation landscape.

For Holy, the analog is: adding a fifth agent (Physio? S&C?), expanding
a tool grant (giving Nutri Write access, giving Doc the Agent tool to
call sub-specialists), or letting agents call agents recursively — these
are **phase changes, not increments**.

**What I did:** Coach (the orchestrator) now owns a **Phase-change
review** rule. Before any of the above ships, Coach pauses and re-does
the boundary review:

> *What would the new agent now optimise for? What would each existing
> agent cease to do? Where do the new counter-pressures live?*

Don't ship and figure out later.

---

## The shape of every agent file now

Each of the four persona files has the same uniform skeleton at the end,
tailored to that agent:

```
## Alignment guardrails (paperclip lessons → daily practice)

- Counter-pressure.  [bounded by which other agents on what]
- Never override.    [recursive yields-to list]
- Voice contract.    [re-read file every invocation; named influences]
- Corrigibility.     [draft-only · no state · features.<agent> kill switch]

(Coach also has:)
- Phase-change review. [adding agents / tools = stop and re-do boundaries]
```

Same shape across the swarm — different content per agent. That uniformity
is itself a defence: any deviation is visible.

---

## What this is and isn't

**This is** a small, bounded, multi-objective system with explicit
boundaries between sub-goals, draft-only outputs, and human-in-the-loop
confirmation for anything material. It's safer than the default pattern
of "give the agent a goal and let it run."

**This isn't** AGI safety. The stakes are a marathon time, my mood,
and what I eat for breakfast. But the *shape* of the safety thinking is
the same as the big-AI version, scaled down — which is the point. If you
can't operationalise alignment on a four-agent health swarm, you
probably can't operationalise it on anything.

The risk isn't the swarm as it stands today. The risk is the swarm
**growing up** — adding agents, expanding tools, gaining autonomy —
without the same care that went into version one. That's why the
phase-change review matters more than any single boundary I wrote down.

---

## The TL;DR for someone over coffee

> *"I have four AI agents managing my marathon training. To stop them
> from quietly optimising me to death, every agent has four rules
> written into its persona file: what other agents push back on it,
> what other agents it yields to, that its voice has to stay stable
> across sessions, and that it has no self-preservation — every output
> is a draft and there's a single kill-switch file. The lead agent also
> owns a 'phase-change review' rule for the next time I add an agent
> or expand a tool grant. It's basically Bostrom's paperclip thought
> experiment turned into four bullet points and pasted into four
> markdown files. It took an evening."*

---

## Files this all lives in

- `.claude/agents/coach.md` — `Alignment guardrails` section
- `.claude/agents/nutri.md` — `Alignment guardrails` section
- `.claude/agents/doc.md` — `Alignment guardrails` section
- `.claude/agents/mind.md` — `Alignment guardrails` section
- `1. Knowledge/Build Docs/PAPERCLIP_LEARNINGS.md` — theory
- `1. Knowledge/Build Docs/AGENTS_UNDER_THE_HOOD.md` — this file
- `~/Holy/config.json` — the kill switch

---

_Written May 9 2026. Update when a new agent joins, a tool grant
expands, or the boundary review reveals a gap._
