import { useEffect, useState } from "react";
import { Stethoscope } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid as RGrid,
  ComposedChart,
  LabelList,
  Line as RLine,
  ReferenceArea as RArea,
  ReferenceLine,
  ResponsiveContainer as RResponsive,
  Tooltip as RTooltip,
  XAxis as RXAxis,
  YAxis as RYAxis,
} from "recharts";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/db";
import {
  BB_GOOD_FLOOR,
  HRV_BASE_HIGH,
  HRV_BASE_LOW,
  RHR_GOOD_HIGH,
  RHR_GOOD_LOW,
  SLEEP_AMBER_HOURS,
  SLEEP_GOOD_HOURS,
  VO2_GOOD_FLOOR,
  buildInsights,
  computeDelta,
  mostRecent,
} from "@/lib/insights";
import { ExecSummary } from "@/components/ExecSummary";
import { InsightCard } from "@/components/InsightCard";
import { MetricChart } from "@/components/MetricChart";
import { AGENTS } from "@/components/AgentAvatar";
import {
  BMI_CATEGORY_LABEL,
  bmi,
  bmiCategory,
  type BMICategory,
} from "@/lib/profile";
import { KPIInfo } from "@/components/KPIInfo";
import { rank, fitnessAge, KPI_DESCRIPTIONS, type KPIKey } from "@/lib/percentiles";

type DescribedKpi = keyof typeof KPI_DESCRIPTIONS;
const RANKABLE_KPIS = new Set<DescribedKpi>([
  "hrv", "rhr", "vo2max", "sleep_hours",
  "body_fat_percent", "lowest_overnight_hr", "grip_kg",
]);

type Score = Database["public"]["Tables"]["scores"]["Row"];
type Range = 30 | 90 | "build";

import { BUILD_START_ISO } from "@/lib/race";

function rangeSince(r: Range): string {
  if (r === "build") return BUILD_START_ISO;
  const since = new Date();
  since.setDate(since.getDate() - r);
  return since.toISOString().slice(0, 10);
}

