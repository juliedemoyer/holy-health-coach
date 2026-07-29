/**
 * MetricChart — a smart line chart with threshold zones, an average
 * reference line, and out-of-range callout dots. Used on /vitals for
 * each KPI.
 */

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";

interface Threshold {
  /** Domain low value (chart bottom). */
  low?: number;
  /** Domain high value (chart top). */
  high?: number;
  /** Below this is bad (red); render a tinted band. */
  badBelow?: number;
  /** Above this is bad (red); render a tinted band. */
  badAbove?: number;
  /** Within [goodLow, goodHigh] is acceptable (amber); render a soft tint. */
  goodLow?: number;
  goodHigh?: number;
  /** Above this is excellent (green). For metrics where higher = better. */
  excellentAbove?: number;
  /** Below this is excellent (green). For metrics where lower = better (RHR, body fat). */
  excellentBelow?: number;
}

interface Props {
  data: Array<{ date: string; value: number | null }>;
  unit: string;
  colour: string;
  thresholds?: Threshold;
  /** Show horizontal line at average value (computed from data). */
  showAverage?: boolean;
  /** Custom average label */
  averageLabel?: string;
  /** Override min on the y-axis */
  yMin?: number | "auto";
  yMax?: number | "auto";
}

export function MetricChart({
  data,
  unit,
  colour,
  thresholds,
  showAverage = true,
  averageLabel,
  yMin = "auto",
  yMax = "auto",
}: Props) {
  const values = data.map((d) => d.value).filter((v): v is number => v !== null);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

  // Per-point bad/good detection for callout dots
  const enriched = data.map((d) => ({
    ...d,
    bad:
      d.value !== null &&
      thresholds &&
      ((thresholds.badBelow !== undefined && d.value < thresholds.badBelow) ||
        (thresholds.badAbove !== undefined && d.value > thresholds.badAbove)),
  }));

  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={enriched} margin={{ left: -10, right: 12, top: 10, bottom: 4 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--color-ink-dim)" }}
            tickFormatter={(v) => format(new Date(v), "d MMM")}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: "var(--color-ink-dim)" }}
            width={36}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "var(--shadow-2)",
            }}
            labelFormatter={(d) => format(new Date(d), "EEE d MMM")}
            formatter={(v: number) => [`${v}${unit ? " " + unit : ""}`, ""]}
          />

          {/* Threshold zones — drawn first so they sit behind the line.
              Three tiers: red (bad) → amber (good) → green (excellent). */}
          {thresholds?.badBelow !== undefined && (
            <ReferenceArea
              y1={yMin === "auto" ? 0 : yMin}
              y2={thresholds.badBelow}
              fill="var(--color-bad-soft)"
              ifOverflow="extendDomain"
              fillOpacity={1}
            />
          )}
          {thresholds?.badAbove !== undefined && (
            <ReferenceArea
              y1={thresholds.badAbove}
              y2={yMax === "auto" ? 999 : yMax}
              fill="var(--color-bad-soft)"
              ifOverflow="extendDomain"
              fillOpacity={1}
            />
          )}
          {thresholds?.goodLow !== undefined && thresholds?.goodHigh !== undefined && (
            <ReferenceArea
              y1={thresholds.goodLow}
              y2={thresholds.goodHigh}
              fill="var(--color-good-soft)"
              fillOpacity={1}
            />
          )}
          {thresholds?.excellentAbove !== undefined && (
            <ReferenceArea
              y1={thresholds.excellentAbove}
              y2={yMax === "auto" ? 999 : yMax}
              fill="color-mix(in oklab, var(--color-good) 22%, transparent)"
              ifOverflow="extendDomain"
              fillOpacity={1}
            />
          )}
          {thresholds?.excellentBelow !== undefined && (
            <ReferenceArea
              y1={yMin === "auto" ? 0 : yMin}
              y2={thresholds.excellentBelow}
              fill="color-mix(in oklab, var(--color-good) 22%, transparent)"
              ifOverflow="extendDomain"
              fillOpacity={1}
            />
          )}

          {/* Average */}
          {showAverage && avg !== null && (
            <ReferenceLine
              y={avg}
              stroke="var(--color-ink-dim)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `${averageLabel ?? "avg"} ${avg.toFixed(1)}`,
                position: "right",
                fontSize: 10,
                fill: "var(--color-ink-dim)",
              }}
            />
          )}

          {/* The line itself */}
          <Line
            type="monotone"
            dataKey="value"
            stroke={colour}
            strokeWidth={2.5}
            isAnimationActive={false}
            connectNulls
            dot={(props: { cx?: number; cy?: number; payload?: { bad?: boolean } }) => {
              if (props.cx === undefined || props.cy === undefined) {
                return <g />;
              }
              const isBad = props.payload?.bad;
              if (!isBad) return <g />;
              return (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={4}
                  fill="var(--color-bad)"
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
