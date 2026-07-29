/**
 * MoodRibbon — 30-day strip showing one cell per day, coloured by mood (1–10).
 * Sits under the vitals charts so you can spot mood/HRV/sleep relationships
 * at a glance. Mind's idea: pattern recognition does the coaching.
 */

import { format } from "date-fns";
import type { Score } from "@/lib/insights";
import { AGENTS } from "@/components/AgentAvatar";

interface Props {
  rows: Score[];
  /** Days to display (default 30). */
  days?: number;
}

const FACES = ["😩", "😞", "😕", "😐", "🙂", "😊", "😄", "😁", "🤩", "🌟"];

function colorFor(mood: number | null | undefined): string {
  if (mood === null || mood === undefined) return "var(--color-surface-2)";
  if (mood <= 3) return "var(--color-bad-soft)";
  if (mood <= 5) return "var(--color-warn-soft)";
  if (mood <= 7) return "color-mix(in oklab, var(--color-good) 25%, white)";
  return "color-mix(in oklab, var(--color-good) 50%, white)";
}

export function MoodRibbon({ rows, days = 30 }: Props) {
  const slice = rows.slice(-days);
  const hasAny = slice.some((r) => typeof r.mood === "number");

  return (
    <div className="holy-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-[11px] uppercase tracking-[0.16em] font-bold"
          style={{ color: AGENTS.mind.hue }}
        >
          Mood ribbon
        </span>
        <span className="text-xs text-[--color-ink-dim]">· last {days} days</span>
      </div>
      {hasAny ? (
        <>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {slice.map((r) => {
              const mood = typeof r.mood === "number" ? r.mood : null;
              return (
                <div
                  key={r.date}
                  className="flex flex-col items-center gap-1 shrink-0"
                  title={
                    mood !== null
                      ? `${format(new Date(r.date), "EEE d MMM")} · mood ${mood}/10`
                      : `${format(new Date(r.date), "EEE d MMM")} · no log`
                  }
                >
                  <div
                    className="w-5 h-7 sm:w-6 sm:h-8 rounded grid place-items-center text-[10px] sm:text-xs"
                    style={{ background: colorFor(mood) }}
                  >
                    {mood !== null && FACES[Math.max(0, Math.min(9, Math.round(mood) - 1))]}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-[11px] text-[--color-ink-dim] mt-2 italic">
            Mind looks for clusters — flat moods following short sleep weeks, or sustained ↑
            after race-rehearsal long runs. Hover for details.
          </div>
        </>
      ) : (
        <div className="text-sm text-[--color-ink-mid] text-center py-4">
          Mood not logged yet. Add it to the morning Shortcut (1–10 slider) to start.
        </div>
      )}
    </div>
  );
}