export function Vitals() {
  // Single fixed window: the whole training build, anchored at 1 May 2026.
  // Earlier ranges (30/90 d) pulled pre-build noise and diluted the
  // marathon-block read — so the page now only ever shows build progress.
  const range: Range = "build";
  const [rows, setRows] = useState<Score[]>([]);

  useEffect(() => {
    const since = rangeSince(range);
    void supabase
      .from("scores")
      .select("*")
      .gte("date", since)
      .order("date", { ascending: true })
      .then((res) => {
        setRows(res.data ?? []);
      });
  }, [range]);

  // 28-day rolling load (km of running) — what Doc recommended overlaying on
  // VO₂max (matches the physiological lag better than raw long-run km).

  const insights = buildInsights(rows);

  // Build per-metric series with rolling weight average
  const series = rows.map((r, idx) => {
    const window = rows.slice(Math.max(0, idx - 6), idx + 1);
    const weights = window.map((w) => w.weight_kg).filter((v): v is number => typeof v === "number");
    const weightAvg = weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : null;
    return {
      date: r.date,
      hrv: r.hrv,
      rhr: r.rhr,
      sleep_hours: r.sleep_hours,
      sleep_score: r.sleep_score ?? null,
      weight_kg: weightAvg ? Math.round(weightAvg * 10) / 10 : null,
      body_battery: r.body_battery,
      vo2max: r.vo2max,
      body_fat_percent: r.body_fat_percent,
      muscle_mass_kg: r.muscle_mass_kg,
      grip_kg: r.grip_kg,
      grip_r_kg: r.grip_r_kg,
      grip_l_kg: r.grip_l_kg,
    };
  });

  // Stale weight alert: last reading more than 7 days ago
  const lastWeightDate = (() => {
    for (let i = rows.length - 1; i >= 0; i--) {
      if (typeof rows[i].weight_kg === "number") return rows[i].date;
    }
    return null;
  })();
  const weightStaleDays = lastWeightDate
    ? differenceInCalendarDays(new Date(), new Date(lastWeightDate))
    : null;
  const weightStale = weightStaleDays !== null && weightStaleDays > 7;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader voice="doc" Icon={Stethoscope}>
        Vitals
      </PageHeader>

      {/* Today's date + freshness indicator + range picker */}
      <FreshnessBar rows={rows} />
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="px-3 py-1.5 rounded-full text-xs uppercase tracking-[0.16em] font-semibold border"
          style={{ background: "var(--color-surface-2)", color: "var(--color-ink)", borderColor: "var(--color-border)" }}
        >
          Progress since build start
        </span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-[--color-ink-dim] font-semibold">
          1 May 2026 → today
        </span>
        <RefreshButton />
      </div>

      {/* EXEC SUMMARY — today + week-over-week */}
      <section>
        <SectionTitle>Today's snapshot</SectionTitle>
        <ExecSummary rows={rows} />
      </section>

      {/* AGENT INSIGHTS — the "why" stack */}
      {insights.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-lg sm:text-xl font-semibold text-[--color-ink]">
              What stands out
            </h2>
            <span className="text-xs text-[--color-ink-dim]">
              Doc, Coach + Nutri reading the room
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {insights.map((ins, i) => (
              <InsightCard
                key={i}
                agent={ins.agent}
                tone={ins.tone}
                title={ins.title}
                body={ins.body}
                context={ins.context}
              />
            ))}
          </div>
        </section>
      )}

      {/* CHARTS — one per metric, with thresholds + averages */}
      <section className="space-y-5">
        <SectionTitle>Trends · since build start</SectionTitle>

        <ChartCard
          title="HRV"
          unit="ms"
          owner="doc"
          kpi="hrv"
          latestValue={latestNonNull(rows, "hrv")}
          delta={computeDelta(rows, "hrv")}
          subtitle={`Baseline ${HRV_BASE_LOW}–${HRV_BASE_HIGH} ms`}
          commentary={trendCommentary("hrv", rows, "doc")}
          chart={
            <MetricChart
              data={series.map((s) => ({ date: s.date, value: s.hrv }))}
              unit="ms"
              colour={AGENTS.doc.hue}
              thresholds={{
                badBelow: HRV_BASE_LOW,
                goodLow: HRV_BASE_LOW,
                goodHigh: 106,
                excellentAbove: 106,
              }}
              yMin={81}
              averageLabel="avg"
            />
          }
        />

        <ChartCard
          title="Resting HR"
          unit="bpm"
          owner="doc"
          kpi="rhr"
          latestValue={latestNonNull(rows, "rhr")}
          delta={computeDelta(rows, "rhr")}
          subtitle={`Preferred ${RHR_GOOD_LOW}–${RHR_GOOD_HIGH} bpm · lower is better`}
          commentary={trendCommentary("rhr", rows, "doc")}
          chart={
            <MetricChart
              data={series.map((s) => ({ date: s.date, value: s.rhr }))}
              unit="bpm"
              colour={AGENTS.doc.hue}
              thresholds={{
                badAbove: 50,
                goodLow: 46,
                goodHigh: 50,
                excellentBelow: 46,
              }}
              averageLabel="avg"
            />
          }
        />

        <ChartCard
          title="Sleep"
          unit="h"
          owner="doc"
          kpi="sleep_hours"
          latestValue={latestNonNull(rows, "sleep_hours")}
          delta={computeDelta(rows, "sleep_hours")}
          subtitle={`Floor ${SLEEP_GOOD_HOURS}h · shorter nights flagged`}
          commentary={trendCommentary("sleep_hours", rows, "doc")}
          chart={
            <MetricChart
              data={series.map((s) => ({ date: s.date, value: s.sleep_hours }))}
              unit="h"
              colour={AGENTS.coach.hue}
              thresholds={{
                badBelow: SLEEP_AMBER_HOURS,
                goodLow: SLEEP_AMBER_HOURS,
                goodHigh: SLEEP_GOOD_HOURS,
                excellentAbove: SLEEP_GOOD_HOURS,
              }}
              averageLabel="avg"
            />
          }
        />

        {/* Sleep score (0–100, from Garmin) — synced via migration 0011 */}
        {latestNonNull(rows, "sleep_score" as keyof Score) !== null && (
          <ChartCard
            title="Sleep score"
            unit=""
            owner="doc"
            delta={computeDelta(rows, "sleep_score")}
            subtitle="Garmin overnight score · 0–100 · factors: duration, stress, REM, awakenings"
            commentary={sleepScoreCommentary(rows)}
            chart={
              <MetricChart
                data={series.map((s) => ({ date: s.date, value: s.sleep_score ?? null }))}
                unit=""
                colour={AGENTS.doc.hue}
                thresholds={{
                  badBelow: 60,
                  goodLow: 60,
                  goodHigh: 80,
                  excellentAbove: 80,
                }}
                averageLabel="avg"
                yMin={40}
                yMax={100}
              />
            }
          />
        )}

        <ChartCard
          title="Body Battery"
          unit=""
          owner="coach"
          kpi="body_battery"
          latestValue={latestNonNull(rows, "body_battery")}
          delta={computeDelta(rows, "body_battery")}
          subtitle={`Floor ${BB_GOOD_FLOOR} · low recharge flagged`}
          commentary={trendCommentary("body_battery", rows, "coach")}
          chart={
            <MetricChart
              data={series.map((s) => ({ date: s.date, value: s.body_battery }))}
              unit=""
              colour={AGENTS.coach.hue}
              thresholds={{
                badBelow: 60,
                goodLow: 60,
                goodHigh: BB_GOOD_FLOOR,
                excellentAbove: BB_GOOD_FLOOR,
              }}
              averageLabel="avg"
            />
          }
        />

        <VO2Chart
          rows={series.map((s) => ({ date: s.date, vo2max: s.vo2max }))}
          commentary={trendCommentary("vo2max", rows, "coach")}
        />

        {/* Weight — stale alert when no reading in >7 days */}
        {weightStale && (
          <div
            className="holy-card p-4 flex items-center gap-3 text-sm"
            style={{ borderColor: "var(--color-warn)", background: "color-mix(in oklab, var(--color-warn) 8%, transparent)" }}
          >
            <span style={{ color: "var(--color-warn)" }}>⚠</span>
            <span className="text-[--color-ink]">
              No weigh-in for {weightStaleDays} days — step on the scale for an accurate trend.
            </span>
          </div>
        )}
        <WeightChartCard rows={rows} series={series} />

        {/* Body composition from the Garmin scale (migration 0004). Sparse:
            only on days you stepped on the scale. Body fat % is the
            primary signal; muscle mass tracks alongside. */}
        <ChartCard
          title="Body fat"
          unit="%"
          owner="nutri"
          kpi="body_fat_percent"
          latestValue={latestNonNull(rows, "body_fat_percent") ?? 29}
          delta={computeDelta(rows, "body_fat_percent")}
          subtitle="Garmin scale reading · trend over weeks is the signal"
          commentary={bodyFatCommentary(rows)}
          chart={
            <MetricChart
              data={series.map((s) => ({ date: s.date, value: s.body_fat_percent }))}
              unit="%"
              colour={AGENTS.nutri.hue}
              yMin={20}
              yMax={32}
              thresholds={{
                badAbove: 30,
                goodLow: 25,
                goodHigh: 30,
                excellentBelow: 25,
              }}
            />
          }
          note="Female endurance athletes typically run 18–28% (sport-science range, not WHO). Daily noise is real."
        />

        <ChartCard
          title="Muscle mass"
          unit="kg"
          owner="coach"
          delta={computeDelta(rows, "muscle_mass_kg")}
          subtitle="Garmin scale daily reading · supports Coach's load reads"
          commentary={muscleMassCommentary(rows)}
          chart={
            <MetricChart
              data={series.map((s) => ({ date: s.date, value: s.muscle_mass_kg }))}
              unit="kg"
              colour={AGENTS.coach.hue}
              thresholds={{
                goodLow: 14,
                goodHigh: 19,
                excellentAbove: 19,
              }}
            />
          }
        />

        <GripDualChart rows={rows} series={series} />
      </section>
    </div>
  );
}

