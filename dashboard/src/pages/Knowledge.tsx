import { useEffect, useState } from "react";
import { BookOpen, Headphones, Paperclip } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/db";
import { Empty, PageHeader } from "@/pages/Vitals";

type Medical = Database["public"]["Tables"]["medical"]["Row"];
type Recipe = Database["public"]["Tables"]["recipes"]["Row"];

/**
 * The 10 podcasts Coach + Mind curated for the training build, mirrored from
 * `1. Knowledge/Podcasts/README.md`. Phase tags map to the build phases so
 * you can pick listening to match where you are in the block. Source URLs
 * are public show landing pages — clicking opens in a new tab.
 */
type Phase = "base" | "build" | "peak" | "taper" | "race";
type Podcast = {
  title: string;
  hosts: string;
  blurb: string;
  url: string;
  phases: Phase[];
};

const PODCASTS: Podcast[] = [
  {
    title: "The Real Science of Sport Podcast",
    hosts: "Ross Tucker · Mike Finch",
    blurb: "Anti-hype endurance science. The serious one — for build-phase mileage.",
    url: "https://sportsscientists.com/podcast",
    phases: ["base", "build", "peak"],
  },
  {
    title: "Trained",
    hosts: "Nike Sports Science · Jaclyn Byrer",
    blurb: "Production-quality elite-athlete interviews. Inspiration that's grounded.",
    url: "https://www.nike.com/trained-podcast",
    phases: ["base", "build", "race"],
  },
  {
    title: "Magness & Marcus on Coaching",
    hosts: "Steve Magness · Jon Marcus",
    blurb: "Sitting in the coaches' room. Best for tactical training questions.",
    url: "https://www.scienceofrunning.com/podcast",
    phases: ["build", "peak"],
  },
  {
    title: "Inside Running Podcast",
    hosts: "Brad Beer · Brady Threlfall · Julian Spence",
    blurb: "Three sub-2:30 Australians + a physio. Long-run banter that teaches.",
    url: "https://insiderunningpodcast.podbean.com",
    phases: ["base", "build"],
  },
  {
    title: "Some Work, All Play",
    hosts: "David & Megan Roche",
    blurb: "Joyful, science-grounded, anti-toxic-grit. Antidote to taper week.",
    url: "https://www.swappodcast.com",
    phases: ["base", "taper", "race"],
  },
  {
    title: "The Strength Running Podcast",
    hosts: "Jason Fitzgerald",
    blurb: "Strength + injury prevention. Best while you're keeping up the lifts.",
    url: "https://strengthrunning.com/podcast",
    phases: ["base", "build"],
  },
  {
    title: "Marathon Talk",
    hosts: "Tom Williams · Martin Yelling",
    blurb: "UK marathon institution. Race-week vibes and pacing wisdom.",
    url: "https://marathontalk.com",
    phases: ["peak", "taper", "race"],
  },
  {
    title: "The Knowledge",
    hosts: "Coach Hadley",
    blurb: "15-minute science breakdowns. Drive-time fuel.",
    url: "https://podcasts.apple.com/us/podcast/the-knowledge/id1502987489",
    phases: ["base", "build", "peak"],
  },
  {
    title: "Ali on the Run Show",
    hosts: "Ali Feller",
    blurb: "Long-form interviews · race-day stories. Saturday long-run companion.",
    url: "https://aliontherunblog.com/podcast",
    phases: ["base", "build", "taper"],
  },
  {
    title: "Rich Roll Podcast",
    hosts: "Rich Roll",
    blurb: "Selected episodes only — Kipchoge, Sims, Magness. Skip the rest.",
    url: "https://www.richroll.com/all-episodes",
    phases: ["base", "taper", "race"],
  },
];

const PHASE_LABELS: Record<Phase, string> = {
  base: "Base",
  build: "Build",
  peak: "Peak",
  taper: "Taper",
  race: "Race week",
};

