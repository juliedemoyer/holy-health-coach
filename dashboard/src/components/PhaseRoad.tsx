/**
 * PhaseRoad — the marathon build journey as a connected road.
 *
 * Shows the 5 phases (Base → Build → Peak → Taper → Race) as stations
 * along a path, with your current position marked. Replaces the
 * disconnected segmented bars with something that actually feels like
 * a journey.
 */

import type { RaceStatus } from "@/lib/race";
import { format } from "date-fns";
import { RACE_DATE } from "@/lib/config";

const PHASES = [
  { name: "Base", maxDays: 1000, minDays: 112, blurb: "Volume + strength" },
  { name: "Build", maxDays: 112, minDays: 56, blurb: "Add quality" },
  { name: "Peak", maxDays: 56, minDays: 28, blurb: "Highest load" },
  { name: "Taper", maxDays: 28, minDays: 7, blurb: "Drop volume" },
  { name: "Race", maxDays: 7, minDays: 0, blurb: format(RACE_DATE, "d MMM") },
] as const;

interface Props {
  status: RaceStatus;
}

export function PhaseRoad({ status }: Props) {
  const days = status.daysToRace;
  const activeIdx = PHASES.findIndex((p) => days <= p.maxDays && days > p.minDays);
  const finalIdx = activeIdx < 0 ? PHASES.length - 1 : activeIdx;

  return (
    <div className="relative">
      {/* The connecting road */}
      <div className="absolute top-5 left-[5%] right-[5%] h-1 rounded-full bg-[--color-border]" />
      <div
        className="absolute top-5 left-[5%] h-1 rounded-full transition-all"
        style={{
          width: `${(finalIdx / Math.max(PHASES.length - 1, 1)) * 90}%`,
          background: "linear-gradient(90deg, var(--color-coach), var(--color-warn) 70%, var(--color-race))",
        }}
      />

      {/* The 5 stations */}
      <div className="grid grid-cols-5 gap-2 relative">
        {PHASES.map((phase, idx) => {
          const passed = idx < finalIdx;
          const active = idx === finalIdx;
          const upcoming = idx > finalIdx;
          const dotColor = passed
            ? "var(--color-coach)"
            : active
            ? phase.name === "Race"
              ? "var(--color-race)"
              : phase.name === "Taper"
              ? "var(--color-race)"
              : phase.name === "Peak"
              ? "var(--color-warn)"
              : "var(--color-coach)"
            : "var(--color-surface-2)";

          return (
            <div key={phase.name} className="flex flex-col items-center text-center">
              {/* Station dot */}
              <div className="relative h-10 flex items-center justify-center">
                <div
                  className={`rounded-full transition-all ${active ? "w-5 h-5" : "w-3 h-3"}`}
                  style={{
                    background: dotColor,
                    boxShadow: active ? `0 0 0 6px ${dotColor}25` : undefined,
                    border: upcoming ? `2px solid var(--color-border-strong)` : undefined,
                  }}
                />
                {phase.name === "Race" && (
                  <span
                    className="absolute -top-1 -right-1 text-[10px]"
                    style={{ color: "var(--color-race)" }}
                  >
                    🏁
                  </span>
                )}
              </div>
              {/* Station label */}
              <div
                className={`text-[10px] uppercase tracking-[0.16em] font-semibold mt-1 ${
                  active ? "" : passed ? "text-[--color-ink-mid]" : "text-[--color-ink-dim]"
                }`}
                style={active ? { color: dotColor } : {}}
              >
                {phase.name}
              </div>
              <div
                className={`text-[10px] mt-0.5 ${
                  active ? "text-[--color-ink-mid]" : "text-[--color-ink-dim]"
                }`}
              >
                {phase.blurb}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active phase progress bar — fine-grained within the active station */}
      {finalIdx < PHASES.length - 1 && (
        <div className="mt-4 px-[5%]">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[--color-ink-dim] mb-1">
            {Math.round(status.phaseProgressPct)}% through {status.phase}
          </div>
          <div className="h-1 rounded-full bg-[--color-surface-2] overflow-hidden">
            <div
              className="h-full transition-all"
              style={{
                width: `${status.phaseProgressPct}%`,
                background: "var(--color-accent)",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