// -------------------------- subcomponents --------------------------------

function VO2Chart({
  rows,
  commentary,
}: {
  rows: Array<{ date: string; vo2max: number | null }>;
  commentary?: string | null;
}) {
  const data = rows.map((r) => ({ date: r.date, vo2max: r.vo2max }));
  const a = AGENTS.coach;
  const latestVo2 = latestNonNull(rows, "vo2max");
  const ranked = latestVo2 !== null ? rank("vo2max", latestVo2) : null;
  const fAge = fitnessAge(latestVo2);
  return (
    <div className="holy-card p-5">
      <div className="flex items-start justify-between mb-2 gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-base font-semibold text-[--color-ink] inline-flex items-center">
              VO₂max
              <KPIInfo kpi="vo2max" />
            </h3>
            <span
              className="text-[10px] uppercase tracking-[0.14em] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: a.hueSoft, color: a.hue }}
            >
              {a.name}
            </span>
            {ranked && <PercentileBadge ranked={ranked} />}
            {fAge !== null && (
              <span
                title="Fitness age — the age at which your VO₂max would be the median for women. Estimated from Cooper Institute curves; ~0.4 ml/kg/min decline per year."
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold tabular"
                style={{
                  background: "color-mix(in oklab, var(--color-good) 12%, transparent)",
                  color: "var(--color-good)",
                }}
              >
                <span className="opacity-70 text-[9.5px] uppercase tracking-[0.14em]">Fitness age</span>
                <span>{fAge}</span>
              </span>
            )}
          </div>
          <div className="text-xs text-[--color-ink-mid] mt-1">
            Floor {VO2_GOOD_FLOOR} · 28-day running load (km) overlaid (Doc's call: training
            load matches VO₂'s 2–6 week lag better than long-run km).
          </div>
        </div>
      </div>
      <div className="h-44">
        <RResponsive width="100%" height="100%">
          <ComposedChart data={data} margin={{ left: -10, right: 12, top: 6, bottom: 4 }}>
            <RGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <RXAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-ink-dim)" }}
              tickFormatter={(v) => format(new Date(v), "d MMM")} interval="preserveStartEnd" />
            <RYAxis
              yAxisId="vo2"
              orientation="left"
              tick={{ fontSize: 10, fill: AGENTS.coach.hue }}
              width={36}
              domain={[48, 60]}
            />
            <RTooltip
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(d) => format(new Date(d), "EEE d MMM")}
              formatter={(v: number) => [`${v} ml/kg/min`, "VO₂max"]}
            />
            {/* Colour zones: red < 50, light green 50–53, dark green > 53 */}
            <RArea yAxisId="vo2" y1={48} y2={VO2_GOOD_FLOOR} fill="var(--color-bad-soft)" ifOverflow="extendDomain" />
            <RArea yAxisId="vo2" y1={VO2_GOOD_FLOOR} y2={53} fill="var(--color-good-soft)" ifOverflow="extendDomain" />
            <RArea yAxisId="vo2" y1={53} y2={60} fill="color-mix(in oklab, var(--color-good) 22%, transparent)" ifOverflow="extendDomain" />
            <RLine
              yAxisId="vo2"
              type="monotone"
              dataKey="vo2max"
              stroke={AGENTS.coach.hue}
              strokeWidth={2.5}
              dot={{ r: 3, fill: AGENTS.coach.hue }}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </RResponsive>
      </div>
      {commentary && <CommentaryLine voice="coach" text={commentary} />}
    </div>
  );
}

function ChartCard({
  title,
  unit,
  subtitle,
  owner,
  delta,
  chart,
  note,
  commentary,
  kpi,
  latestValue,
}: {
  title: string;
  unit: string;
  subtitle: string;
  owner: keyof typeof AGENTS;
  delta: ReturnType<typeof computeDelta>;
  chart: React.ReactNode;
  note?: string;
  /** One-line agent-voice take on the trend. Surfaced under the chart. */
  commentary?: string | null;
  /** When set, renders a `?` info icon (description hover) + a percentile
   *  badge ranking `latestValue` against the reference cohort for your age group.
   *  Accepts any KPI we have a description for; rank() is only called for
   *  the ones with norm tables (body_battery has copy but no rank). */
  kpi?: DescribedKpi;
  latestValue?: number | null;
}) {
  const a = AGENTS[owner];
  const ranked = kpi && RANKABLE_KPIS.has(kpi) && latestValue !== null && latestValue !== undefined
    ? rank(kpi as KPIKey, latestValue)
    : null;
  return (
    <div className="holy-card p-5">
      <div className="flex items-start justify-between mb-2 gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-base font-semibold text-[--color-ink] inline-flex items-center">
              {title}
              {kpi && <KPIInfo kpi={kpi} />}
            </h3>
            <span className="text-xs text-[--color-ink-dim]">{unit}</span>
            <span
              className="text-[10px] uppercase tracking-[0.14em] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: a.hueSoft, color: a.hue }}
            >
              {a.name}
            </span>
            {ranked && <PercentileBadge ranked={ranked} />}
          </div>
          <div className="text-xs text-[--color-ink-mid] mt-1">{subtitle}</div>
        </div>
        {delta.diff !== null && (
          <DeltaBadge delta={delta} />
        )}
      </div>
      {chart}
      {commentary && <CommentaryLine voice={owner} text={commentary} />}
      {note && (
        <div className="text-[11px] text-[--color-ink-dim] mt-2 italic">{note}</div>
      )}
    </div>
  );
}