export function Knowledge() {
  const [medical, setMedical] = useState<Medical[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    void Promise.all([
      supabase.from("medical").select("*").order("next_due", { ascending: true, nullsFirst: false }),
      supabase.from("recipes").select("*").limit(50),
    ]).then(([m, r]) => {
      setMedical(m.data ?? []);
      setRecipes(r.data ?? []);
    });
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader voice="doc" Icon={BookOpen}>
        Knowledge
      </PageHeader>

      <PaperclipCard />

      <section>
        <h3 className="font-display text-base font-medium text-[--color-ink] mb-3">
          Medical
        </h3>
        {medical.length === 0 ? (
          <Empty message="Medical files in ~/Holy/data/medical/*.md sync into Supabase nightly." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {medical.map((m) => {
              const overdue = m.next_due ? differenceInCalendarDays(new Date(m.next_due), new Date()) : null;
              return (
                <div key={m.id} className="holy-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-display font-medium text-[--color-ink] capitalize">
                      {m.topic}
                    </div>
                    {overdue !== null && (
                      <span
                        className={`text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full ${
                          overdue < 0
                            ? "bg-[--color-race]/15 text-[--color-race]"
                            : overdue < 30
                            ? "bg-[--color-warn]/15 text-[--color-warn]"
                            : "bg-[--color-coach-tint] text-[--color-coach]"
                        }`}
                      >
                        {overdue < 0 ? `${-overdue}d overdue` : `${overdue}d to go`}
                      </span>
                    )}
                  </div>
                  {m.visit_date && (
                    <div className="text-xs text-[--color-ink-mid] mt-1">
                      Last visit: {format(new Date(m.visit_date), "d MMM yyyy")}
                    </div>
                  )}
                  {m.summary && (
                    <p className="text-sm text-[--color-ink-mid] mt-2 leading-relaxed">{m.summary}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-display text-base font-medium text-[--color-ink] mb-3">
          Recipes ({recipes.length})
        </h3>
        {recipes.length === 0 ? (
          <Empty message="Recipes seed into Supabase from 1. Knowledge/Recipes/. Run `npm run seed:recipes`." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recipes.map((r) => (
              <div key={r.id} className="holy-card p-4">
                <div className="font-display font-medium text-[--color-ink]">{r.title}</div>
                {r.tags && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {r.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full bg-[--color-coach-tint] text-[--color-coach]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-display text-base font-medium text-[--color-ink] mb-3">
          Coaching playbook
        </h3>
        <div className="holy-card p-5 text-sm text-[--color-ink] leading-relaxed">
          <p className="mb-3">
            Coach's 50 marathon-build rules live in{" "}
            <code className="text-xs bg-[--color-surface-2] px-1.5 py-0.5 rounded">
              1. Knowledge/Marathon Data/coaching-rules.md
            </code>
            .
          </p>
          <p className="text-[--color-ink-mid]">
            They cover phase rules (Base/Build/Peak/Taper/Race), pescatarian fuelling,
            sleep, cycle awareness, cross-agent stress responses, and tune-up race
            protocols. Updated quarterly or when a tune-up race teaches us something new.
          </p>
        </div>
      </section>

      <PodcastsSection />
    </div>
  );
}

// ---- podcasts ------------------------------------------------------------

function PodcastsSection() {
  const [filter, setFilter] = useState<Phase | "all">("all");
  const filtered =
    filter === "all" ? PODCASTS : PODCASTS.filter((p) => p.phases.includes(filter));

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <h3 className="font-display text-base font-medium text-[--color-ink] flex items-center gap-2">
          <Headphones className="w-4 h-4" style={{ color: "var(--color-coach)" }} />
          Podcast library
        </h3>
        <div className="text-xs text-[--color-ink-dim]">
          Source: <code>1. Knowledge/Podcasts/README.md</code>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {(["all", "base", "build", "peak", "taper", "race"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.16em] font-semibold transition ${
              filter === p
                ? "bg-[--color-ink] text-white"
                : "bg-[--color-surface-2] text-[--color-ink-mid] hover:text-[--color-ink]"
            }`}
          >
            {p === "all" ? "All" : PHASE_LABELS[p as Phase]}
          </button>
        ))}
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((p) => (
          <li key={p.title}>
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="holy-card p-4 block hover:border-[--color-coach] transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-display font-medium text-[--color-ink] leading-tight">
                  {p.title}
                </div>
                <span className="text-[--color-ink-dim] text-xs shrink-0">↗</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-[--color-ink-dim] mt-1 font-semibold">
                {p.hosts}
              </div>
              <p className="text-xs text-[--color-ink-mid] mt-2 leading-snug">{p.blurb}</p>
              <div className="flex flex-wrap gap-1 mt-2.5">
                {p.phases.map((ph) => (
                  <span
                    key={ph}
                    className="text-[9px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full bg-[--color-coach-tint] text-[--color-coach] font-semibold"
                  >
                    {PHASE_LABELS[ph]}
                  </span>
                ))}
              </div>
            </a>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-[--color-ink-dim] mt-3 italic">
        One per long-run. Notes go in <code>your notes vault</code> —
        the Sunday knowledge sync mirrors them back here.
      </p>
    </section>
  );
}

// ---- Paperclip AI lessons ------------------------------------------------

/**
 * Surfaces the four lessons from `1. Knowledge/Build Docs/PAPERCLIP_LEARNINGS.md`
 * — the alignment-theory spine of why Holy is a swarm of four agents and
 * not a single marathon-PB-maximiser. Collapsed by default; expand to read.
 */
const PAPERCLIP_LESSONS: Array<{ title: string; body: string; mapping: string }> = [
  {
    title: "1 · Single-objective optimisation breaks the operator",
    body: "A pure marathon-PB-maximiser would push 90 km/wk through crashed HRV and skip family dinners for protein timing. The goal isn't wrong — the optimisation function is.",
    mapping: "Holy applies: Coach owns performance, but Doc / Mind / Nutri have veto power on rest, stress, fuelling.",
  },
  {
    title: "2 · Counter-pressures must be specified, not implicit",
    body: "If you don't define what *not* to optimise away, the agent will optimise it away. Health, joy, sleep, family — none of these defend themselves.",
    mapping: "Holy applies: explicit guardrails in CLAUDE.md (no diagnoses, weight is a trend, rest is productive, no guilt).",
  },
  {
    title: "3 · Multiple agents > one agent with rules",
    body: "A single agent with a long list of guardrails still optimises through them when the goal pulls hard enough. Separate agents with separate goals create real friction.",
    mapping: "Holy applies: four agents (Coach / Nutri / Doc / Mind) with distinct DNAs — not one Coach with 'don't forget recovery'.",
  },
  {
    title: "4 · The orchestrator must speak last",
    body: "Even with multiple agents, someone has to integrate the read. If the orchestrator just averages, the loudest signal wins. They have to *judge*.",
    mapping: "Holy applies: Coach synthesises Nutri / Doc / Mind input — quotes them, then makes the call.",
  },
];

function PaperclipCard() {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <h3 className="font-display text-base font-medium text-[--color-ink] mb-3 flex items-center gap-2">
        <Paperclip className="w-4 h-4" style={{ color: "var(--color-mind)" }} />
        Paperclip AI · why Holy is a swarm
      </h3>
      <div
        className="holy-card p-5"
        style={{ borderColor: "var(--color-mind-soft)", background: "var(--color-mind-tint)" }}
      >
        <p className="text-sm text-[--color-ink] leading-relaxed">
          The <em>Paperclip Maximizer</em> (Bostrom 2003) is a thought experiment about
          what happens when you give an AI one unbounded goal and no counter-
          pressures. A naive marathon-PB AI would do exactly that to the athlete's
          life. <strong>Holy is built as four agents with distinct goals so the
          optimisation never collapses to one number.</strong>
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-3 text-[10px] uppercase tracking-[0.16em] font-semibold"
          style={{ color: "var(--color-mind)" }}
          aria-expanded={open}
        >
          {open ? "▴ hide the four lessons" : "▾ show the four lessons"}
        </button>

        {open && (
          <ul className="mt-4 space-y-3">
            {PAPERCLIP_LESSONS.map((l) => (
              <li
                key={l.title}
                className="rounded-lg p-3 bg-[--color-surface] border border-[--color-border]"
              >
                <div className="font-display font-semibold text-[--color-ink] text-sm">
                  {l.title}
                </div>
                <p className="text-xs text-[--color-ink-mid] mt-1.5 leading-relaxed">
                  {l.body}
                </p>
                <p
                  className="text-[11px] mt-2 leading-relaxed"
                  style={{ color: "var(--color-mind)" }}
                >
                  → {l.mapping}
                </p>
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] text-[--color-ink-dim] mt-4 italic">
          Source: <code>1. Knowledge/Build Docs/PAPERCLIP_LEARNINGS.md</code>
        </p>
      </div>
    </section>
  );
}
