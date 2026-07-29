import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Flag, Footprints, Trophy, Activity, Apple, Brain } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { raceStatus, dailyRaceCue, longRunsRemaining, SESSIONS_GOAL, BUILD_START_ISO } from "@/lib/race";
import { AGENTS } from "@/components/AgentAvatar";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/db";
import { AgentTeamCard } from "@/components/AgentAvatar";
import { PhaseRoad } from "@/components/PhaseRoad";
import { sanitizeInterview } from "@/lib/sanitize";
import { APP_NAME, RACE_NAME, RACE_DATE } from "@/lib/config";

type Activity = Database["public"]["Tables"]["activities"]["Row"];
type TuneUp = Database["public"]["Tables"]["tune_up_races"]["Row"];
type CheckIn = Database["public"]["Tables"]["check_ins"]["Row"];
type Score = Database["public"]["Tables"]["scores"]["Row"];

const NOTEBOOK_LM_URL = import.meta.env.VITE_NOTEBOOK_LM_URL ?? "";

export function Home() {
  const status = raceStatus();
  const longRunsLeft = longRunsRemaining();
  const [runs, setRuns] = useState<Activity[]>([]);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [tuneUps, setTuneUps] = useState<TuneUp[]>([]);
  const [latestCheckin, setLatestCheckin] = useState<CheckIn | null>(null);
  const [recentScores, setRecentScores] = useState<Score[]>([]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const [actsRes, allActsRes, tuneRes, ciRes, scoreRes] = await Promise.all([
      // Only count runs from the build start toward the session goal.
      // Earlier runs are pre-build and would dilute the tracker.
      supabase
        .from("activities")
        .select("*")
        .in("type", ["Run", "TrailRun", "VirtualRun", "Race"])
        .gte("date", BUILD_START_ISO)
        .order("date", { ascending: true }),
      // All activity types (runs + strength/Hyrox) for the active-days heatmap.
      supabase
        .from("activities")
        .select("*")
        .gte("date", BUILD_START_ISO)
        .order("date", { ascending: true }),
      supabase
        .from("tune_up_races")
        .select("*")
        .gte("date", new Date().toISOString().slice(0, 10))
        .order("date", { ascending: true }),
      supabase
        .from("check_ins")
        .select("*")
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Pull 30 days so we can compute the "+N vs last week" delta on VO₂max.
      supabase
        .from("scores")
        .select("*")
        .order("date", { ascending: false })
        .limit(30),
    ]);
    setRuns(actsRes.data ?? []);
    setAllActivities(allActsRes.data ?? []);
    setTuneUps(tuneRes.data ?? []);
    setLatestCheckin(ciRes.data ?? null);
    // Keep desc order — computeFitness expects most-recent-first.
    setRecentScores(scoreRes.data ?? []);
  }

  const sessionsDone = runs.length;
  const sessionsPct = Math.round((sessionsDone / SESSIONS_GOAL) * 100);

  const todayIso = new Date().toISOString().slice(0, 10);
  const microActions = useMemo(
    () => parseMicroActions(latestCheckin),
    [latestCheckin],
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* HERO */}
      <section className="holy-card-elevated gradient-hero p-6 sm:p-10 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-8">
          <div>
            <p
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-semibold mb-3 px-3 py-1 rounded-full"
              style={{ background: "var(--color-race-soft)", color: "var(--color-race)" }}
            >
              <Flag className="w-3.5 h-3.5" />
              {APP_NAME}
            </p>
            <h1 className="font-display text-5xl sm:text-7xl font-bold text-[--color-ink] leading-[0.95] tabular">
              {status.daysToRace}
              <span className="text-[--color-ink-mid] font-light text-2xl sm:text-3xl ml-3">
                days
              </span>
            </h1>
            <p className="text-[--color-ink-mid] text-sm mt-3">
              {RACE_NAME} · {format(RACE_DATE, "EEE d MMM yyyy")}
            </p>
            <p className="text-[--color-ink-dim] text-[11px] uppercase tracking-[0.18em] mt-1.5 font-semibold">
              Today · {format(new Date(), "EEEE d MMMM yyyy")}
            </p>
          </div>

          {/* Long-run + sessions counters */}
          <div className="flex gap-3">
            <CounterChip
              icon={<Footprints className="w-4 h-4" />}
              value={longRunsLeft.toString()}
              label="long runs left"
              tint="coach"
            />
            <CounterChip
              icon={<Trophy className="w-4 h-4" />}
              value={`${sessionsDone}/${SESSIONS_GOAL}`}
              label={`${sessionsPct}% to ${SESSIONS_GOAL}`}
              tint="accent"
            />
          </div>
        </div>

        {/* The phase road — connected, with current position */}
        <PhaseRoad status={status} />

        {/* Mind's daily cue — single anchoring line */}
        <div
          className="mt-6 sm:mt-8 px-4 py-3 rounded-xl flex items-center gap-3"
          style={{ background: AGENTS.mind.hueTint, borderLeft: `3px solid ${AGENTS.mind.hue}` }}
        >
          <span
            className="text-[10px] uppercase tracking-[0.18em] font-bold shrink-0"
            style={{ color: AGENTS.mind.hue }}
          >
            Mind today
          </span>
          <span className="text-sm text-[--color-ink] font-medium italic">
            "{dailyRaceCue(status.daysToRace)}"
          </span>
        </div>
      </section>

      {/* THE SWARM — agent team intro */}
      <section>
        <div className="flex items-baseline justify-between mb-3 sm:mb-4">
          <h2 className="font-display text-lg sm:text-xl font-semibold text-[--color-ink]">
            Your team
          </h2>
          <span className="text-xs text-[--color-ink-dim]">
            Coach leads · calls Nutri / Doc / Mind when needed
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <AgentTeamCard agent="coach" />
          <AgentTeamCard agent="nutri" />
          <AgentTeamCard agent="doc" />
          <AgentTeamCard agent="mind" />
        </div>
      </section>

      {/* Tune-up races */}
      {tuneUps.length > 0 && (
        <section>
          <SectionTitle>Tune-up races</SectionTitle>
          <div className="holy-card px-3 py-1 divide-y divide-[--color-border]">
            {tuneUps.map((t) => (
              <TuneUpRow key={t.id} race={t} />
            ))}
          </div>
        </section>
      )}

      {/* Today's micro-actions + 100-sessions heatmap, side-by-side on desktop.
          The single-number Health Score was unreliable (often 0 when overnight
          sync hadn't fired) and didn't tell you what to *do* — replaced with
          the three concrete actions Coach already pushes in the morning brief. */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-1">
          <SectionTitle>Today's micro-actions</SectionTitle>
          <MicroActionsCard
            actions={microActions}
            checkinDate={latestCheckin?.date ?? null}
            todayIso={todayIso}
            fitness={computeFitness(recentScores)}
          />
        </div>

        <div className="lg:col-span-2">
          <SectionTitle>100-session tracker</SectionTitle>
          <SessionsHeatmap runs={allActivities} />
        </div>
      </section>

      {/* Latest brief */}
      {latestCheckin && (
        <section>
          <SectionTitle>Holy says…</SectionTitle>
          <div className="holy-card p-5 sm:p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-[--color-ink-dim] mb-2 font-semibold">
              {format(new Date(latestCheckin.date), "EEEE d MMMM")}
            </p>
            <p className="text-[--color-ink] leading-relaxed text-sm sm:text-base">
              {latestCheckin.coach_read ?? excerpt(latestCheckin.content_md)}
            </p>
            <Link
              to="/journal"
              className="inline-block mt-4 text-xs uppercase tracking-[0.18em] text-[--color-accent] hover:text-[--color-accent-deep] font-semibold"
            >
              Read journal →
            </Link>
          </div>
        </section>
      )}

      {/* NotebookLM podcast card */}
      {NOTEBOOK_LM_URL && (
        <section>
          <SectionTitle>Listen — 10 marathons retrospective</SectionTitle>
          <a
            href={NOTEBOOK_LM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="holy-card p-5 sm:p-6 flex items-center gap-4 hover:shadow-[var(--shadow-2)] transition"
          >
            <div
              className="w-12 h-12 rounded-full grid place-items-center text-white text-lg"
              style={{ background: "var(--color-race)" }}
            >
              ▶
            </div>
            <div className="flex-1">
              <div className="font-display font-semibold text-[--color-ink]">
                10 marathons, what they taught me
              </div>
              <div className="text-xs text-[--color-ink-mid] mt-0.5">
                NotebookLM podcast · open in new tab
              </div>
            </div>
            <span className="text-[--color-ink-dim] text-sm">↗</span>
          </a>
        </section>
      )}
    </div>
  );
}

// -------------------------- subcomponents --------------------------------

type Tint = "coach" | "nutri" | "doc" | "accent";
const TINTS: Record<Tint, { bg: string; fg: string }> = {
  coach: { bg: "var(--color-coach-soft)", fg: "var(--color-coach)" },
  nutri: { bg: "var(--color-nutri-soft)", fg: "var(--color-nutri)" },
  doc: { bg: "var(--color-doc-soft)", fg: "var(--color-doc)" },
  accent: { bg: "var(--color-accent-soft)", fg: "var(--color-accent-deep)" },
};

function CounterChip({
  icon,
  value,
  label,
  tint,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  tint: Tint;
}) {
  const t = TINTS[tint];
  return (
    <div
      className="flex flex-col items-start gap-1 px-4 py-3 rounded-xl border"
      style={{ background: t.bg, borderColor: t.bg, color: t.fg }}
    >
      <div className="flex items-center gap-1.5">{icon}</div>
      <div className="font-display text-xl font-bold tabular">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.14em] font-semibold opacity-90">
        {label}
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (!values.length || values.every((v) => !v)) {
    return (
      <div className="h-8 mt-3 grid place-items-center text-[10px] text-[--color-ink-dim] uppercase tracking-[0.16em]">
        no data yet
      </div>
    );
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const points = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - ((v - min) / Math.max(max - min, 1)) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-10 mt-3">
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-coach)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TuneUpRow({ race }: { race: TuneUp }) {
  const days = differenceInCalendarDays(new Date(race.date), new Date());
  const isPast = days < 0;
  const tint = race.distance_km <= 10 ? "coach" : "nutri";
  const t = TINTS[tint as Tint];
  const url = race.link ?? race.notes?.match(/https?:\/\/\S+/)?.[0] ?? null;
  const TitleTag = url ? "a" : "div";
  const titleProps = url
    ? { href: url, target: "_blank", rel: "noopener noreferrer" as const }
    : {};
  return (
    <div
      className={`py-1.5 flex items-center justify-between gap-3 ${
        isPast ? "opacity-55" : ""
      }`}
    >
      <TitleTag
        {...titleProps}
        className={`text-xs sm:text-sm font-medium text-[--color-ink] truncate min-w-0 flex-1 ${
          url ? "hover:underline decoration-2 underline-offset-4" : ""
        } ${isPast ? "line-through decoration-1" : ""}`}
      >
        {race.label ?? `${race.distance_km} km`}
        {url ? <span className="ml-1 text-[--color-ink-mid] text-[10px]">↗</span> : null}
      </TitleTag>
      <span className="text-[11px] text-[--color-ink-dim] whitespace-nowrap shrink-0 tabular">
        {format(new Date(race.date), "d MMM")} · {race.distance_km} km
      </span>
      {isPast ? (
        <span
          className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] font-semibold shrink-0 bg-[--color-surface-2] text-[--color-ink-mid]"
          aria-label="Race completed"
        >
          ✓ done
        </span>
      ) : (
        <span
          className="rounded px-1.5 py-0.5 text-[11px] font-bold tabular shrink-0 leading-none"
          style={{ background: t.bg, color: t.fg }}
        >
          {days}
          <span className="text-[9px] uppercase tracking-[0.1em] opacity-90 ml-0.5">d</span>
        </span>
      )}
    </div>
  );
}

function SessionsHeatmap({ runs }: { runs: Activity[] }) {
  // Grid starts on Fri 1 May 2026 (build start) — matches coachPlan BUILD_START.
  // 21 weeks × 7 days takes us through race day (Sun 27 Sept).
  const start = new Date(2026, 4, 1);
  const WEEKS = 21;
  const todayIso = new Date().toISOString().slice(0, 10);
  const cells: Array<{ date: string; intensity: number; km: number; active: boolean }> = [];
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      const iso = day.toISOString().slice(0, 10);
      const dayActs = runs.filter((r) => r.date === iso);
      const km = dayActs.reduce((s, r) => s + (r.distance_km ?? 0), 0);
      const active = dayActs.length > 0;
      let intensity = 0;
      if (km > 0) {
        intensity = km > 25 ? 4 : km > 15 ? 3 : km > 8 ? 2 : 1;
      } else if (active) {
        intensity = 1; // strength/Hyrox with no distance
      }
      cells.push({ date: iso, intensity, km, active });
    }
  }

  // Per-week active-day counts (only weeks that have at least 1 past day)
  const weekActiveDays: Array<{ count: number; total: number }> = Array.from(
    { length: WEEKS },
    (_, w) => {
      const weekCells = cells.slice(w * 7, w * 7 + 7);
      const pastCells = weekCells.filter((c) => c.date <= todayIso);
      return { count: pastCells.filter((c) => c.active).length, total: pastCells.length };
    },
  );

  const colours = [
    "var(--color-surface-2)",
    "color-mix(in oklab, var(--color-coach) 35%, white)",
    "color-mix(in oklab, var(--color-coach) 60%, white)",
    "color-mix(in oklab, var(--color-coach) 80%, white)",
    "var(--color-coach)",
  ];
  return (
    <div className="holy-card p-4 sm:p-5 overflow-x-auto">
      <div className="grid grid-rows-7 grid-flow-col gap-1 min-w-max">
        {Array.from({ length: 7 }).map((_, dayOfWeek) =>
          Array.from({ length: WEEKS }).map((_, weekIdx) => {
            const cell = cells[weekIdx * 7 + dayOfWeek];
            return (
              <div
                key={`${weekIdx}-${dayOfWeek}`}
                title={
                  cell.km > 0
                    ? `${cell.date} · ${cell.km.toFixed(1)} km`
                    : cell.active
                    ? `${cell.date} · active`
                    : `${cell.date} · rest`
                }
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm"
                style={{
                  gridRow: dayOfWeek + 1,
                  gridColumn: weekIdx + 1,
                  background: colours[cell.intensity],
                }}
              />
            );
          }),
        )}
      </div>
      {/* Per-week active-day labels */}
      <div className="grid grid-flow-col gap-1 min-w-max mt-1.5">
        {Array.from({ length: WEEKS }).map((_, w) => {
          const { count, total } = weekActiveDays[w];
          if (total === 0) return <div key={w} className="w-3.5 sm:w-4" />;
          return (
            <div
              key={w}
              className="w-3.5 sm:w-4 text-center tabular-nums leading-none"
              style={{ fontSize: 7, color: "var(--color-ink-dim)" }}
              title={`Wk ${w + 1}: ${count}/${total} active days`}
            >
              {count}/{total}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[10px] uppercase tracking-[0.16em] text-[--color-ink-dim] font-semibold">
        <span>less</span>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="w-3 h-3 rounded-sm"
            style={{ background: colours[i] }}
          />
        ))}
        <span>more</span>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-lg sm:text-xl font-semibold text-[--color-ink] mb-3 sm:mb-4">
      {children}
    </h2>
  );
}