/**
 * Single-line agent-voice take on a trend. Tinted with the agent's colour and
 * tagged with their name so you can see *who* is reading the chart.
 */
function CommentaryLine({
  voice,
  text,
}: {
  voice: keyof typeof AGENTS;
  text: string;
}) {
  const a = AGENTS[voice];
  return (
    <div
      className="mt-3 px-3 py-2 rounded-lg text-[12.5px] leading-snug"
      style={{
        background: a.hueTint,
        borderLeft: `3px solid ${a.hue}`,
        color: "var(--color-ink)",
      }}
    >
      <span
        className="text-[10px] uppercase tracking-[0.14em] font-bold mr-2"
        style={{ color: a.hue }}
      >
        {a.name}
      </span>
      <span>{text}</span>
    </div>
  );
}

function PercentileBadge({
  ranked,
}: {
  ranked: NonNullable<ReturnType<typeof rank>>;
}) {
  const top = ranked.topPct;
  // Tone: top 10% green, top 25% mint, otherwise neutral. Below median dim.
  const tone =
    top <= 10
      ? "var(--color-good)"
      : top <= 25
      ? "color-mix(in oklab, var(--color-good) 65%, var(--color-ink-dim) 35%)"
      : ranked.percentile < 45
      ? "var(--color-bad)"
      : "var(--color-ink-mid)";
  return (
    <span
      title={ranked.label}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold tabular"
      style={{
        background: `color-mix(in oklab, ${tone} 14%, transparent)`,
        color: tone,
      }}
    >
      <span className="opacity-70 text-[9.5px] uppercase tracking-[0.14em]">Top</span>
      <span>{top}%</span>
    </span>
  );
}

/** Return the most recent non-null value of `field` across rows.
 *  Rows can be in either order — we sort by date desc then take the first. */
function latestNonNull<T extends { date: string }>(
  rows: T[],
  field: keyof T,
): number | null {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const r of sorted) {
    const v = r[field];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
  }
  return null;
}

function DeltaBadge({ delta }: { delta: ReturnType<typeof computeDelta> }) {
  if (delta.diff === null || delta.prior7d === null) return null;
  const tone =
    delta.direction === "flat"
      ? "var(--color-ink-dim)"
      : delta.direction === "up"
      ? "var(--color-good)"
      : "var(--color-bad)";
  const arrow = delta.direction === "up" ? "↑" : delta.direction === "down" ? "↓" : "—";
  // Show absolute value next to prior-7d-avg, not %
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tabular"
      style={{ background: `color-mix(in oklab, ${tone} 12%, transparent)`, color: tone }}
    >
      <span>{arrow}</span>
      <span>{delta.prior7d.toFixed(delta.prior7d < 10 ? 1 : 0)}</span>
      <span className="font-normal opacity-70 text-[10px] uppercase tracking-[0.14em]">prior 7d</span>
    </div>
  );
}

export function PageHeader({
  voice,
  Icon,
  children,
}: {
  voice: keyof typeof AGENTS;
  Icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  const a = AGENTS[voice];
  return (
    <div className="flex items-end justify-between gap-4">
      <h1 className="font-display text-3xl sm:text-4xl font-bold text-[--color-ink]">
        {children}
      </h1>
      <div
        className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] font-semibold px-3 py-1.5 rounded-full"
        style={{ background: a.hueSoft, color: a.hue }}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{a.name}</span>
      </div>
    </div>
  );
}

/**
 * "Refresh" button — kicks the morning sync (Strava + Garmin + Supabase
 * mirror) on your machine via the local input server at localhost:8765.
 * Only works when she's on her own machine; on phone/away it shows a
 * graceful "couldn't reach Mac" hint. Reloads the page after success so
 * fresh KPIs flow into the charts.
 */
function RefreshButton() {
  const [state, setState] = useState<"idle" | "syncing" | "ok" | "err">("idle");
  async function go() {
    setState("syncing");
    try {
      const res = await fetch("http://localhost:8765/sync", {
        method: "POST",
        // 4s — server returns immediately after kicking the script.
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error("sync failed");
      setState("ok");
      // Give the pipeline ~30 s to complete a fast Strava + Garmin pull,
      // then reload so the new scores row lands in the chart. Dashboard
      // can still be used during the wait.
      setTimeout(() => window.location.reload(), 30_000);
    } catch {
      setState("err");
    }
  }
  return (
    <button
      type="button"
      onClick={go}
      disabled={state === "syncing"}
      title="Pull latest Strava + Garmin + push to Supabase. Only works on your Mac."
      className="ml-auto px-3 py-1.5 rounded-full text-xs uppercase tracking-[0.16em] font-semibold transition border disabled:opacity-50 hover:opacity-90"
      style={{ background: "var(--color-coach)", borderColor: "var(--color-coach)", color: "#fff" }}
    >
      {state === "idle" && "↻ Refresh"}
      {state === "syncing" && "Syncing…"}
      {state === "ok" && "✓ Reloading in 30s"}
      {state === "err" && "Mac unreachable"}
    </button>
  );
}

export function Empty({ message }: { message: string }) {
  return (
    <div className="holy-card p-8 text-center text-sm text-[--color-ink-mid]">
      {message}
    </div>
  );
}

export const fmt = (d: string) => format(new Date(d), "d MMM");

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-lg sm:text-xl font-semibold text-[--color-ink] mb-3 sm:mb-4">
      {children}
    </h2>
  );
}

/**
 * Weight tile that adapts to data sparsity:
 *   - 0 readings  → empty-state nudge to log a weight
 *   - 1 reading   → big "first reading" callout (so 57.2 kg isn't invisible
 *                   until a second reading exists)
 *   - 2+ readings → the normal MetricChart with rolling average + commentary
 *
 * Reads `weight_logs` from localStorage to enrich today's reading with the
 * time + food-state context you just typed in via the WeightLogger above.
 */
