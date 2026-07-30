/**
 * ExecSummary V3 — progress since build start (1 May 2026).
 *
 * Shows today's value + the **absolute** build-start baseline (first 7 days
 * of the build) + an arrow showing the direction of change since then.
 * Border tints when today's value breaches a metric-specific threshold.
 *   HRV:    breach below your configured HRV baseline floor
 *   RHR:    breach if today > 50
 *   Sleep:  breach if today < 7.5h (Doc's recommendation; hard 8h was too coarse)
 *   BB:     breach if today < 80
 *   VO₂max: breach if today < 50
 *   Weight: no breach (trend-only metric)
 */

import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import {
  BB_GOOD_FLOOR,
  BODY_FAT_BUILD_START,
  HRV_BASE_HIGH,
  HRV_BASE_LOW,
  RHR_GOOD_HIGH,
  SLEEP_GOOD_HOURS,
  VO2_GOOD_FLOOR,
  compare,
  compareSinceBuildStart,
  mostRecent,
  todaysValue,
  type Score,
} from "@/lib/insights";
import { KPIInfo } from "@/components/KPIInfo";
import { rank, fitnessAge, KPI_DESCRIPTIONS, type KPIKey } from "@/lib/percentiles";
import { age as ageInYears } from "@/lib/profile";

type DescribedKpi = keyof typeof KPI_DESCRIPTIONS;
const RANKABLE_KPIS = new Set<DescribedKpi>([
  "hrv", "rhr", "vo2max", "sleep_hours",
  "body_fat_percent", "lowest_overnight_hr", "grip_kg",
]);

interface Props {
  rows: Score[];
}

