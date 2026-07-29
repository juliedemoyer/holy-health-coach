import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Label,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { LineChart as LineIcon, Info, AlertTriangle } from "lucide-react";
import { sampleCorrelation, linearRegression, linearRegressionLine } from "simple-statistics";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/db";
import { Empty, PageHeader } from "@/pages/Vitals";

type Score = Database["public"]["Tables"]["scores"]["Row"];

type Field = {
  key: keyof Score;
  label: string;
  unit?: string;
};

const FIELDS: Field[] = [
  { key: "hrv", label: "HRV", unit: "ms" },
  { key: "rhr", label: "Resting HR", unit: "bpm" },
  { key: "sleep_hours", label: "Sleep", unit: "h" },
  { key: "body_battery", label: "Body Battery" },
  { key: "weight_kg", label: "Weight", unit: "kg" },
  { key: "mood", label: "Mood", unit: "/10" },
  { key: "cycle_day", label: "Cycle day" },
  { key: "vo2max", label: "VO₂max" },
];

/**
 * Pinned regressions for a marathon-runner wellness dashboard. Curated for
 * actionability rather than statistical novelty — each one maps to a lever
 * Coach / Doc / Mind / Nutri actually pull. Picks driven by sports-science
 * defaults: Plews & Buchheit on HRV recovery, Stellingwerff on training load
 * indicators, Sims on cycle-phase autonomic shifts, McGregor on RED-S.
 */
const PINNED: Array<{
  x: keyof Score;
  y: keyof Score;
  lag: number;
  label: string;
  why: string;
  voice: "doc" | "coach" | "nutri" | "mind";
}> = [
  {
    x: "sleep_hours",
    y: "hrv",
    lag: 1,
    label: "Sleep → next-day HRV",
    why: "Sleep is the single biggest recovery lever for HRV. If your data agrees, that's the headline pattern.",
    voice: "doc",
  },
  {
    x: "hrv",
    y: "rhr",
    lag: 0,
    label: "HRV vs Resting HR (same day)",
    why: "Should anti-correlate. If they diverge for days, suspect illness or sensor drift.",
    voice: "doc",
  },
  {
    x: "sleep_hours",
    y: "mood",
    lag: 1,
    label: "Sleep → next-day mood",
    why: "Psychological readiness driver. Mind cares whether short nights bite into next-day mood.",
    voice: "mind",
  },
  {
    x: "sleep_hours",
    y: "body_battery",
    lag: 1,
    label: "Sleep → next-day Body Battery",
    why: "Tests whether Garmin's recovery model matches your reality.",
    voice: "coach",
  },
  {
    x: "cycle_day",
    y: "hrv",
    lag: 0,
    label: "Cycle day vs HRV",
    why: "HRV typically dips 3–8 ms in late luteal. If yours follows that pattern, it's expected — not a flag.",
    voice: "doc",
  },
  {
    x: "rhr",
    y: "body_battery",
    lag: 0,
    label: "Resting HR vs Body Battery",
    why: "Cross-check: high RHR with low Body Battery means real under-recovery, not a Garmin artefact.",
    voice: "coach",
  },
  {
    x: "mood",
    y: "hrv",
    lag: 0,
    label: "Mood vs HRV (same day)",
    why: "Does subjective feel match objective recovery? Big mismatches are interesting either way.",
    voice: "mind",
  },
  {
    x: "weight_kg",
    y: "hrv",
    lag: 1,
    label: "Weight → next-day HRV",
    why: "RED-S sentinel proxy: if weight is dropping AND HRV is dropping during heavy weeks, flag for Doc.",
    voice: "nutri",
  },
];