function WeightChartCard({
  rows,
  series,
}: {
  rows: Score[];
  series: Array<{ date: string; weight_kg: number | null }>;
}) {
  const nonNull = rows.filter((r) => typeof r.weight_kg === "number");
  const today = nonNull[nonNull.length - 1];

  // Pull today's most recent log entry from localStorage (if any) for context.
  let todayContext: { time: string; context: string } | null = null;
  try {
    const raw = localStorage.getItem("holy.vitals.weightLog");
    if (raw && today) {
      const parsed = JSON.parse(raw) as Array<{
        date: string;
        time: string;
        weight: number;
        context: WeightContext;
      }>;
      const match = parsed.find((p) => p.date === today.date);
      if (match) {
        todayContext = {
          time: match.time,
          context: CONTEXT_LABELS[match.context] ?? match.context,
        };
      }
    }
  } catch {
    /* ignore localStorage parse error */
  }

  if (nonNull.length === 0) {
    return (
      <div className="holy-card p-5">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <h3 className="font-display text-base font-semibold text-[--color-ink]">
            Weight
          </h3>
          <span className="text-xs text-[--color-ink-dim]">kg</span>
          <span
            className="text-[10px] uppercase tracking-[0.14em] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: AGENTS.nutri.hueSoft, color: AGENTS.nutri.hue }}
          >
            Nutri
          </span>
        </div>
        <div className="text-sm text-[--color-ink-mid] py-6 text-center">
          No weight logged in this range. Use the form above (or say{" "}
          <code>weight 57.2</code> in chat) to start the trend.
        </div>
      </div>
    );
  }

  if (nonNull.length === 1 && today) {
    const bmiValue = bmi(today.weight_kg);
    return (
      <div
        className="holy-card p-5"
        style={{ borderColor: AGENTS.nutri.hueSoft }}
      >
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <h3 className="font-display text-base font-semibold text-[--color-ink]">
            Weight
          </h3>
          <span className="text-xs text-[--color-ink-dim]">kg</span>
          <span
            className="text-[10px] uppercase tracking-[0.14em] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: AGENTS.nutri.hueSoft, color: AGENTS.nutri.hue }}
          >
            Nutri
          </span>
          <span
            className="text-[10px] uppercase tracking-[0.14em] font-semibold px-2 py-0.5 rounded-full ml-auto"
            style={{ background: "var(--color-surface-2)", color: "var(--color-ink-mid)" }}
          >
            First reading
          </span>
        </div>
        <div className="flex items-baseline gap-4 mt-3 flex-wrap">
          <div>
            <div className="font-display text-4xl font-bold text-[--color-ink] tabular">
              {today.weight_kg!.toFixed(1)}
              <span className="text-[--color-ink-dim] text-base font-light ml-1">kg</span>
            </div>
            <div className="text-xs text-[--color-ink-mid] mt-1">
              {format(new Date(today.date), "EEE d MMM")}
              {todayContext && ` · ${todayContext.time} · ${todayContext.context}`}
            </div>
          </div>
          {bmiValue !== null && (
            <div className="flex items-baseline gap-2">
              <div className="font-display text-2xl font-semibold text-[--color-ink] tabular">
                {bmiValue.toFixed(1)}
                <span className="text-[--color-ink-dim] text-xs font-normal ml-1">BMI</span>
              </div>
              <BMIPill value={bmiValue} />
            </div>
          )}
        </div>
        <CommentaryLine
          voice="nutri"
          text={
            bmiValue !== null
              ? `One reading is a baseline, not a trend. BMI ${bmiValue.toFixed(1)} sits in the ${(bmiCategory(bmiValue) ?? "healthy")} band — but BMI doesn't see body composition; for endurance runners with low body fat and lean leg muscle, the number is a coarse proxy at best. The trend across weeks of fasted-morning readings is what'll matter.`
              : "One reading is a baseline, not a trend. Log again on Sun fasted morning — same conditions matter more than daily frequency. Once we have 7+ entries, the rolling average kicks in and the chart goes live."
          }
        />
      </div>
    );
  }

  return (
    <ChartCard
      title="Weight (7-day rolling)"
      unit="kg"
      owner="nutri"
      delta={computeDelta(rows, "weight_kg")}
      subtitle="Trend matters; daily swings are water + glycogen"
      commentary={trendCommentary("weight_kg", rows, "nutri")}
      chart={
        <MetricChart
          data={series.map((s) => ({ date: s.date, value: s.weight_kg }))}
          unit="kg"
          colour={AGENTS.nutri.hue}
          yMin={54}
          yMax={60}
          thresholds={{
            badAbove: 57,
            goodLow: 56,
            goodHigh: 57,
            excellentBelow: 56,
          }}
        />
      }
    />
  );
}

/**
 * BMI category pill — green for healthy, amber for the WHO over/under-weight
 * bands. Intentionally not red anywhere: BMI is a coarse proxy for athletes
 * (Stacy Sims / Renee McGregor's stance) — flag-worthy categories are still
 * just data points, not verdicts.
 */
function BMIPill({ value }: { value: number }) {
  const cat = bmiCategory(value);
  if (!cat) return null;
  const tone: Record<BMICategory, { bg: string; fg: string }> = {
    underweight: {
      bg: "color-mix(in oklab, var(--color-warn) 14%, transparent)",
      fg: "var(--color-warn)",
    },
    healthy: {
      bg: "color-mix(in oklab, var(--color-good) 14%, transparent)",
      fg: "var(--color-good)",
    },
    overweight: {
      bg: "color-mix(in oklab, var(--color-warn) 14%, transparent)",
      fg: "var(--color-warn)",
    },
    obese: {
      bg: "color-mix(in oklab, var(--color-warn) 14%, transparent)",
      fg: "var(--color-warn)",
    },
  };
  const t = tone[cat];
  return (
    <span
      className="text-[10px] uppercase tracking-[0.14em] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: t.bg, color: t.fg }}
      title={`BMI ${value.toFixed(1)} · ${BMI_CATEGORY_LABEL[cat]} · BMI is a coarse proxy for endurance athletes; trend matters more than category.`}
    >
      {BMI_CATEGORY_LABEL[cat]}
    </span>
  );
}