export function ExecSummary({ rows }: Props) {
  const hasAny = rows.length > 0;
  if (!hasAny) {
    return (
      <div className="holy-card p-6 text-center text-sm text-[--color-ink-mid]">
        No vitals yet — log your morning numbers via the iPhone Shortcut to start filling this in.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      <Card
        label="HRV"
        unit="ms"
        cmp={compareSinceBuildStart(rows, "hrv")}
        cmpLast7d={compare(rows, "hrv")}
        format={(n) => Math.round(n).toString()}
        higherIsBetter
        breach={(v) => v < HRV_BASE_LOW}
        breachColor="var(--color-bad)"
        rangeHint={`band ${HRV_BASE_LOW}–${HRV_BASE_HIGH}`}
        kpi="hrv"
      />
      <Card
        label="Resting HR"
        unit="bpm"
        cmp={compareSinceBuildStart(rows, "rhr")}
        cmpLast7d={compare(rows, "rhr")}
        format={(n) => Math.round(n).toString()}
        higherIsBetter={false}
        breach={(v) => v > RHR_GOOD_HIGH}
        breachColor="var(--color-warn)"
        rangeHint={`target ≤${RHR_GOOD_HIGH}`}
        kpi="rhr"
      />
      <Card
        label="Sleep"
        unit="h"
        cmp={compareSinceBuildStart(rows, "sleep_hours")}
        cmpLast7d={compare(rows, "sleep_hours")}
        format={(n) => n.toFixed(1)}
        higherIsBetter
        rangeHint={`floor ${SLEEP_GOOD_HOURS}h`}
        kpi="sleep_hours"
      />
      <Card
        label="Weight"
        unit="kg"
        cmp={compareSinceBuildStart(rows, "weight_kg")}
        cmpLast7d={compare(rows, "weight_kg")}
        format={(n) => n.toFixed(1)}
        higherIsBetter={false}
        neutralDirection
        emptyHint="Step on the scale →"
        kpi="weight_kg"
      />
      <Card
        label="Body Battery"
        unit=""
        cmp={compareSinceBuildStart(rows, "body_battery")}
        cmpLast7d={compare(rows, "body_battery")}
        format={(n) => Math.round(n).toString()}
        higherIsBetter
        breach={(v) => v < BB_GOOD_FLOOR}
        breachColor="var(--color-warn)"
        rangeHint={`floor ${BB_GOOD_FLOOR}`}
        kpi="body_battery"
      />
      <Card
        label="VO₂max"
        unit=""
        cmp={{
          ...compareSinceBuildStart(rows, "vo2max"),
          current: todaysValue(rows, "vo2max") ?? mostRecent(rows, "vo2max"),
        }}
        cmpLast7d={compare(rows, "vo2max")}
        format={(n) => n.toFixed(1)}
        higherIsBetter
        breach={(v) => v < VO2_GOOD_FLOOR}
        breachColor="var(--color-warn)"
        rangeHint={`floor ${VO2_GOOD_FLOOR}`}
        kpi="vo2max"
      />
      <Card
        label="Body fat"
        unit="%"
        cmp={{
          ...compareSinceBuildStart(rows, "body_fat_percent", BODY_FAT_BUILD_START ?? undefined),
          current:
            todaysValue(rows, "body_fat_percent") ??
            mostRecent(rows, "body_fat_percent"),
        }}
        cmpLast7d={compare(rows, "body_fat_percent")}
        format={(n) => n.toFixed(1)}
        higherIsBetter={false}
        rangeHint={BODY_FAT_BUILD_START === null ? undefined : `start ${BODY_FAT_BUILD_START}%`}
        emptyHint="Scale reading needed →"
        kpi="body_fat_percent"
      />
      <GripCard rows={rows} />
      <FitnessAgeCard
        vo2={
          todaysValue(rows, "vo2max") ?? mostRecent(rows, "vo2max")
        }
      />
    </div>
  );
}

/** Grip strength tile — shows R and L separately with previous + build-start comparisons.
 *  Grip is sparse (Sunday only), so comparisons are computed from actual non-null
 *  readings rather than rolling averages. */
function GripCard({ rows }: { rows: Score[] }) {
  const r = todaysValue(rows, "grip_r_kg") ?? mostRecent(rows, "grip_r_kg");
  const l = todaysValue(rows, "grip_l_kg") ?? mostRecent(rows, "grip_l_kg");
  const legacy = todaysValue(rows, "grip_kg") ?? mostRecent(rows, "grip_kg");
  const hasRL = r !== null || l !== null;
  const isEmpty = !hasRL && legacy === null;

  // Collect all rows with a grip reading (R or combined), ordered oldest→newest
  const field: keyof Score = hasRL ? "grip_r_kg" : "grip_kg";
  const gripReadings = rows.filter((row) => typeof row[field] === "number");
  const current = gripReadings.length > 0
    ? (gripReadings[gripReadings.length - 1][field] as number)
    : null;
  const previous = gripReadings.length > 1
    ? (gripReadings[gripReadings.length - 2][field] as number)
    : null;
  const first = gripReadings.length > 0 ? (gripReadings[0][field] as number) : null;

  const vsPrev = current !== null && previous !== null ? current - previous : null;
  const vsBuild = current !== null && first !== null && first !== current ? current - first : null;

  const diffTone = (diff: number | null) =>
    diff === null
      ? "var(--color-ink-dim)"
      : diff > 0
      ? "var(--color-good)"
      : diff < 0
      ? "var(--color-bad)"
      : "var(--color-ink-dim)";

  return (
    <div className="holy-card p-4 transition relative">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[--color-ink-dim] font-semibold">
        Grip strength
      </div>
      {isEmpty ? (
        <div className="text-xs text-[--color-ink-dim] mt-3 italic">Test Sunday evening →</div>
      ) : hasRL ? (
        <div className="flex items-baseline gap-3 mt-2">
          <div>
            <span className="font-display text-2xl font-bold tabular text-[--color-ink]">
              {r !== null ? r.toFixed(1) : "—"}
            </span>
            <span className="text-[10px] text-[--color-ink-dim] ml-1">kg R</span>
          </div>
          <div>
            <span className="font-display text-2xl font-bold tabular text-[--color-ink]">
              {l !== null ? l.toFixed(1) : "—"}
            </span>
            <span className="text-[10px] text-[--color-ink-dim] ml-1">kg L</span>
          </div>
        </div>
      ) : (
        <div className="flex items-baseline gap-1.5 mt-2">
          <span className="font-display text-3xl font-bold tabular text-[--color-ink]">
            {legacy!.toFixed(1)}
          </span>
          <span className="text-xs text-[--color-ink-mid] mb-0.5">kg</span>
        </div>
      )}
      {!isEmpty && (
        <div className="space-y-1 mt-1.5">
          {vsPrev !== null && (
            <div className="flex items-center gap-1 text-xs">
              <span className="tabular font-semibold" style={{ color: diffTone(vsPrev) }}>
                {vsPrev >= 0 ? "+" : ""}{vsPrev.toFixed(1)}
              </span>
              <span className="text-[--color-ink-dim] text-[10px]">vs previous reading</span>
            </div>
          )}
          {vsBuild !== null && (
            <div className="flex items-center gap-1 text-[10.5px]">
              <span className="tabular font-semibold" style={{ color: diffTone(vsBuild) }}>
                {vsBuild >= 0 ? "+" : ""}{vsBuild.toFixed(1)}
              </span>
              <span className="text-[--color-ink-dim] text-[10px]">vs build start</span>
            </div>
          )}
          {vsPrev === null && vsBuild === null && (
            <div className="text-xs text-[--color-ink-dim]">first reading</div>
          )}
        </div>
      )}
      <div className="absolute bottom-2 right-2">
        <KPIInfo kpi="grip_kg" />
      </div>
    </div>
  );
}

/** Fitness age tile — derived from VO₂max via the Cooper/HUNT inversion in
 *  `fitnessAge()`. Calibrated to land within ~1 yr of the Garmin on-watch
 *  value. Renders the chronological age as a sanity-check pill. */
function FitnessAgeCard({ vo2 }: { vo2: number | null }) {
  const chrono = ageInYears();
  const fa = fitnessAge(vo2);
  // chrono is null until AuthGuard hydrates the profile from the config row.
  const delta = fa !== null && chrono !== null ? chrono - fa : null;
  // Tone: younger-than-chrono → good (green), older → bad
  const tone =
    delta === null
      ? "var(--color-ink-mid)"
      : delta >= 5
      ? "var(--color-good)"
      : delta >= 1
      ? "color-mix(in oklab, var(--color-good) 65%, var(--color-ink-dim) 35%)"
      : delta <= -3
      ? "var(--color-bad)"
      : "var(--color-ink-mid)";
  return (
    <div className="holy-card p-4 transition relative">
      <div className="flex items-center justify-between gap-1">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[--color-ink-dim] font-semibold inline-flex items-center">
          Fitness age
          <KPIInfo kpi="fitness_age" />
        </div>
      </div>
      <div className="flex items-baseline gap-1.5 mt-2">
        <span className="font-display text-3xl font-bold tabular text-[--color-ink]">
          {fa ?? <span className="text-[--color-ink-dim]">—</span>}
        </span>
        <span className="text-xs text-[--color-ink-mid] mb-0.5">yrs</span>
      </div>
      {delta !== null ? (
        <div className="flex items-center gap-1 mt-1.5 text-xs text-[--color-ink-mid]">
          <span
            className="tabular font-semibold"
            style={{ color: tone }}
          >
            {delta > 0
              ? `${delta} years younger than actual age`
              : delta < 0
              ? `${-delta} years older than actual age`
              : "matches actual age"}
          </span>
        </div>
      ) : (
        <div className="text-xs text-[--color-ink-dim] mt-1.5 italic">
          Need a VO₂max reading
        </div>
      )}
    </div>
  );
}

interface CardProps {
  label: string;
  unit: string;
  cmp: ReturnType<typeof compareSinceBuildStart>;
  /** Comparison vs prior 7 days (separate from build-start baseline). */
  cmpLast7d?: ReturnType<typeof compare>;
  format: (n: number) => string;
  higherIsBetter: boolean;
  /** Treat any change as informational. Used for weight. */
  neutralDirection?: boolean;
  breach?: (v: number) => boolean;
  breachColor?: string;
  emptyHint?: string;
  rangeHint?: string;
  /** When set, renders a `?` info icon (description hover) + a percentile
   *  badge ranking `cmp.current` against the reference cohort for your age group.
   *  Accepts any KPI we have a description for; rank() only runs for the
   *  ones with norm tables. */
  kpi?: DescribedKpi;
}

function Card({
  label,
  unit,
  cmp,
  cmpLast7d,
  format,
  higherIsBetter,
  neutralDirection,
  breach,
  breachColor,
  emptyHint,
  rangeHint,
  kpi,
}: CardProps) {
  const ranked =
    kpi && RANKABLE_KPIS.has(kpi) && cmp.current !== null
      ? rank(kpi as KPIKey, cmp.current)
      : null;
  const breached = cmp.current !== null && breach && breach(cmp.current);

  let arrowTone: "good" | "bad" | "flat" | "n/a" = "n/a";
  if (cmp.direction !== "n/a") {
    if (cmp.direction === "flat") arrowTone = "flat";
    else if (neutralDirection) arrowTone = "flat";
    else {
      const goingUp = cmp.direction === "up";
      arrowTone = goingUp === higherIsBetter ? "good" : "bad";
    }
  }
  const arrowColor =
    arrowTone === "good"
      ? "var(--color-good)"
      : arrowTone === "bad"
      ? "var(--color-bad)"
      : "var(--color-ink-dim)";

  const Arrow =
    cmp.direction === "up"
      ? ArrowUp
      : cmp.direction === "down"
      ? ArrowDown
      : ArrowRight;

  const badgeTone =
    !ranked
      ? "var(--color-ink-mid)"
      : ranked.topPct <= 10
      ? "var(--color-good)"
      : ranked.topPct <= 25
      ? "color-mix(in oklab, var(--color-good) 65%, var(--color-ink-dim) 35%)"
      : ranked.percentile < 45
      ? "var(--color-bad)"
      : "var(--color-ink-mid)";
  return (
    <div
      className="holy-card p-4 transition relative"
      style={breached ? { borderColor: breachColor, borderWidth: 1.5 } : undefined}
    >
      {breached && (
        <div
          className="absolute top-0 left-0 right-0 h-0.5 rounded-t-[inherit]"
          style={{ background: breachColor }}
        />
      )}
      <div className="flex items-center justify-between gap-1">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[--color-ink-dim] font-semibold">
          {label}
        </div>
        {rangeHint && (
          <div className="text-[9px] uppercase tracking-[0.1em] text-[--color-ink-dim]">
            {rangeHint}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1.5 mt-2">
        <span className="font-display text-3xl font-bold tabular text-[--color-ink]">
          {cmp.current !== null
            ? format(cmp.current)
            : <span className="text-[--color-ink-dim]">—</span>}
        </span>
        {cmp.current !== null && unit && (
          <span className="text-xs text-[--color-ink-mid] mb-0.5">{unit}</span>
        )}
      </div>
      {cmp.current !== null && cmp.diff !== null ? (
        <div className="space-y-1 mt-1.5">
          {/* vs build start */}
          <div className="flex items-center gap-1 text-xs text-[--color-ink-mid]">
            <Arrow className="w-3 h-3" style={{ color: arrowColor }} />
            <span className="tabular font-semibold" style={{ color: arrowColor }}>
              {cmp.diff >= 0 ? "+" : ""}{format(cmp.diff)}
            </span>
            <span className="text-[--color-ink-dim] text-[10px]">vs build start</span>
          </div>
          {/* vs last 7 days */}
          {cmpLast7d && cmpLast7d.diff !== null && (
            <div className="flex items-center gap-1 text-[10.5px] text-[--color-ink-dim]">
              {(() => {
                const d7 = cmpLast7d.diff ?? 0;
                const tone7 =
                  cmpLast7d.direction === "flat" || neutralDirection
                    ? "var(--color-ink-dim)"
                    : (cmpLast7d.direction === "up") === higherIsBetter
                    ? "var(--color-good)"
                    : "var(--color-bad)";
                return (
                  <>
                    <span className="tabular font-semibold" style={{ color: tone7 }}>
                      {d7 >= 0 ? "+" : ""}{format(d7)}
                    </span>
                    <span>vs last 7d</span>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      ) : cmp.current !== null && cmp.prior7d === null ? (
        <div className="text-xs text-[--color-ink-dim] mt-1.5">no comparison yet</div>
      ) : (
        <div className="text-xs text-[--color-ink-dim] mt-1.5 italic">
          {emptyHint ?? "no reading today"}
        </div>
      )}
      {/* Bottom-right cluster: percentile badge + ? info icon. Absolute-
       *  positioned so it always sits in the corner regardless of card height. */}
      {(ranked || kpi) && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
          {ranked && (
            <span
              title={ranked.label}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold tabular"
              style={{
                background: `color-mix(in oklab, ${badgeTone} 14%, transparent)`,
                color: badgeTone,
              }}
            >
              <span className="opacity-70 text-[9.5px] uppercase tracking-[0.14em]">
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