export function Regressions() {
  const [rows, setRows] = useState<Score[]>([]);
  const [x, setX] = useState<keyof Score>("sleep_hours");
  const [y, setY] = useState<keyof Score>("hrv");
  const [lag, setLag] = useState(1);

  useEffect(() => {
    void supabase
      .from("scores")
      .select("*")
      .order("date", { ascending: true })
      .limit(365)
      .then(({ data }) => setRows(data ?? []));
  }, []);

  const result = useMemo(() => regress(rows, x, y, lag), [rows, x, y, lag]);

  // Coverage map for the pinned-regressions card — shows which fields the
  // user has populated enough to make a regression meaningful.
  const fieldCoverage = useMemo(() => {
    const cov = new Map<keyof Score, number>();
    for (const f of FIELDS) {
      cov.set(
        f.key,
        rows.filter((r) => typeof r[f.key] === "number").length,
      );
    }
    return cov;
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader voice="coach" Icon={LineIcon}>
        Regressions
      </PageHeader>

      <p className="text-sm text-[--color-ink-mid] max-w-2xl">
        Pick any two metrics and see if there's a pattern. Lag lets you ask
        "does X today predict Y tomorrow?" — most useful relationships are
        lagged. Stats run in your browser; nothing leaves the device.
      </p>

      <ExplainerPanel />

      <section className="holy-card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Picker label="X (predictor)" value={x} onChange={setX} />
          <Picker label="Y (outcome)" value={y} onChange={setY} />
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-[--color-ink-dim] mb-2">
              Lag (days)
            </div>
            <input
              type="number"
              min={0}
              max={7}
              value={lag}
              onChange={(e) => setLag(Math.max(0, Math.min(7, Number(e.target.value))))}
              className="px-3 py-2 rounded-lg bg-[--color-bg] border border-[--color-border] w-full"
            />
          </div>
        </div>

        {result ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <R2Stat r={result.r} />
              <SampleStat n={result.points.length} />
              <Stat label="Correlation (r)" value={result.r.toFixed(2)} tone="neutral" />
            </div>

            <p className="text-sm text-[--color-ink] leading-relaxed">{result.read}</p>

            <div className="h-80">
              <ResponsiveContainer>
                <ScatterChart margin={{ left: 12, right: 12, top: 12, bottom: 30 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name={fieldLabel(x)}
                    tick={{ fontSize: 10, fill: "var(--color-ink-dim)" }}
                    domain={["auto", "auto"]}
                  >
                    <Label
                      value={`${fieldLabel(x)}${lag > 0 ? ` (today)` : ""}`}
                      position="insideBottom"
                      offset={-10}
                      style={{ fontSize: 11, fill: "var(--color-ink-mid)", fontWeight: 600 }}
                    />
                  </XAxis>
                  <YAxis
                    type="number"
                    dataKey="y"
                    name={fieldLabel(y)}
                    tick={{ fontSize: 10, fill: "var(--color-ink-dim)" }}
                    domain={["auto", "auto"]}
                  >
                    <Label
                      value={`${fieldLabel(y)}${lag > 0 ? ` (+${lag}d)` : ""}`}
                      angle={-90}
                      position="insideLeft"
                      offset={-2}
                      style={{ fontSize: 11, fill: "var(--color-ink-mid)", fontWeight: 600, textAnchor: "middle" }}
                    />
                  </YAxis>
                  <ZAxis range={[60, 60]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                  <Scatter name="day" data={result.points} fill="var(--color-coach)" />
                  <Line
                    name="trend line"
                    type="linear"
                    dataKey="line"
                    data={result.line}
                    stroke="var(--color-race)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <Empty message="Need at least 10 paired data points to run a regression. Some metrics need more days logged before this lights up." />
        )}
      </section>

      <PitfallsCallout />

      <section>
        <h3 className="font-display text-base font-medium text-[--color-ink] mb-3">
          Pinned regressions
        </h3>
        <p className="text-xs text-[--color-ink-mid] mb-3 max-w-2xl">
          Curated to be actionable for a marathon build, not exhaustive. Click
          to load the regression. Greyed pins lack enough data — log more days
          of the underlying fields and they'll come alive.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PINNED.map((p) => {
            const xN = fieldCoverage.get(p.x) ?? 0;
            const yN = fieldCoverage.get(p.y) ?? 0;
            const usable = Math.min(xN, yN) - p.lag;
            const dataState =
              usable < 10 ? "missing" : usable < 30 ? "thin" : "ready";
            const disabled = dataState === "missing";
            return (
              <button
                key={p.label}
                onClick={() => {
                  if (disabled) return;
                  setX(p.x);
                  setY(p.y);
                  setLag(p.lag);
                }}
                disabled={disabled}
                className={`holy-card p-4 text-left transition ${
                  disabled
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:border-[--color-coach]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-display font-medium text-[--color-ink]">
                    {p.label}
                  </div>
                  <DataPill state={dataState} n={Math.max(0, usable)} />
                </div>
                <div className="text-xs text-[--color-ink-mid] mt-1.5 leading-snug">
                  {p.why}
                </div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-[--color-ink-dim] mt-2 font-semibold">
                  lag = {p.lag} day{p.lag !== 1 ? "s" : ""} ·{" "}
                  <span style={{ color: `var(--color-${p.voice})` }}>{p.voice}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <FutureWorkNote />
    </div>
  );
}

// ---- subcomponents -------------------------------------------------------

function Picker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: keyof Score;
  onChange: (v: keyof Score) => void;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.16em] text-[--color-ink-dim] mb-2">
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as keyof Score)}
        className="px-3 py-2 rounded-lg bg-[--color-bg] border border-[--color-border] w-full"
      >
        {FIELDS.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
            {f.unit ? ` (${f.unit})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

type StatTone = "good" | "warn" | "bad" | "neutral";

function toneStyles(tone: StatTone): React.CSSProperties {
  if (tone === "good") {
    return {
      background: "color-mix(in oklab, var(--color-good) 12%, transparent)",
      color: "var(--color-good)",
      borderColor: "color-mix(in oklab, var(--color-good) 30%, transparent)",
    };
  }
  if (tone === "warn") {
    return {
      background: "color-mix(in oklab, var(--color-warn) 12%, transparent)",
      color: "var(--color-warn)",
      borderColor: "color-mix(in oklab, var(--color-warn) 30%, transparent)",
    };
  }
  if (tone === "bad") {
    return {
      background: "color-mix(in oklab, var(--color-race) 14%, transparent)",
      color: "var(--color-race)",
      borderColor: "color-mix(in oklab, var(--color-race) 30%, transparent)",
    };
  }
  return {};
}

function Stat({ label, value, tone }: { label: string; value: string; tone: StatTone }) {
  return (
    <div
      className={`holy-card p-4 text-center ${tone === "neutral" ? "" : "border"}`}
      style={tone === "neutral" ? undefined : toneStyles(tone)}
    >
      <div className="text-[11px] uppercase tracking-[0.16em] mb-1 opacity-80 font-semibold">
        {label}
      </div>
      <div className="font-display text-2xl font-semibold tabular">{value}</div>
    </div>
  );
}

/**
 * R² stat with traffic-light tone using sports-science magnitude thresholds
 * (Hopkins scale — equivalent r ≈ 0.3 / 0.5 / 0.7). For noisy daily wellness
 * data, R² ≥ 0.10 is already worth surfacing; R² ≥ 0.25 is genuinely notable.
 */
function R2Stat({ r }: { r: number }) {
  const r2 = r * r;
  const tone: StatTone = r2 >= 0.25 ? "good" : r2 >= 0.1 ? "warn" : "neutral";
  const verdict =
    r2 >= 0.5
      ? "very strong"
      : r2 >= 0.25
      ? "meaningful"
      : r2 >= 0.1
      ? "weak but present"
      : "negligible";
  return (
    <div
      className={`holy-card p-4 text-center ${tone === "neutral" ? "" : "border"}`}
      style={tone === "neutral" ? undefined : toneStyles(tone)}
    >
      <div className="text-[11px] uppercase tracking-[0.16em] mb-1 opacity-80 font-semibold">
        R²
      </div>
      <div className="font-display text-2xl font-semibold tabular">{r2.toFixed(2)}</div>
      <div className="text-[10px] uppercase tracking-[0.14em] mt-0.5 opacity-80 font-semibold">
        {verdict}
      </div>
    </div>
  );
}

/**
 * Sample-size stat. Cohen 1988 power tables: detecting r = 0.3 at α = .05,
 * power = .8 needs n ≈ 84. So 60+ is the comfort zone, 30–60 is provisional,
 * < 30 is "interesting hint, not a finding."
 */
function SampleStat({ n }: { n: number }) {
  const tone: StatTone = n >= 60 ? "good" : n >= 30 ? "warn" : "bad";
  const verdict = n >= 60 ? "robust" : n >= 30 ? "provisional" : "too small";
  return (
    <div className="holy-card p-4 text-center border" style={toneStyles(tone)}>
      <div className="text-[11px] uppercase tracking-[0.16em] mb-1 opacity-80 font-semibold">
        Sample
      </div>
      <div className="font-display text-2xl font-semibold tabular">n = {n}</div>
      <div className="text-[10px] uppercase tracking-[0.14em] mt-0.5 opacity-80 font-semibold">
        {verdict}
      </div>
    </div>
  );
}

function DataPill({ state, n }: { state: "missing" | "thin" | "ready"; n: number }) {
  const tone: StatTone = state === "ready" ? "good" : state === "thin" ? "warn" : "bad";
  const label = state === "missing" ? "needs data" : state === "thin" ? `n ≈ ${n}` : `n = ${n}`;
  return (
    <span
      className="text-[9px] uppercase tracking-[0.14em] font-semibold px-2 py-0.5 rounded-full border shrink-0"
      style={toneStyles(tone)}
    >
      {label}
    </span>
  );
}

/**
 * Inline explainer — surfaces the rules-of-thumb so the user can read R²
 * without a stats refresher every visit.
 */
function ExplainerPanel() {
  return (
    <div className="holy-card p-5 bg-[--color-surface-2]">
      <div className="flex items-start gap-3 mb-3">
        <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--color-coach)" }} />
        <div>
          <div className="font-display font-semibold text-[--color-ink] text-sm">
            How to read this
          </div>
          <p className="text-xs text-[--color-ink-mid] mt-1 leading-relaxed">
            <strong>R²</strong> is the headline number — it answers
            <em> "how much of Y is explained by X?"</em> 0.25 means 25% of the
            variation is explained by the relationship — the rest is everything
            else (other lifestyle factors, noise, the day's randomness).
            Correlation <strong>r</strong> shows the same relationship as a
            ±1 number — useful for direction, less honest about strength.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <ScaleSwatch tone="neutral" label="< 0.10" sub="negligible" />
        <ScaleSwatch tone="warn" label="0.10 – 0.25" sub="weak but present" />
        <ScaleSwatch tone="good" label="≥ 0.25" sub="meaningful" />
      </div>

      <div className="text-[11px] text-[--color-ink-dim] mt-3 leading-snug">
        Sport-science thresholds (Hopkins scale) are friendlier than finance —
        biological signals are noisy. A <strong>R² of 0.10</strong> in daily
        wellness data is already worth a look; <strong>0.25+</strong> is a real
        signal. <strong>n ≥ 60</strong> paired days makes the read trustworthy;
        below 30 is a hint, not a finding.
      </div>
    </div>
  );
}

function ScaleSwatch({ tone, label, sub }: { tone: StatTone; label: string; sub: string }) {
  return (
    <div
      className={`px-2.5 py-2 rounded-lg text-center ${tone === "neutral" ? "" : "border"}`}
      style={tone === "neutral" ? { background: "var(--color-surface)" } : toneStyles(tone)}
    >
      <div className="font-display font-semibold tabular">{label}</div>
      <div className="text-[10px] uppercase tracking-[0.12em] opacity-80 font-semibold mt-0.5">
        {sub}
      </div>
    </div>
  );
}

function PitfallsCallout() {
  return (
    <div
      className="holy-card p-4 border-l-4"
      style={{
        background: "color-mix(in oklab, var(--color-warn) 8%, transparent)",
        borderLeftColor: "var(--color-warn)",
      }}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--color-warn)" }} />
        <div className="text-xs text-[--color-ink-mid] leading-relaxed">
          <strong className="text-[--color-ink]">Watch out for:</strong>{" "}
          <em>autocorrelation</em> (today is similar to yesterday — inflates
          apparent strength), <em>multiple comparisons</em> (with 8 metrics
          there are 28 pairs; pin a curated set, don't fish), and{" "}
          <em>Simpson's paradox</em> (a trend can flip inside a single cycle
          phase). Treat scatter readouts as one signal among many — the
          insight is the <em>pattern over weeks</em>, not the daily blip.
        </div>
      </div>
    </div>
  );
}

function FutureWorkNote() {
  return (
    <div className="text-[11px] text-[--color-ink-dim] italic max-w-2xl">
      Coming next: training-load → next-day HRV (needs activity-table join),
      cycle-phase × HRV box plot (categorical), and a small "controlled-for"
      multivariate read for the headline relationship — only when n ≥ 90.
    </div>
  );
}

function fieldLabel(key: keyof Score) {
  return FIELDS.find((f) => f.key === key)?.label ?? key;
}

function regress(rows: Score[], x: keyof Score, y: keyof Score, lag: number) {
  const points: { x: number; y: number; date: string }[] = [];
  for (let i = 0; i < rows.length - lag; i++) {
    const xv = rows[i][x];
    const yv = rows[i + lag][y];
    if (typeof xv === "number" && typeof yv === "number") {
      points.push({ x: xv, y: yv, date: rows[i].date });
    }
  }
  if (points.length < 10) return null;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const r = sampleCorrelation(xs, ys);
  const reg = linearRegression(points.map((p) => [p.x, p.y]));
  const lineFn = linearRegressionLine(reg);

  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const line = [
    { line: lineFn(xMin), x: xMin },
    { line: lineFn(xMax), x: xMax },
  ];

  const r2 = r * r;
  const strength =
    r2 >= 0.5 ? "strong" : r2 >= 0.25 ? "meaningful" : r2 >= 0.1 ? "weak but present" : "negligible";
  const direction = r > 0 ? "positive" : "negative";
  // Sample-size disclaimer is direction-aware: small n + small r² = noise.
  const confidence =
    points.length < 30
      ? " Sample is small — treat as a hint, not a finding."
      : points.length < 60
      ? " Sample is provisional — log a few more weeks to firm it up."
      : "";
  const read = `${fieldLabel(x)} ${
    lag > 0 ? `${lag} day${lag === 1 ? "" : "s"} earlier` : "today"
  } shows a ${strength} ${direction} relationship with ${fieldLabel(y)} (r = ${r.toFixed(
    2,
  )}, R² = ${r2.toFixed(2)}, n = ${points.length}). ${
    r2 < 0.1
      ? "Don't read too much into it."
      : r2 < 0.25
      ? "Real but small — useful as one signal among many."
      : "Worth paying attention to."
  }${confidence}`;

  return { r, points, line, read };
}