type WeightContext = "fasted" | "before_breakfast" | "after_breakfast" | "post_run" | "evening" | "other";

const CONTEXT_LABELS: Record<WeightContext, string> = {
  fasted: "Fasted",
  before_breakfast: "Before breakfast",
  after_breakfast: "After breakfast",
  post_run: "Post-run",
  evening: "Evening",
  other: "Other",
};


/**
 * Today's date + freshness pill. The pill turns warning-orange if the latest
 * score row is more than 1 day stale. Critical because you have no other
 * way to tell whether the dashboard is showing today's data or last week's.
 */
function FreshnessBar({ rows }: { rows: Score[] }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const latest = rows[rows.length - 1] ?? null;
  const ageDays = latest ? differenceInCalendarDays(new Date(todayIso), new Date(latest.date)) : null;
  const stale = ageDays === null || ageDays >= 2;

  return (
    <div className="flex items-center justify-between flex-wrap gap-2 -mt-2">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[--color-ink-dim] font-semibold">
        Today · {format(new Date(), "EEEE d MMMM yyyy")}
      </div>
      <div
        className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] font-semibold px-2.5 py-1 rounded-full"
        style={{
          background: stale
            ? "color-mix(in oklab, var(--color-warn) 14%, transparent)"
            : "color-mix(in oklab, var(--color-good) 14%, transparent)",
          color: stale ? "var(--color-warn)" : "var(--color-good)",
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: stale ? "var(--color-warn)" : "var(--color-good)" }}
        />
        {latest === null
          ? "no data yet"
          : ageDays === 0
          ? `up to date · ${format(new Date(latest.date), "d MMM")}`
          : ageDays === 1
          ? `1 day behind · ${format(new Date(latest.date), "d MMM")}`
          : `${ageDays} days behind · last ${format(new Date(latest.date), "d MMM")}`}
      </div>
    </div>
  );
}

/**
 * One-line agent-voice take on a metric's recent trend. Compares the most
 * recent ~14d to the prior ~14d. Returns null if there isn't enough data —
 * the chart card then drops the commentary block entirely.
 *
 * Tone is direction-aware (good/bad/flat) per metric, since "up" is good for
 * HRV and bad for RHR. Lines stay under ~120 chars so the layout doesn't
 * wrap awkwardly under the chart.
 */
/**
 * Body-fat % commentary. Endurance-female sport-science range is roughly
 * 18–28% — *not* WHO categories, which are general-population. Drift down
 * during build is expected, drift up during taper / off-season is expected.
 * Sustained downward trend with sparse intake = RED-S flag, surface to Doc.
 */
function bodyFatCommentary(rows: Score[]): string | null {
  const vals = rows
    .map((r) => r.body_fat_percent)
    .filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return null;
  if (vals.length === 1) {
    return `Single reading — ${vals[0].toFixed(1)}%. Endurance-female sport-science range is 18–28%. Need 3–4 weeks of scale-step days for a real trend.`;
  }
  const recent = vals.slice(-7);
  const prior = vals.slice(-14, -7);
  const r = recent.reduce((a, b) => a + b, 0) / recent.length;
  if (prior.length === 0) {
    return `Latest 7-day avg ${r.toFixed(1)}% — building the baseline. Once we have ~30 days, trend reads kick in.`;
  }
  const p = prior.reduce((a, b) => a + b, 0) / prior.length;
  const delta = r - p;
  const noise = 0.5;
  if (Math.abs(delta) < noise) {
    return `Stable around ${r.toFixed(1)}% (was ${p.toFixed(1)}). Boring is good — body comp shouldn't move fast in a healthy build.`;
  }
  if (delta < 0) {
    return `Trending down: ${r.toFixed(1)}% (was ${p.toFixed(1)}). Normal during build if intake is matching load. Watch for it pairing with rising fatigue or dropping HRV — that's the RED-S signal.`;
  }
  return `Trending up: ${r.toFixed(1)}% (was ${p.toFixed(1)}). Could be water retention from a hard week or genuine trend. The 4-week shape will tell us.`;
}

/**
 * Muscle-mass commentary. Stable or slowly rising during build is healthy;
 * sharp drops with rising volume = under-fuelling, flag for Nutri.
 */
function muscleMassCommentary(rows: Score[]): string | null {
  const vals = rows
    .map((r) => r.muscle_mass_kg)
    .filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return null;
  if (vals.length === 1) {
    return `Single reading — ${vals[0].toFixed(1)} kg. Need a few weeks for a meaningful trend.`;
  }
  const recent = vals.slice(-7);
  const prior = vals.slice(-14, -7);
  const r = recent.reduce((a, b) => a + b, 0) / recent.length;
  if (prior.length === 0) {
    return `Latest 7-day avg ${r.toFixed(1)} kg — building the baseline.`;
  }
  const p = prior.reduce((a, b) => a + b, 0) / prior.length;
  const delta = r - p;
  if (Math.abs(delta) < 0.2) {
    return `Stable around ${r.toFixed(1)} kg. Holding muscle through a marathon build is the goal — green light.`;
  }
  if (delta < 0) {
    return `Down to ${r.toFixed(1)} kg (was ${p.toFixed(1)}). If volume is rising at the same time, eat more carbs + a protein hit at every meal.`;
  }
  return `Up to ${r.toFixed(1)} kg (was ${p.toFixed(1)}). Strength sessions paying off — keep the lifts in.`;
}