function excerpt(md: string, maxChars = 220) {
  const text = md.replace(/^---[\s\S]*?---/, "").replace(/[#>*_`]/g, "").trim();
  return text.length > maxChars ? text.slice(0, maxChars).trim() + "…" : text;
}

// ---- fitness summary -----------------------------------------------------

/**
 * The fitness number we surface on Home. Prefer Garmin VO₂max (a real
 * physiological estimate) when present in `scores.vo2max`; otherwise fall
 * back to a 7-day rolling running km — still a coherent "are you fitter
 * this week" signal even before the watch settles on a VO₂max.
 *
 * `delta` compares the latest value against the value ~7 days earlier so
 * You see "+2 vs last week" style progress at a glance.
 */
type FitnessSummary = {
  label: string;             // "VO₂max" or "weekly km"
  current: number | null;
  delta: number | null;
  spark: number[];
};

function computeFitness(scores: Score[]): FitnessSummary {
  // `scores` is most-recent-first (we asked Supabase for desc).
  const vo2 = scores.map((s) => s.vo2max).filter((v): v is number => typeof v === "number");
  if (vo2.length >= 2) {
    const current = vo2[0];
    const lastWeek = vo2[Math.min(vo2.length - 1, 7)];
    const delta = current - lastWeek;
    // Sparkline: oldest → newest, so reverse.
    return {
      label: "VO₂max",
      current,
      delta: Math.round(delta * 10) / 10,
      spark: [...vo2].reverse(),
    };
  }
  // Fallback: weekly km from the score row's training_load if present.
  const km = scores
    .map((s) => (s as unknown as { weekly_km?: number | null }).weekly_km ?? null)
    .filter((v): v is number => typeof v === "number");
  if (km.length >= 1) {
    const current = km[0];
    const lastWeek = km[Math.min(km.length - 1, 7)] ?? current;
    return {
      label: "weekly km",
      current,
      delta: Math.round((current - lastWeek) * 10) / 10,
      spark: [...km].reverse(),
    };
  }
  return { label: "VO₂max", current: null, delta: null, spark: [] };
}

// ---- micro-actions parsing -----------------------------------------------

type MicroActions = {
  movement: string | null;
  nutrition: string | null;
  wellbeing: string | null;
};

/**
 * Resolve today's three micro-actions. Prefers the structured `micro_actions`
 * jsonb column populated by holy_supabase.push_checkin (positional:
 * 0=movement, 1=nutrition, 2=wellbeing — matches Coach's brief convention).
 * Falls back to parsing the markdown when the column is missing.
 */
function parseMicroActions(checkin: CheckIn | null): MicroActions {
  const empty = { movement: null, nutrition: null, wellbeing: null };
  if (!checkin) return empty;
  const arr = checkin.micro_actions as unknown;
  if (Array.isArray(arr) && arr.length >= 1) {
    return {
      movement: typeof arr[0] === "string" ? arr[0] : null,
      nutrition: typeof arr[1] === "string" ? arr[1] : null,
      wellbeing: typeof arr[2] === "string" ? arr[2] : null,
    };
  }
  return parseMicroActionsFromText(checkin.coach_read ?? checkin.content_md ?? null);
}

function parseMicroActionsFromText(md: string | null | undefined): MicroActions {
  const empty = { movement: null, nutrition: null, wellbeing: null };
  if (!md) return empty;
  const flat = md.replace(/\r/g, "");
  // 1) Try labelled form: **Movement:** … / Nutrition: … / Wellbeing: …
  const grab = (label: string) => {
    const re = new RegExp(
      `(?:\\*\\*)?${label}(?:\\*\\*)?\\s*[:—-]\\s*([\\s\\S]*?)(?=\\n\\s*(?:\\*\\*)?(?:Movement|Nutrition|Wellbeing|Today|—|\\d+\\.)|\\n\\n|$)`,
      "i",
    );
    const m = flat.match(re);
    if (!m) return null;
    return m[1].replace(/\s+/g, " ").trim() || null;
  };
  const labelled = {
    movement: grab("Movement"),
    nutrition: grab("Nutrition"),
    wellbeing: grab("Wellbeing"),
  };
  if (labelled.movement || labelled.nutrition || labelled.wellbeing) return labelled;
  // 2) Fall back to numbered list under "micro-actions" heading.
  const m = flat.match(/micro-actions?[^\n]*\n([\s\S]+)/i);
  if (!m) return empty;
  const lines = m[1].split("\n").map((l) => l.trim()).filter(Boolean);
  const items: string[] = [];
  for (const l of lines) {
    const mm = l.match(/^(?:\d+[.)]|[-*])\s+(.+)$/);
    if (mm) items.push(mm[1].trim());
    else if (items.length) break;
    if (items.length >= 3) break;
  }
  return {
    movement: items[0] ?? null,
    nutrition: items[1] ?? null,
    wellbeing: items[2] ?? null,
  };
}

// ---- micro-actions card --------------------------------------------------

function MicroActionsCard({
  actions,
  checkinDate,
  todayIso,
  fitness,
}: {
  actions: MicroActions;
  checkinDate: string | null;
  todayIso: string;
  fitness: FitnessSummary;
}) {
  const stale = checkinDate !== null && checkinDate !== todayIso;
  const ageDays = checkinDate
    ? differenceInCalendarDays(new Date(todayIso), new Date(checkinDate))
    : null;
  const hasAny = actions.movement || actions.nutrition || actions.wellbeing;

  const rows: Array<{
    key: keyof MicroActions;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    tint: { bg: string; fg: string };
  }> = [
    { key: "movement", label: "Movement", Icon: Activity, tint: TINTS.coach },
    { key: "nutrition", label: "Nutrition", Icon: Apple, tint: TINTS.nutri },
    {
      key: "wellbeing",
      label: "Wellbeing",
      Icon: Brain,
      tint: { bg: "var(--color-mind-soft)", fg: "var(--color-mind)" },
    },
  ];

  return (
    <div className="holy-card p-5">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div className="text-[11px] uppercase tracking-[0.16em] text-[--color-ink-dim]">
          {checkinDate
            ? format(new Date(checkinDate), "EEEE d MMMM")
            : "Today"}
        </div>
        {stale && ageDays !== null && (
          <span
            className="text-[10px] uppercase tracking-[0.14em] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: "color-mix(in oklab, var(--color-warn) 14%, transparent)",
              color: "var(--color-warn)",
            }}
          >
            {ageDays}d old
          </span>
        )}
      </div>

      {hasAny ? (
        <ul className="space-y-3">
          {rows.map(({ key, label, Icon, tint }) => {
            const text = actions[key];
            if (!text) return null;
            return (
              <li key={key} className="flex gap-3">
                <span
                  className="shrink-0 w-7 h-7 rounded-full grid place-items-center"
                  style={{ background: tint.bg, color: tint.fg }}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0">
                  <div
                    className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-0.5"
                    style={{ color: tint.fg }}
                  >
                    {label}
                  </div>
                  <p className="text-sm text-[--color-ink] leading-snug">{sanitizeInterview(text)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="text-sm text-[--color-ink-mid] leading-relaxed">
          Coach hasn't pushed today's brief yet. The morning Shortcut runs at
          07:00 — once it fires, three actions land here.
        </div>
      )}

      {fitness.current !== null && (
        <div className="mt-4 pt-3 border-t border-[--color-border]">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[--color-ink-dim] font-semibold">
              Fitness · {fitness.label}
            </div>
            {fitness.delta !== null && (
              <div
                className="text-[10px] uppercase tracking-[0.14em] font-semibold"
                style={{
                  color:
                    fitness.delta > 0
                      ? "var(--color-coach)"
                      : fitness.delta < 0
                        ? "var(--color-warn)"
                        : "var(--color-ink-dim)",
                }}
              >
                {fitness.delta > 0 ? "+" : ""}
                {fitness.delta.toFixed(fitness.delta % 1 === 0 ? 0 : 1)} vs last week
              </div>
            )}
          </div>
          <div className="flex items-baseline gap-3">
            <div className="font-display text-3xl font-bold tabular text-[--color-ink]">
              {fitness.current.toFixed(fitness.current % 1 === 0 ? 0 : 1)}
            </div>
            {fitness.spark.length > 1 && (
              <div className="flex-1">
                <Sparkline values={fitness.spark} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
