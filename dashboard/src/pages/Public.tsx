import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabase";
import {
  raceStatus,
  buildWeek,
  expectedWeeklyKm,
  RACE_DATE,
  SESSIONS_GOAL,
} from "@/lib/race";
import { AgentAvatar, AgentTeamCard, AGENTS } from "@/components/AgentAvatar";
import type { AgentKey } from "@/components/AgentAvatar";
import { KPIInfo } from "@/components/KPIInfo";
import { sanitizeInterview } from "@/lib/sanitize";
import { rank, fitnessAge, type KPIKey } from "@/lib/percentiles";
import { hydratePublicAge } from "@/lib/profile";
import { APP_NAME, PHOTO_STRIP, RACE_NAME, RACE_SHORT_NAME } from "@/lib/config";

/**
 * Local alias so the null check narrows inside the .map() callback below.
 * TypeScript will not carry narrowing of an imported binding into a closure.
 */
const photoStrip = PHOTO_STRIP;

const WEEKLY_QUOTES: {
  text: string;
  credit: string;
  via: string;
  agentKey: AgentKey;
}[] = [
  { text: "No human is limited.", credit: "Eliud Kipchoge", via: "Coach's north star", agentKey: "coach" },
  { text: "Women are not small men. Stop eating and training like one.", credit: "Dr Stacy Sims", via: "Nutri's foundation", agentKey: "nutri" },
  { text: "The opponent within one's own head is more formidable than the one on the other side.", credit: "Tim Gallwey", via: "Mind's Inner Game", agentKey: "mind" },
  { text: "It is not about the legs; it's about the heart and mind.", credit: "Eliud Kipchoge", via: "Coach's north star", agentKey: "coach" },
  { text: "Run when you can, walk if you have to, crawl if you must — just never give up.", credit: "Dean Karnazes", via: "Coach's playbook", agentKey: "coach" },
  { text: "Fuel the engine. Don't starve it.", credit: "Shalane Flanagan", via: "Nutri's mantra", agentKey: "nutri" },
  { text: "The quality of your attention determines the quality of your performance.", credit: "George Mumford", via: "Mind's lens", agentKey: "mind" },
  { text: "Consistency beats intensity every single time.", credit: "Brad Hudson", via: "Coach's blueprint", agentKey: "coach" },
  { text: "Train smart. Recover smarter.", credit: "Jordan Metzl", via: "Doc's rule", agentKey: "doc" },
  { text: "Hard work beats talent when talent doesn't work hard — but smart work beats both.", credit: "Steve Magness", via: "Mind's edge", agentKey: "mind" },
  { text: "Every morning in Africa, a gazelle wakes up knowing it must run faster than the fastest lion. Every morning a lion wakes up knowing it must outrun the slowest gazelle. It doesn't matter whether you're a lion or a gazelle — when the sun comes up, you'd better be running.", credit: "African proverb", via: "Patrick Sang's tradition", agentKey: "coach" },
  { text: "Iron-rich food is not a supplement. It's a non-negotiable for female distance runners.", credit: "Renee McGregor", via: "Nutri's red line", agentKey: "nutri" },
  { text: "The will to win means nothing if you haven't the will to prepare.", credit: "Juma Ikangaa", via: "Coach's discipline", agentKey: "coach" },
  { text: "Silence your inner critic — it's the loudest noise on race day.", credit: "Lasse Virén", via: "Mind's quiet", agentKey: "mind" },
  { text: "The race always hurts. Expect it to hurt. You don't train so it doesn't hurt. You train so you can tolerate it.", credit: "Renato Canova", via: "Coach's realism", agentKey: "coach" },
  { text: "Sleep is the greatest legal performance-enhancing drug.", credit: "Matthew Walker", via: "Doc's pillar", agentKey: "doc" },
  { text: "Your body hears everything your mind says.", credit: "George Mumford", via: "Mind's lens", agentKey: "mind" },
  { text: "Real food is the best sports nutrition.", credit: "Shalane Flanagan", via: "Nutri's kitchen", agentKey: "nutri" },
  { text: "When you run on the road, you have to be an honest person. You cannot cheat.", credit: "Eliud Kipchoge", via: "Coach's north star", agentKey: "coach" },
  { text: "The miracle isn't that I finished. The miracle is that I had the courage to start.", credit: "John Bingham", via: "Mind's courage", agentKey: "mind" },
];

// Optional social link on the public page. Leave both empty to hide the link.
const INSTAGRAM_URL = import.meta.env.VITE_INSTAGRAM_URL ?? "";
const INSTAGRAM_HANDLE = import.meta.env.VITE_INSTAGRAM_HANDLE ?? "";

interface Totals {
  sessions: number;
  total_km: number;
  longest_run_km: number;
  last_session_date: string | null;
}

interface Week {
  week_start: string;
  sessions: number;
  km: number;
  longest_km: number;
}

interface StrengthWeek {
  week_start: string;
  sessions: number;
  type_label: "hyrox" | "hiit" | "strength";
}

interface LatestVitals {
  // Current (most-recent non-null)
  hrv: number | null;
  rhr: number | null;
  sleep_hours: number | null;
  sleep_score: number | null;
  weight_kg: number | null;
  body_battery: number | null;
  vo2max: number | null;
  body_fat_percent: number | null;
  muscle_mass_kg: number | null;
  grip_kg: number | null;
  grip_r_kg: number | null;
  grip_l_kg: number | null;
  // 7-day rolling averages (28d for grip — weekly test cadence)
  hrv_avg7?: number | null;
  rhr_avg7?: number | null;
  sleep_hours_avg7?: number | null;
  sleep_score_avg7?: number | null;
  weight_kg_avg7?: number | null;
  body_battery_avg7?: number | null;
  vo2max_avg7?: number | null;
  body_fat_percent_avg7?: number | null;
  muscle_mass_kg_avg7?: number | null;
  grip_kg_avg7?: number | null;
  grip_r_kg_avg7?: number | null;
  grip_l_kg_avg7?: number | null;
  // Build-start baseline (first non-null reading on/after BUILD_START_ISO)
  hrv_build_start?: number | null;
  rhr_build_start?: number | null;
  sleep_hours_build_start?: number | null;
  sleep_score_build_start?: number | null;
  weight_kg_build_start?: number | null;
  body_battery_build_start?: number | null;
  vo2max_build_start?: number | null;
  body_fat_percent_build_start?: number | null;
  muscle_mass_kg_build_start?: number | null;
  grip_kg_build_start?: number | null;
  grip_r_kg_build_start?: number | null;
  grip_l_kg_build_start?: number | null;
}