/**
 * Grip-strength commentary. Weekly Sunday test — a CNS-fatigue proxy.
 * A clear decline flags accumulated fatigue / overtraining; a hold or
 * rise signals the nervous system is recovering well against the load.
 */
function gripCommentary(rows: Score[]): string | null {
  const vals = rows
    .map((r) => r.grip_kg)
    .filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return null;
  if (vals.length === 1) {
    return `First grip test — ${vals[0].toFixed(1)} kg. A few more Sundays and the trend becomes the CNS-fatigue read.`;
  }
  const latest = vals[vals.length - 1];
  const prior = vals.slice(0, -1);
  const p = prior.reduce((a, b) => a + b, 0) / prior.length;
  const delta = latest - p;
  if (Math.abs(delta) < 1) {
    return `Holding around ${latest.toFixed(1)} kg. Stable grip — the nervous system is keeping up with the load.`;
  }
  if (delta < 0) {
    return `Down to ${latest.toFixed(1)} kg (avg was ${p.toFixed(1)}). A grip dip can flag CNS fatigue — worth an easier week if it pairs with low HRV.`;
  }
  return `Up to ${latest.toFixed(1)} kg (avg was ${p.toFixed(1)}). Strong grip — recovery is winning against the build.`;
}

/**
 * Dual-line grip strength chart — right hand (solid) + left hand (dashed).
 * Falls back to the legacy single grip_kg line when R/L aren't populated yet.
 * Shows value labels on the dots so exact readings are always visible.
 */
function GripDualChart({
  rows,
  series,
}: {
  rows: Score[];
  series: Array<{ date: string; grip_kg: number | null; grip_r_kg: number | null; grip_l_kg: number | null }>;
}) {
  const hasRL = series.some((s) => s.grip_r_kg !== null || s.grip_l_kg !== null);
  const a = AGENTS.coach;
  const latestR = mostRecent(rows, "grip_r_kg");
  const latestL = mostRecent(rows, "grip_l_kg");
  const latestLeg = mostRecent(rows, "grip_kg");
  const commentary = gripCommentary(rows);

  const weekNum = (iso: string) => {
    const days = differenceInCalendarDays(new Date(iso), new Date(BUILD_START_ISO));
    return Math.floor(days / 7) + 1;
  };

  // Filter to weeks that actually have a grip reading; use grip_kg as R fallback
  const data = series
    .filter((s) => s.grip_r_kg !== null || s.grip_l_kg !== null || s.grip_kg !== null)
    .map((s) => ({
      date: s.date,
      week: `W${weekNum(s.date)}`,
      right: s.grip_r_kg ?? s.grip_kg,   // grip_kg is always mirrored into grip_r_kg on log
      left: s.grip_l_kg,
    }));

  const allVals = data.flatMap((d) => [d.right, d.left]).filter((v): v is number => v !== null);
  const yMin = allVals.length ? Math.max(0, Math.floor(Math.min(...allVals)) - 4) : 0;
  const yMax = allVals.length ? Math.ceil(Math.max(...allVals)) + 4 : 45;

  return (
    <div className="holy-card p-5">
      <div className="flex items-start justify-between mb-2 gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-base font-semibold text-[--color-ink]">
              Grip strength
              <KPIInfo kpi="grip_kg" />
            </h3>
            <span
              className="text-[10px] uppercase tracking-[0.14em] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: a.hueSoft, color: a.hue }}
            >
              {a.name}
            </span>
            {(latestR ?? latestLeg) !== null && (
              <span className="text-xs text-[--color-ink-mid]">
                R {(latestR ?? latestLeg)!.toFixed(1)} kg
                {latestL !== null && <> · L {latestL.toFixed(1)} kg</>}
              </span>
            )}
          </div>
          <div className="text-xs text-[--color-ink-mid] mt-1">
            Sunday evening test · CNS fatigue proxy · decline flags overtraining
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-sm text-[--color-ink-dim] italic">
          Test Sunday evening — first reading starts the trend →
        </div>
      ) : (
        <div className="h-44">
          <RResponsive width="100%" height="100%">
            <BarChart data={data} barGap={4} barCategoryGap="35%"
              margin={{ left: -10, right: 12, top: 16, bottom: 4 }}>
              <RGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <RXAxis dataKey="week" tick={{ fontSize: 10, fill: "var(--color-ink-dim)" }}
                axisLine={false} tickLine={false} interval={0} />
              <RYAxis tick={{ fontSize: 10, fill: "var(--color-ink-dim)" }}
                width={36} domain={[yMin, yMax]} axisLine={false} tickLine={false} />
              <RTooltip
                contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(w) => {
                  const row = data.find((d) => d.week === w);
                  return row ? `${w} · ${format(new Date(row.date), "d MMM")}` : w;
                }}
                formatter={(v: number, name: string) => [`${v.toFixed(1)} kg`, name === "right" ? "Right" : "Left"]}
              />
              {/* 33 kg target line */}
              <ReferenceLine y={33} stroke="var(--color-good)" strokeDasharray="4 3"
                label={{ value: "33", position: "insideRight", fontSize: 9, fill: "var(--color-good)" }} />
              <Bar dataKey="right" name="right" fill={a.hue} radius={[3, 3, 0, 0]}>
                <LabelList dataKey="right" position="top"
                  style={{ fontSize: 9, fill: a.hue, fontWeight: 600 }}
                  formatter={(v: number) => v ? v.toFixed(1) : ""} />
              </Bar>
              {hasRL && (
                <Bar dataKey="left" name="left" radius={[3, 3, 0, 0]}
                  fill="color-mix(in oklab, var(--color-coach) 50%, var(--color-surface))">
                  <LabelList dataKey="left" position="top"
                    style={{ fontSize: 9, fill: "var(--color-ink-dim)", fontWeight: 600 }}
                    formatter={(v: number) => v ? v.toFixed(1) : ""} />
                </Bar>
              )}
            </BarChart>
          </RResponsive>
        </div>
      )}

      {data.length > 0 && (
        <div className="flex items-center gap-4 mt-2 text-[10.5px] text-[--color-ink-dim]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: a.hue }} />
            Right hand
          </span>
          {hasRL && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm"
                style={{ background: "color-mix(in oklab, var(--color-coach) 50%, var(--color-surface))" }} />
              Left hand
            </span>
          )}
          <span className="flex items-center gap-1.5 ml-auto">
            <span className="inline-block w-4 border-t border-dashed" style={{ borderColor: "var(--color-good)" }} />
            33 kg target
          </span>
        </div>
      )}
      {commentary && <CommentaryLine voice="coach" text={commentary} />}
    </div>
  );
}

/** Sleep score commentary (0–100 Garmin scale). */
function sleepScoreCommentary(rows: Score[]): string | null {
  const vals = rows
    .map((r) => (r as Record<string, unknown>).sleep_score as number | null)
    .filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return null;
  const latest = vals[vals.length - 1];
  const avg7 = vals.slice(-7).reduce((a, b) => a + b, 0) / Math.min(vals.length, 7);
  const label = latest >= 80 ? "excellent" : latest >= 60 ? "good" : "needs attention";
  return `Latest ${Math.round(latest)} (${label}), 7d avg ${Math.round(avg7)}. Garmin factors in duration, stress, REM %, and awakenings.`;
}

function trendCommentary(
  field: "hrv" | "rhr" | "sleep_hours" | "weight_kg" | "body_battery" | "vo2max",
  rows: Score[],
  voice: keyof typeof AGENTS,
): string | null {
  void voice; // tone embedded per-metric; voice prop is for the badge
  const values = rows
    .map((r) => ({ date: r.date, v: r[field] as number | null }))
    .filter((x): x is { date: string; v: number } => typeof x.v === "number");

  const fmtEarly = (n: number) =>
    field === "sleep_hours" ? n.toFixed(1) + " h"
    : field === "weight_kg" ? n.toFixed(1) + " kg"
    : field === "hrv" ? Math.round(n) + " ms"
    : field === "rhr" ? Math.round(n) + " bpm"
    : Math.round(n).toString();

  if (values.length === 0) return null;

  // VO2max only updates on run days — lower the minimum threshold to 5.
  const minReadings = field === "vo2max" ? 5 : 14;
  if (values.length < minReadings) {
    const r = values.slice(-7).reduce((s, x) => s + x.v, 0) / Math.min(values.length, 7);
    return `Latest 7-day avg ${fmtEarly(r)} — building the baseline. Trend reads kick in once we have more readings.`;
  }
  const recent = values.slice(-14);
  const prior = values.slice(-28, -14);
  if (prior.length < 7) {
    const r7 = recent.slice(-7);
    const avg7 = r7.reduce((s, x) => s + x.v, 0) / r7.length;
    return `Latest 7-day avg ${fmtEarly(avg7)} — still building the baseline. Trend reads unlock after ~28 days of data.`;
  }
  const avg = (xs: { v: number }[]) => xs.reduce((s, x) => s + x.v, 0) / xs.length;
  const r = avg(recent);
  const p = avg(prior);
  const delta = r - p;
  // Per-metric "noise floor" — smaller than this we treat as flat.
  const noise = { hrv: 1.5, rhr: 1, sleep_hours: 0.2, weight_kg: 0.3, body_battery: 3, vo2max: 0.5 }[field];
  const dir: "up" | "down" | "flat" =
    Math.abs(delta) < noise ? "flat" : delta > 0 ? "up" : "down";

  const fmtV = (n: number) =>
    field === "weight_kg"
      ? n.toFixed(1) + " kg"
      : field === "sleep_hours"
      ? n.toFixed(1) + " h"
      : field === "hrv"
      ? Math.round(n) + " ms"
      : field === "rhr"
      ? Math.round(n) + " bpm"
      : Math.round(n).toString();

  const head = `2-week avg ${fmtV(r)} (was ${fmtV(p)}).`;
  const reads: Record<typeof field, Record<typeof dir, string>> = {
    hrv: {
      up: "Going the right way — autonomic recovery is winning the load battle. Hold the plan.",
      down: "Drifting down. If it's 3+ days, ease the next quality session and check sleep + life stress.",
      flat: "Stable — that's a green light to keep building. Watch for swings on cutback weeks.",
    },
    rhr: {
      up: "Trending up — usually load or under-recovery. If sleep is fine, expect HRV to dip next.",
      down: "Lower is better — your engine is gaining efficiency. Keep stacking the easy km.",
      flat: "Holding steady. Combined with rising volume, that's a fitness signal.",
    },
    sleep_hours: {
      up: "Sleep is up — biggest single recovery lever. Everything downstream will follow.",
      down: "Sleep slipping. Mind owns this: protect a 9:45 PM lights-out for the next 5 nights.",
      flat: "Consistent — boring is good. Sleep is the floor everything else stacks on.",
    },
    weight_kg: {
      up: "Up a touch — water + glycogen with rising volume is normal. Trend, not drama.",
      down: "Down a touch — if volume is rising it's probably fine; if you feel flat, eat more carbs.",
      flat: "Stable trend. Daily swings are normal; the 7-day average is what matters.",
    },
    body_battery: {
      up: "Recharging well — overnight recovery is keeping pace with training. Green light.",
      down: "Battery slipping. If HRV agrees, bank an extra easy day before the next quality session.",
      flat: "Steady — typical for build phase. Watch for divergence from HRV (early under-recovery flag).",
    },
    vo2max: {
      up: "Drift up — fitness is moving with the load. Right where we want to be in build.",
      down: "Slight dip — could be one bad run skewing it, could be fatigue. Cross-check with HRV.",
      flat: "Plateau is normal mid-build; the bigger jump comes in peak phase + taper.",
    },
  };
  return `${head} ${reads[field][dir]}`;
}