/** Which direction is "good" for each metric. Used to colour the trend chip. */
const METRIC_HIGHER_IS_BETTER: Record<string, boolean> = {
  hrv: true,
  body_battery: true,
  vo2max: true,
  sleep_hours: true,
  sleep_score: true,
  muscle_mass_kg: true,
  grip_kg: true,
  grip_r_kg: true,
  grip_l_kg: true,
  rhr: false,
  weight_kg: false,
  body_fat_percent: false,
};

export function Public() {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [strengthWeeks, setStrengthWeeks] = useState<StrengthWeek[]>([]);
  const [vitals, setVitals] = useState<LatestVitals | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = raceStatus();

  const raceDateLabel = RACE_DATE.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const todayLabel = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).replace(/\//g, ".");

  useEffect(() => {
    Promise.all([
      supabase.from("public_pb_totals").select("*").maybeSingle(),
      supabase.from("public_pb_weeks").select("*").limit(20),
      supabase.from("public_pb_latest_vitals").select("*").maybeSingle(),
      supabase.from("public_pb_strength_weeks").select("*").limit(20),
      // Age in whole years, for the percentile bands and the fitness-age
      // formula. Computation only: never rendered. Requires migration 0018,
      // which is optional -- without it this errors and the percentile chips
      // simply do not render.
      supabase.from("public_pb_age").select("age_years").maybeSingle(),
    ])
      .then(([t, w, v, s, a]) => {
        if (!a.error) {
          hydratePublicAge((a.data as { age_years: number | null } | null)?.age_years ?? null);
        }
        if (t.error) throw t.error;
        if (w.error) throw w.error;
        setTotals(t.data as Totals | null);
        setWeeks((w.data ?? []) as Week[]);
        if (!v.error) setVitals(v.data as LatestVitals | null);
        if (!s.error) setStrengthWeeks((s.data ?? []) as StrengthWeek[]);
      })
      .catch((e) => setError(e.message ?? "Failed to load"));
  }, []);

  const sessionsProgress = totals ? Math.min(100, (totals.sessions / SESSIONS_GOAL) * 100) : 0;

  const currentBuildWeek = buildWeek() ?? 1;
  const quote = WEEKLY_QUOTES[(currentBuildWeek - 1) % WEEKLY_QUOTES.length];

  const weeksChronological = [...weeks].reverse();
  const fieldNoteNumber = String(currentBuildWeek).padStart(3, "0");

  return (
    <div className="field-notes min-h-screen">
      <div className="px-5 sm:px-8 py-10 sm:py-14 max-w-5xl mx-auto">

        {/* ── Top meta strip (T8 motif) ── */}
        <div className="flex items-start justify-between mb-12 sm:mb-16 gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="fn-meta-ink">{todayLabel}</span>
            <span className="fn-meta">·</span>
            <span className="fn-meta-ink">
              {status ? `${RACE_SHORT_NAME} in ${status.daysToRace} days` : APP_NAME}
            </span>
            <span className="fn-meta">·</span>
            <span className="fn-meta-ink">{status?.raceName || "Race"}</span>
            </div>
          <div className="text-right">
            <div className="fn-meta">T0 · Field Notes</div>
            <div className="fn-meta-ink mt-0.5">
              Week {String(currentBuildWeek).padStart(2, "0")}/20
            </div>
          </div>
        </div>

        {/* ── Hero ── */}
        <header className="mb-16 sm:mb-20">
          <div className="fn-hand text-2xl sm:text-3xl mb-3 ml-1">
            coached by AI.
          </div>
          <h1
            className="fn-numeral text-[64px] sm:text-[96px] mb-5"
            style={{ fontWeight: 700, letterSpacing: "-0.025em" }}
          >
            Run by me.
          </h1>
          <p className="fn-prose text-lg sm:text-xl max-w-2xl mb-8">
            Chasing a marathon personal best with four AI
            agents as my coaching crew. This is what that looks like.
          </p>

          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 fn-meta-ink transition hover:opacity-70"
            style={{
              border: "1px solid var(--fn-ink)",
              borderRadius: "2px",
              background: "transparent",
            }}
          >
            <InstagramIcon size={13} />
            Follow the build · {INSTAGRAM_HANDLE}
          </a>
        </header>

        <section className="mb-16 sm:mb-20">
          <div
            className="relative overflow-hidden"
            style={{
              border: "1px solid rgba(28,28,30,0.12)",
              borderRadius: "2px",
              background: "var(--fn-bone)",
            }}
          >
            <video
              src="/media/training-reel.mp4"
              autoPlay
              muted
              loop
              playsInline
              className="w-full block"
              style={{ maxHeight: "70vh", objectFit: "cover" }}
              aria-label="Training reel"
            />
            <div className="absolute top-3 left-4">
              <span className="fn-meta-ink" style={{ background: "var(--fn-limestone)", padding: "4px 8px" }}>
                REC · TRAINING REEL
              </span>
            </div>
            <div className="absolute bottom-3 right-4">
              <span className="fn-hand text-xl">in motion.</span>
            </div>
          </div>
        </section>

        {/* ── The plan ── */}
        <section className="mb-14">
          <h2 className="fn-numeral text-3xl sm:text-4xl mb-3" style={{ fontWeight: 600 }}>
            The plan.
          </h2>
          <p className="fn-prose text-lg sm:text-xl max-w-2xl">
            100 sessions. 20 weeks. Two tune-up races: a 10 km in mid-July
            and a half-marathon in mid-August. The block ends on{" "}
            <span className="fn-accent" style={{ fontWeight: 600 }}>{raceDateLabel}</span> — the {RACE_NAME}.
            Not just finishing. <em>Chasing a PB.</em>
          </p>
        </section>

        {/* ── The crew ── */}
        <section className="mb-16">
          <h2 className="fn-numeral text-3xl sm:text-4xl mb-2" style={{ fontWeight: 600 }}>
            The crew.
          </h2>
          <p className="fn-prose text-base mb-6 max-w-2xl">
            Four AI agents. One marathon. Each specialised. All talking to each other.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["coach", "nutri", "doc", "mind"] as const).map((key) => (
              <AgentTeamCard key={key} agent={key} alwaysOpen />
            ))}
          </div>
          <div className="fn-meta mt-4 text-right">
            Holy swarm · built on Claude Sonnet
          </div>
        </section>

        <section className="mb-14 sm:mb-20 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="fn-section-label fn-pavement">Countdown</span>
          </div>

          <div className="fn-hand text-xl sm:text-2xl mb-4">
            {status.daysToRace > 0 ? "build begins quiet." : "race week."}
          </div>

          <div
            className="fn-numeral mx-auto"
            style={{
              fontSize: "clamp(140px, 28vw, 280px)",
              lineHeight: 0.88,
            }}
          >
            {status.daysToRace > 0 ? status.daysToRace : Math.abs(status.daysToRace)}
          </div>

          <div className="flex items-center justify-center gap-3 mt-5 mb-2">
            <span className="fn-section-label fn-pavement">
              {status.daysToRace > 0 ? "days to race day" : status.daysToRace === 0 ? "race day" : "days since race day"}
            </span>
          </div>

          <div className="fn-meta mt-4">
            Phase {status.phase} · {raceDateLabel}
          </div>

          <div className="max-w-md mx-auto mt-6">
            <div
              className="h-px w-full"
              style={{ background: "rgba(28,28,30,0.15)" }}
            >
              <div
                className="h-px transition-all duration-700"
                style={{
                  width: `${Math.max(5, status.phaseProgressPct)}%`,
                  background: "var(--fn-accent)",
                  height: "2px",
                  marginTop: "-0.5px",
                }}
              />
            </div>
            <div className="fn-meta mt-2 text-right">
              {status.phaseProgressPct.toFixed(0)}% through {status.phase}
            </div>
          </div>
        </section>

        {/*
          Optional photo strip, from config/race.json. Hidden entirely when
          photoStrip is null, which is how it ships: the images live under
          dashboard/public/ and .gitignore excludes image files wholesale, so
          no fork inherits anyone's photos. Every string here used to be
          hardcoded with one athlete's races and cities.
        */}
        {photoStrip && (
          <section className="mb-16 sm:mb-20">
            <div className="flex items-end justify-between mb-5 gap-3 flex-wrap">
              <div>
                <div className="fn-meta mb-1">{photoStrip.eyebrow}</div>
                <h2 className="fn-numeral text-3xl sm:text-4xl" style={{ fontWeight: 600 }}>
                  {photoStrip.heading}
                </h2>
              </div>
              <div className="fn-hand text-lg" style={{ color: "var(--fn-terracotta)" }}>
                {photoStrip.aside}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[1, 2, 3].map((n) => (
                <figure
                  key={n}
                  className="relative overflow-hidden aspect-[4/5]"
                  style={{
                    border: "1px solid rgba(28,28,30,0.10)",
                    borderRadius: "2px",
                    background: "var(--fn-bone)",
                  }}
                >
                  <img
                    src={`/${photoStrip.mediaDir}/0${n}.jpg`}
                    alt={`${photoStrip.eyebrow}, frame ${n}`}
                    loading="lazy"
                    className="w-full h-full"
                    style={{ objectFit: "cover", display: "block" }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                  <figcaption
                    className="absolute bottom-2 left-2 fn-footnote"
                    style={{
                      background: "var(--fn-limestone)",
                      padding: "2px 6px",
                    }}
                  >
                    N°{String(n).padStart(3, "0")}
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="fn-meta mt-3 text-right">
              {photoStrip.caption}
            </div>
          </section>
        )}

        {/* ── Weekly quote — T2 motif ── */}
        {(() => {
          const a = AGENTS[quote.agentKey];
          return (
            <section className="mb-14 sm:mb-20 max-w-3xl mx-auto text-center px-2">
              <div className="flex items-center justify-center gap-3 mb-6">
                <span className="fn-section-label fn-pavement">Week {currentBuildWeek} · Field Note</span>
              </div>
              <blockquote>
                <p className="fn-quote text-2xl sm:text-3xl mb-5">
                  "{quote.text}"
                </p>
                <footer className="flex items-center justify-center gap-2.5">
                  <AgentAvatar agent={quote.agentKey} size={22} />
                  <span className="fn-meta-ink">{quote.credit}</span>
                  <span className="fn-meta">· {quote.via}</span>
                </footer>
                <div className="fn-hand text-lg mt-4" style={{ color: a.hue }}>
                  — via {AGENTS[quote.agentKey].name}.
                </div>
              </blockquote>
            </section>
          );
        })()}

        {error && (
          <div className="fn-card mb-10 fn-meta-ink" style={{ color: "var(--fn-terracotta)" }}>
            Couldn't load stats: {error}
          </div>
        )}

        {/* ── Today's vitals ── */}
        <section className="mb-14">
          <div className="flex items-end justify-between mb-3 gap-3 flex-wrap">
            <div>
              <div className="fn-meta mb-1">§ I</div>
              <h2 className="fn-numeral text-3xl sm:text-4xl" style={{ fontWeight: 600 }}>
                Today's vitals
              </h2>
            </div>
            <div className="fn-hand text-lg" style={{ color: "var(--fn-terracotta)" }}>
              ranked vs women globally.
            </div>
          </div>
          <p className="fn-meta mb-5" style={{ maxWidth: "38rem", lineHeight: 1.6 }}>
            Performance metrics only — HRV, sleep, body composition, strength.
            No location, no calendar, no personal data. Shared intentionally.
          </p>
          <div className="fn-vitals-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <PublicKPITile label="HRV"          unit="ms"  value={vitals?.hrv}              avg7={vitals?.hrv_avg7}              buildStart={vitals?.hrv_build_start}              metricKey="hrv"              kpi="hrv"              rangeHint="band 91–120" />
            <PublicKPITile label="Resting HR"   unit="bpm" value={vitals?.rhr}              avg7={vitals?.rhr_avg7}              buildStart={vitals?.rhr_build_start}              metricKey="rhr"              kpi="rhr"              rangeHint="target ≤50" />
            <PublicKPITile label="Sleep"        unit="h"   value={vitals?.sleep_hours}      avg7={vitals?.sleep_hours_avg7}      buildStart={vitals?.sleep_hours_build_start}      metricKey="sleep_hours"      kpi="sleep_hours"      rangeHint="floor 7.5h"  digits={1} />
            <PublicKPITile label="Sleep score"  unit=""    value={vitals?.sleep_score}      avg7={vitals?.sleep_score_avg7}      buildStart={vitals?.sleep_score_build_start}      metricKey="sleep_score"                             rangeHint="floor 70" />
            <PublicKPITile label="Weight"       unit="kg"  value={vitals?.weight_kg}        avg7={vitals?.weight_kg_avg7}        buildStart={vitals?.weight_kg_build_start}        metricKey="weight_kg"                               digits={1} />
            <PublicKPITile label="Body Battery" unit=""    value={vitals?.body_battery}     avg7={vitals?.body_battery_avg7}     buildStart={vitals?.body_battery_build_start}     metricKey="body_battery"     kpi="body_battery"     rangeHint="floor 80" />
            <PublicKPITile label="VO₂max"       unit=""    value={vitals?.vo2max}           avg7={vitals?.vo2max_avg7}           buildStart={vitals?.vo2max_build_start}           metricKey="vo2max"           kpi="vo2max"           rangeHint="floor 50"    digits={1} />
            <PublicKPITile label="Body fat"     unit="%"   value={vitals?.body_fat_percent} avg7={vitals?.body_fat_percent_avg7} buildStart={vitals?.body_fat_percent_build_start} metricKey="body_fat_percent" kpi="body_fat_percent"                        digits={1} />
            <PublicKPITile label="Muscle mass"  unit="kg"  value={vitals?.muscle_mass_kg}   avg7={vitals?.muscle_mass_kg_avg7}   buildStart={vitals?.muscle_mass_kg_build_start}   metricKey="muscle_mass_kg"                          digits={1} />
            <GripStrengthPublicTile vitals={vitals} />
            <FitnessAgePublicTile vo2={vitals?.vo2max ?? null} />
          </div>
        </section>

        {/* ── Build stats — T3 Data Card row ── */}
        <section className="mb-14">
          <div className="flex items-end justify-between mb-5 gap-3 flex-wrap">
            <div>
              <div className="fn-meta mb-1">§ II</div>
              <h2 className="fn-numeral text-3xl sm:text-4xl" style={{ fontWeight: 600 }}>
                The build, so far.
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            <Stat
              label="Sessions"
              value={totals ? `${totals.sessions}` : null}
              sub={`of ${SESSIONS_GOAL} goal`}
              accent="var(--fn-accent)"
            />
            <Stat
              label="Total km"
              value={totals ? totals.total_km.toFixed(0) : null}
              sub="this build"
              accent="var(--fn-terracotta)"
            />
            <Stat
              label="Longest run"
              value={totals ? totals.longest_run_km.toFixed(1) : null}
              sub="km"
              accent="var(--fn-coral)"
            />
          </div>

          {/* Sessions progress — hairline */}
          <div className="mt-8">
            <div className="flex items-baseline justify-between mb-2">
              <span className="fn-meta-ink">Sessions to race day</span>
              <span className="fn-meta-ink tabular">
                {totals ? `${totals.sessions}` : "—"} / {SESSIONS_GOAL}
              </span>
            </div>
            <div
              className="w-full"
              style={{ background: "rgba(28,28,30,0.12)", height: "1px" }}
            >
              <div
                className="transition-all duration-700"
                style={{
                  width: `${sessionsProgress}%`,
                  background: "var(--fn-accent)",
                  height: "2px",
                  marginTop: "-0.5px",
                }}
              />
            </div>
            <div className="fn-meta mt-2">
              Goal: {SESSIONS_GOAL} sessions across the 20-week build
            </div>
          </div>
        </section>

        {/* ── Training volume ── */}
        <section className="mb-14">
          <div className="flex items-end justify-between mb-5 gap-3 flex-wrap">
            <div>
              <div className="fn-meta mb-1">§ III</div>
              <h2 className="fn-numeral text-3xl sm:text-4xl" style={{ fontWeight: 600 }}>
                Volume log.
              </h2>
            </div>
            {weeks.length > 0 && (
              <div className="fn-hand text-lg" style={{ color: "var(--fn-terracotta)" }}>
                week by week.
              </div>
            )}
          </div>

          {weeks.length === 0 ? (
            <div className="fn-card text-center py-12">
              <div className="fn-section-label fn-pavement mb-3">Training volume</div>
              <div className="fn-numeral text-4xl sm:text-5xl mb-2" style={{ fontWeight: 700 }}>
                Build starting
              </div>
              <p className="fn-prose text-base">
                First sessions drop the week of 6 May 2026.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <WeekHighlightCard weeks={weeks} weekNum={currentBuildWeek} />
              <KmTrendCard weeks={weeksChronological} weekNum={currentBuildWeek} strengthWeeks={strengthWeeks} />
            </div>
          )}
        </section>

        {/* ── Coach notes — placeholder + request access ── */}
        <CoachNotesSection />

        {/* ── Instagram CTA ── */}
        <section className="mb-14 text-center">
          <div className="fn-hand text-2xl mb-3">stick around.</div>
          <p className="fn-prose text-base mb-5 max-w-md mx-auto">
            New field notes every week. Follow the build on Instagram.
          </p>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 fn-meta-ink transition hover:opacity-70"
            style={{
              border: "1px solid var(--fn-ink)",
              borderRadius: "2px",
            }}
          >
            <InstagramIcon size={13} />
            {INSTAGRAM_HANDLE}
          </a>
        </section>

        {/* ── Field Note footer ── */}
        <footer className="flex items-end justify-between mt-20 pt-6"
          style={{ borderTop: "1px solid rgba(28,28,30,0.12)" }}>
          <div className="fn-footnote">
            {INSTAGRAM_HANDLE ? INSTAGRAM_HANDLE.toUpperCase() : APP_NAME.toUpperCase()}
          </div>
          <div className="fn-footnote text-right">
            Field Note N°{fieldNoteNumber}
            <a
              href="/sign-in"
              className="ml-3 opacity-30 hover:opacity-60 transition-opacity"
              aria-label="Sign in"
            >
              ·
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ─────────────── Sub-components ─────────────── */

function PublicKPITile({
  label,
  unit,
  value,
  avg7,
  buildStart,
  metricKey,
  digits = 0,
  kpi,
  rangeHint,
}: {
  label: string;
  unit: string;
  value: number | null | undefined;
  avg7?: number | null;
  buildStart?: number | null;
  metricKey?: string;
  digits?: number;
  kpi?: KPIKey | "body_battery";
  rangeHint?: string;
}) {
  const loading = value === undefined;
  const v = value ?? null;
  const ranked = kpi && kpi !== "body_battery" && v !== null
    ? rank(kpi as KPIKey, v)
    : null;

  const higherIsBetter = metricKey ? METRIC_HIGHER_IS_BETTER[metricKey] : null;

  // vs build start
  const buildDelta = v !== null && buildStart != null ? v - buildStart : null;
  const buildDir = buildDelta === null ? null : buildDelta > 0.005 ? "up" : buildDelta < -0.005 ? "down" : "flat";
  const buildTone =
    buildDelta === null || higherIsBetter === null || buildDir === "flat"
      ? "var(--fn-pavement)"
      : (buildDir === "up") === higherIsBetter
      ? "var(--color-good)"
      : "var(--color-warn)";

  // vs last 7d avg
  const avg7Delta = v !== null && avg7 != null && avg7 !== 0 ? v - avg7 : null;
  const avg7Pct = avg7Delta !== null && avg7 ? (avg7Delta / avg7) * 100 : null;
  const avg7Tone =
    avg7Delta === null || higherIsBetter === null || (avg7Pct !== null && Math.abs(avg7Pct) < 1.5)
      ? "var(--fn-pavement)"
      : (avg7Delta > 0) === higherIsBetter
      ? "var(--color-good)"
      : "var(--color-warn)";

  const badgeTone = !ranked
    ? "var(--fn-pavement)"
    : ranked.topPct <= 10
    ? "var(--color-good)"
    : ranked.topPct <= 25
    ? "var(--fn-ink)"
    : ranked.percentile < 45
    ? "var(--color-warn)"
    : "var(--fn-pavement)";

  return (
    <div className="fn-card relative min-h-[140px] sm:min-h-[152px]" style={{ padding: "1rem" }}>
      <div className="flex items-start justify-between gap-1">
        <div className="fn-meta">{label}</div>
        {rangeHint && (
          <span
            style={{
              fontFamily: "var(--fn-mono)",
              fontSize: "9px",
              letterSpacing: "0.08em",
              color: "var(--fn-pavement)",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            {rangeHint}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1 mt-2">
        {loading ? (
          <div
            className="h-8 rounded-sm animate-pulse"
            style={{ width: 56, background: "rgba(28,28,30,0.08)" }}
          />
        ) : v === null ? (
          <span className="fn-numeral text-3xl sm:text-4xl fn-pavement">—</span>
        ) : (
          <>
            <span className="fn-numeral text-3xl sm:text-4xl tabular">
              {v.toFixed(digits)}
            </span>
            {unit && <span className="fn-meta ml-1">{unit}</span>}
          </>
        )}
      </div>
      {v !== null && (
        <div className="space-y-0.5 mt-2 mb-6">
          {buildDelta !== null ? (
            <div
              className="flex items-center gap-1"
              style={{ fontFamily: "var(--fn-mono)", fontSize: "10px" }}
            >
              <span style={{ color: buildTone, fontWeight: 600 }}>
                {buildDir === "up" ? "↑" : buildDir === "down" ? "↓" : "→"}
                {buildDir !== "flat" && (
                  <> {buildDelta >= 0 ? "+" : ""}{buildDelta.toFixed(digits)}</>
                )}
              </span>
              <span style={{ color: "var(--fn-pavement)", fontSize: "9px", letterSpacing: "0.06em" }}>
                vs build start
              </span>
            </div>
          ) : (
            <div style={{ fontFamily: "var(--fn-mono)", fontSize: "9px", color: "var(--fn-pavement)" }}>
              build start pending
            </div>
          )}
          {avg7Delta !== null && (
            <div
              className="flex items-center gap-1"
              style={{ fontFamily: "var(--fn-mono)", fontSize: "10px" }}
            >
              <span style={{ color: avg7Tone, fontWeight: 600 }}>
                {avg7Delta >= 0 ? "+" : ""}{avg7Delta.toFixed(digits)}
              </span>
              <span style={{ color: "var(--fn-pavement)", fontSize: "9px", letterSpacing: "0.06em" }}>
                vs last 7d
              </span>
            </div>
          )}
        </div>
      )}
      {(ranked || kpi) && (
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
          {ranked && (
            <span
              title={ranked.label}
              className="inline-flex items-center gap-1 tabular"
              style={{
                fontFamily: "var(--fn-mono)",
                fontSize: "10px",
                letterSpacing: "0.08em",
                color: badgeTone,
                fontWeight: 600,
              }}
            >
              <span style={{ fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.7 }}>
                Top
              </span>
              <span>{ranked.topPct}%</span>
            </span>
          )}
          {kpi && <KPIInfo kpi={kpi} />}
        </div>
      )}
    </div>
  );
}

function GripStrengthPublicTile({ vitals }: { vitals: LatestVitals | null }) {
  const hasRL = vitals?.grip_r_kg != null || vitals?.grip_l_kg != null;
  const r = vitals?.grip_r_kg ?? vitals?.grip_kg ?? null;
  const l = vitals?.grip_l_kg ?? null;
  const avg7R = vitals?.grip_r_kg_avg7 ?? vitals?.grip_kg_avg7 ?? null;
  const buildStartR = vitals?.grip_r_kg_build_start ?? vitals?.grip_kg_build_start ?? null;

  const buildDelta = r !== null && buildStartR !== null ? r - buildStartR : null;
  const buildTone =
    buildDelta === null ? "var(--fn-pavement)"
    : buildDelta > 0.05 ? "var(--color-good)"
    : buildDelta < -0.05 ? "var(--color-warn)"
    : "var(--fn-pavement)";

  const avg7Delta = r !== null && avg7R !== null && avg7R !== 0 ? r - avg7R : null;
  const avg7Pct = avg7Delta !== null && avg7R ? (avg7Delta / avg7R) * 100 : null;
  const avg7Tone =
    avg7Delta === null || (avg7Pct !== null && Math.abs(avg7Pct) < 1.5) ? "var(--fn-pavement)"
    : avg7Delta > 0 ? "var(--color-good)"
    : "var(--color-warn)";

  return (
    <div className="fn-card relative min-h-[140px] sm:min-h-[152px]" style={{ padding: "1rem" }}>
      <div className="flex items-start justify-between gap-1">
        <div className="fn-meta">Grip strength</div>
        <span style={{ fontFamily: "var(--fn-mono)", fontSize: "9px", letterSpacing: "0.08em", color: "var(--fn-pavement)", textTransform: "uppercase" }}>
          weekly test
        </span>
      </div>
      {r === null ? (
        <div className="flex items-baseline gap-1 mt-2">
          <span className="fn-numeral text-3xl sm:text-4xl fn-pavement">—</span>
        </div>
      ) : hasRL && l !== null ? (
        <div className="mt-2 space-y-1">
          <div className="flex items-baseline gap-1.5">
            <span className="fn-numeral text-2xl sm:text-3xl tabular">{r.toFixed(1)}</span>
            <span className="fn-meta">kg R</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="fn-numeral text-2xl sm:text-3xl tabular" style={{ color: "var(--fn-pavement)" }}>{l.toFixed(1)}</span>
            <span className="fn-meta">kg L</span>
          </div>
        </div>
      ) : (
        <div className="flex items-baseline gap-1 mt-2">
          <span className="fn-numeral text-3xl sm:text-4xl tabular">{r.toFixed(1)}</span>
          <span className="fn-meta ml-1">kg</span>
        </div>
      )}
      {r !== null && (
        <div className="space-y-0.5 mt-2 mb-6" style={{ fontFamily: "var(--fn-mono)", fontSize: "10px" }}>
          {buildDelta !== null ? (
            <div className="flex items-center gap-1">
              <span style={{ color: buildTone, fontWeight: 600 }}>
                {buildDelta > 0.05 ? "↑" : buildDelta < -0.05 ? "↓" : "→"}
                {Math.abs(buildDelta) > 0.05 && <> {buildDelta >= 0 ? "+" : ""}{buildDelta.toFixed(1)}</>}
              </span>
              <span style={{ color: "var(--fn-pavement)", fontSize: "9px", letterSpacing: "0.06em" }}>vs build start</span>
            </div>
          ) : (
            <div style={{ fontSize: "9px", color: "var(--fn-pavement)" }}>build start pending</div>
          )}
          {avg7Delta !== null && (
            <div className="flex items-center gap-1">
              <span style={{ color: avg7Tone, fontWeight: 600 }}>
                {avg7Delta >= 0 ? "+" : ""}{avg7Delta.toFixed(1)}
              </span>
              <span style={{ color: "var(--fn-pavement)", fontSize: "9px", letterSpacing: "0.06em" }}>vs last 28d</span>
            </div>
          )}
        </div>
      )}
      <div className="absolute bottom-2.5 right-2.5">
        <KPIInfo kpi="grip_kg" />
      </div>
    </div>
  );
}

function FitnessAgePublicTile({ vo2 }: { vo2: number | null }) {
  const fa = fitnessAge(vo2);
  // No chronological comparison on the public page. Printing "N years younger"
  // beside a fitness age makes the athlete's actual age trivially derivable,
  // which is the same disclosure by arithmetic.
  const delta: number | null = null;
  const tone =
    delta === null
      ? "var(--fn-pavement)"
      : delta >= 5
      ? "var(--color-good)"
      : delta >= 1
      ? "var(--fn-ink)"
      : delta <= -3
      ? "var(--color-warn)"
      : "var(--fn-pavement)";
  return (
    <div className="fn-card relative min-h-[120px] sm:min-h-[132px]" style={{ padding: "1rem" }}>
      <div className="fn-meta">Fitness age</div>
      <div className="flex items-baseline gap-1 mt-2">
        <span className="fn-numeral text-3xl sm:text-4xl tabular">
          {fa ?? <span className="fn-pavement">—</span>}
        </span>
        <span className="fn-meta ml-1">yrs</span>
      </div>
      {delta !== null && (
        <div className="mt-1.5">
          <span
            className="tabular"
            style={{
              fontFamily: "var(--fn-mono)",
              fontSize: "11px",
              fontWeight: 600,
              color: tone,
            }}
          >
            {delta > 0
              ? `>${delta} years younger`
              : delta < 0
              ? `${-delta} years older`
              : "fitness age matches"}
          </span>
        </div>
      )}
      <div className="absolute bottom-2.5 right-2.5">
        <KPIInfo
          kpi="vo2max"
          inline={{
            title: "Fitness age",
            what: "Estimated age from VO₂max. What age the aerobic engine looks like.",
            good: "Younger than chronological = great. Elite endurance women run 10 to 15 yrs younger.",
            source: "Cooper/HUNT inversion, calibrated against Garmin",
          }}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | null;
  sub: string;
  accent?: string;
}) {
  return (
    <div
      className="fn-card text-center relative overflow-hidden"
      style={{
        padding: "1.25rem 0.75rem",
        borderTop: accent ? `2px solid ${accent}` : undefined,
      }}
    >
      <div className="fn-meta mb-2">{label}</div>
      {value === null ? (
        <div
          className="h-10 rounded-sm animate-pulse mx-auto my-1"
          style={{ width: 56, background: "rgba(28,28,30,0.08)" }}
        />
      ) : (
        <div
          className="fn-numeral text-4xl sm:text-5xl tabular"
          style={{ fontWeight: 700, color: accent ?? "var(--fn-ink)" }}
        >
          {value}
        </div>
      )}
      <div className="fn-meta mt-2">{sub}</div>
    </div>
  );
}

function WeekHighlightCard({ weeks, weekNum }: { weeks: Week[]; weekNum: number }) {
  const current = weeks[0];
  const prev = weeks[1] ?? null;
  if (!current) return null;

  const kmDelta = prev ? current.km - prev.km : null;
  const weekLabel = new Date(current.week_start).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  const planned = expectedWeeklyKm(weekNum);
  const vsPlanned = planned !== null ? current.km - planned : null;
  const onTrack = vsPlanned !== null && vsPlanned >= -5;

  const deltaPositive = kmDelta !== null && kmDelta >= 0;
  const deltaColour = deltaPositive ? "var(--fn-accent)" : "var(--fn-terracotta)";

  return (
    <div className="fn-card" style={{ padding: "1.5rem" }}>
      <div className="flex items-start justify-between mb-5 gap-2 flex-wrap">
        <div>
          <div className="fn-meta">This week</div>
          <div className="fn-meta-ink mt-1">w/c {weekLabel}</div>
        </div>
        {kmDelta !== null && (
          <div
            className="inline-flex items-center gap-1.5 tabular"
            style={{
              fontFamily: "var(--fn-mono)",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: deltaColour,
            }}
          >
            {deltaPositive ? "↑" : "↓"} {Math.abs(kmDelta).toFixed(1)} km vs last week
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <WeekStat label="km" value={current.km.toFixed(1)} planned={planned} />
        <WeekStat label={current.sessions === 1 ? "session" : "sessions"} value={String(current.sessions)} />
        <WeekStat label="longest km" value={Math.max(15, current.longest_km).toFixed(1)} />
      </div>

      {planned !== null && (
        <div className="mt-4 pt-3" style={{ borderTop: "1px solid rgba(28,28,30,0.08)" }}>
          <div className="flex items-baseline justify-between fn-meta">
            <span>vs plan ({planned} km target)</span>
            <span
              style={{
                color: onTrack ? "var(--fn-accent)" : "var(--fn-terracotta)",
                fontWeight: 600,
              }}
            >
              {(vsPlanned ?? 0) >= 0 ? "+" : ""}{(vsPlanned ?? 0).toFixed(1)} km
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function WeekStat({ label, value, planned }: { label: string; value: string; planned?: number | null }) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span
          className="fn-numeral text-3xl sm:text-4xl tabular"
          style={{ fontWeight: 700, color: "var(--fn-accent)" }}
        >
          {value}
        </span>
        {planned !== undefined && planned !== null && (
          <span
            className="tabular fn-pavement"
            style={{
              fontFamily: "var(--fn-mono)",
              fontSize: "11px",
              fontWeight: 500,
            }}
          >
            / {planned}
          </span>
        )}
      </div>
      <div className="fn-meta mt-1">{label}</div>
    </div>
  );
}

/**
 * Coach notes — short rotating note from each agent + a CTA for full reports.
 * Pulls live from `public_pb_agent_notes` view (one row per agent_key).
 * Falls back to seed text if the view hasn't been provisioned yet.
 */
function CoachNotesSection() {
  const week = buildWeek() ?? 1;
  const FALLBACK: Record<AgentKey, string[]> = {
    coach: [
      "Volume held this week — base is doing its job. Quality block opens once we clear the next cutback.",
      "Long run climbed clean. No HR drift after kilometre 18. That's the signal we wanted.",
      "Tempo split fell inside target. The aerobic ceiling is moving. Hold the discipline.",
    ],
    nutri: [
      "Iron is steady, ferritin trending the right way. Keep red lentils + sardines twice a week.",
      "Pre-long-run fuel is dialled. Race-day rehearsal stays in the calendar.",
      "Sleep window pushed protein synthesis higher. Don't skip the post-run 25g.",
    ],
    doc: [
      "HRV pattern is healthy. No flags this week. Bloods due in three weeks.",
      "Resting HR sits in the 48–52 range — well within base norms.",
      "Sleep depth recovered after Tuesday's tempo. Monitor Wednesday consistency.",
    ],
    mind: [
      "Pre-session focus quality was up. The mental warm-up is becoming routine.",
      "One slump day this week — handled in 36 hours. That's a skill, not luck.",
      "Race-week framing exercise unlocked. Save it for September 20.",
    ],
  };

  const [liveNotes, setLiveNotes] = useState<Partial<Record<AgentKey, string>>>({});

  useEffect(() => {
    supabase
      .from("public_pb_agent_notes")
      .select("agent_key, note")
      .then(({ data, error }) => {
        if (error || !data) return;
        const map: Partial<Record<AgentKey, string>> = {};
        for (const row of data as { agent_key: string; note: string }[]) {
          if (["coach", "nutri", "doc", "mind"].includes(row.agent_key)) {
            map[row.agent_key as AgentKey] = row.note;
          }
        }
        setLiveNotes(map);
      });
  }, []);

  const note = (k: AgentKey): string =>
    liveNotes[k] ?? FALLBACK[k][(week - 1) % FALLBACK[k].length];

  return (
    <section className="mb-16">
      <div className="fn-meta mb-1">§ VI</div>
      <h2 className="fn-numeral text-3xl sm:text-4xl mb-2" style={{ fontWeight: 600 }}>
        Notes from the crew.
      </h2>
      <p className="fn-prose text-base mb-1">
        One short read per agent. Updated each Monday.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(["coach", "nutri", "doc", "mind"] as AgentKey[]).map((key) => {
          const a = AGENTS[key];
          return (
            <div
              key={key}
              className="fn-card flex gap-3"
              style={{ padding: "1.25rem", borderLeft: `3px solid ${a.hue}` }}
            >
              <AgentAvatar agent={key} size={36} />
              <div className="flex-1">
                <div className="flex items-baseline justify-between mb-1.5 gap-2">
                  <span className="fn-meta-ink">{a.name}</span>
                  <span className="fn-meta">{a.role}</span>
                </div>
                <p className="fn-prose text-[15px] leading-snug">"{sanitizeInterview(note(key))}"</p>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="mt-6 fn-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ padding: "1.25rem 1.5rem", background: "var(--fn-limestone)" }}
      >
        <div>
          <div className="fn-section-label fn-pavement mb-1">Want more?</div>
          <p className="fn-prose text-[15px]">
            The full coaching reports — weekly volumes, fuel logs, sleep curves,
            mind check-ins — are the private side of Holy. DM for a peek.
          </p>
        </div>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 fn-meta-ink transition hover:opacity-70 whitespace-nowrap"
          style={{ border: "1px solid var(--fn-ink)", borderRadius: "2px" }}
        >
          Request access
        </a>
      </div>
    </section>
  );
}

function KmTrendCard({ weeks, weekNum, strengthWeeks }: { weeks: Week[]; weekNum: number; strengthWeeks: StrengthWeek[] }) {
  // Build a lookup: build-week-number → actual km
  const actualByWeek: Record<number, number> = {};
  weeks.forEach((w) => {
    const wn = buildWeek(new Date(w.week_start));
    if (wn !== null) actualByWeek[wn] = w.km;
  });

  // Build a lookup: build-week-number → strength week data
  const strengthByWeek: Record<number, StrengthWeek> = {};
  strengthWeeks.forEach((sw) => {
    const wn = buildWeek(new Date(sw.week_start));
    if (wn !== null) strengthByWeek[wn] = sw;
  });

  // Fixed 7-week window: W(n-3) … W(n+3), clamped to build weeks 1–20
  // Skip past weeks with no actuals (they'd show empty bars)
  const data = [-3, -2, -1, 0, 1, 2, 3]
    .map((offset) => {
      const wn = weekNum + offset;
      if (wn < 1 || wn > 20) return null;
      const isCurrent = offset === 0;
      const isFuture = offset > 0;
      const actual = isFuture ? 0 : (actualByWeek[wn] ?? 0);
      // Drop past weeks with zero actuals (build hasn't started yet for that week)
      if (!isCurrent && !isFuture && actual === 0) return null;
      return {
        label: `W${wn}`,
        actual,
        planned: expectedWeeklyKm(wn) ?? 0,
        isCurrent,
        isFuture,
        wn,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="fn-card" style={{ padding: "1.5rem" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="fn-numeral text-xl sm:text-2xl" style={{ fontWeight: 600 }}>
          km per week
        </h3>
        <span className="fn-section-label fn-accent">Coach</span>
      </div>

      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="28%"
            margin={{ left: -12, right: 4, top: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(28,28,30,0.08)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--fn-pavement)", fontFamily: "var(--fn-mono)" }}
              axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "var(--fn-pavement)", fontFamily: "var(--fn-mono)" }}
              axisLine={false} tickLine={false} width={28} />
            <Tooltip
              contentStyle={{ background: "var(--fn-limestone)", border: "1px solid rgba(28,28,30,0.12)", borderRadius: 2, fontSize: 11, fontFamily: "var(--fn-mono)" }}
              formatter={(v: number, name: string) => [`${v.toFixed(1)} km`, name === "planned" ? "Plan" : "Actual"]}
              labelStyle={{ fontWeight: 600, marginBottom: 2 }}
            />
            <Bar dataKey="planned" name="planned" radius={[1, 1, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.isCurrent ? "rgba(28,28,30,0.25)" : "rgba(28,28,30,0.12)"} />
              ))}
            </Bar>
            <Bar dataKey="actual" name="actual" radius={[2, 2, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.isFuture ? "transparent" : d.isCurrent ? "var(--fn-accent)" : "rgba(51,116,235,0.55)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 mt-3" style={{ fontFamily: "var(--fn-mono)", fontSize: "10px", color: "var(--fn-pavement)" }}>
        <span className="inline-flex items-center gap-1.5">
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "rgba(28,28,30,0.15)" }} />
          plan
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "var(--fn-accent)" }} />
          actual (current wk)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "rgba(51,116,235,0.55)" }} />
          actual (past)
        </span>
      </div>

      {/* Strength / Hyrox session counts per visible week */}
      {data.some((d) => strengthByWeek[d.wn]) && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(28,28,30,0.07)" }}>
          <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ fontFamily: "var(--fn-mono)", fontSize: "10px" }}>
            {data.map((d) => {
              const sw = strengthByWeek[d.wn];
              if (!sw) return null;
              const typeLabel =
                sw.type_label === "hyrox" ? "Hyrox"
                : sw.type_label === "hiit" ? "HIIT"
                : "strength";
              return (
                <span key={d.wn} className="inline-flex items-center gap-1">
                  <span style={{ color: "var(--fn-pavement)" }}>{d.label}</span>
                  <span style={{ color: "var(--fn-ink)", fontWeight: 600 }}>
                    {sw.sessions} × {typeLabel}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


function InstagramIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
