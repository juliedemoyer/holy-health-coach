import { useEffect, useState } from "react";
import { CalendarRange } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/db";
import { formatTime } from "@/lib/race";
import { Empty, PageHeader } from "@/pages/Vitals";
import { RACE_NAME } from "@/lib/config";

type Marathon = Database["public"]["Tables"]["marathons"]["Row"];

const NOTEBOOK_LM_URL = import.meta.env.VITE_NOTEBOOK_LM_URL ?? "";

/**
 * Map a race name to the flag emoji of its host country.
 * Uses lowercase substring matching — tolerant of "City Marathon 2027" etc.
 */
function cityFlag(name: string): string {
  const n = name.toLowerCase();
    if (n.includes("amsterdam")) return "🇳🇱";
  if (n.includes("paris")) return "🇫🇷";
  if (n.includes("london")) return "🇬🇧";
  if (n.includes("new york") || n.includes("nyc")) return "🇺🇸";
  if (n.includes("chicago")) return "🇺🇸";
  if (n.includes("boston")) return "🇺🇸";
  if (n.includes("vienna") || n.includes("wien")) return "🇦🇹";
  if (n.includes("copenhagen")) return "🇩🇰";
  if (n.includes("brussels") || n.includes("bruxelles")) return "🇧🇪";
  if (n.includes("dubai")) return "🇦🇪";
  if (n.includes("oslo")) return "🇳🇴";
  if (n.includes("valencia")) return "🇪🇸";
  if (n.includes("tokyo")) return "🇯🇵";
  return "🏃";
}

export function Marathons() {
  const [rows, setRows] = useState<Marathon[]>([]);

  useEffect(() => {
    void supabase
      .from("marathons")
      .select("*")
      .order("race_date", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  }, []);

  const trend = rows.map((r) => ({
    date: r.race_date,
    finish_min: Math.round((r.finish_time_s / 60) * 10) / 10,
    name: r.race_name,
    isPB: false, // set below after pbSeconds is computed
  }));

  // PB across all logged marathons — used to render "vs PB" deltas in the
  // table. The dashboard never had useful weather/volume data; showing
  // distance-from-PB makes every row tell a story instead.
  const pbSeconds = rows.length
    ? Math.min(...rows.map((r) => r.finish_time_s))
    : null;

  // Mark PB entries in the trend data for dot colour coding
  const trendWithPB = trend.map((t) => ({
    ...t,
    isPB: pbSeconds !== null && Math.round(t.finish_min * 60) === pbSeconds,
  }));

  return (
    <div className="space-y-6">
      <PageHeader voice="coach" Icon={CalendarRange}>
        Marathons
      </PageHeader>

      {NOTEBOOK_LM_URL && (
        <a
          href={NOTEBOOK_LM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="holy-card p-4 sm:p-5 flex items-center gap-4 hover:border-[--color-coach] transition"
        >
          <div className="w-10 h-10 rounded-full bg-[--color-race] grid place-items-center text-white">
            ▶
          </div>
          <div className="flex-1">
            <div className="font-display font-medium text-[--color-ink]">
              10 marathons retrospective
            </div>
            <div className="text-xs text-[--color-ink-mid]">
              NotebookLM podcast — open in new tab
            </div>
          </div>
          <span className="text-[--color-ink-dim] text-sm">↗</span>
        </a>
      )}

      <section>
        <h3 className="font-display text-base font-medium text-[--color-ink] mb-3">
          Finish-time progression
        </h3>
        <div className="holy-card p-5 h-56">
          {trendWithPB.length === 0 ? (
            <Empty message="Run `npm run seed:marathons` to import the Excels in 1. Knowledge/Marathon Data/." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendWithPB} margin={{ left: -20, right: 6, top: 6, bottom: 6 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--color-ink-dim)" }}
                  tickFormatter={(v) => format(new Date(v), "MMM ''yy")}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--color-ink-dim)" }}
                  tickFormatter={(v) => formatTime(v * 60)}
                />
                <Tooltip
                  formatter={(v: number) => formatTime(v * 60)}
                  labelFormatter={(d) => format(new Date(d), "d MMM yyyy")}
                />
                <Line
                  type="monotone"
                  dataKey="finish_min"
                  stroke="var(--color-race)"
                  strokeWidth={2.5}
                  dot={(props) => {
                    const { cx, cy, payload } = props as { cx: number; cy: number; payload: { isPB: boolean } };
                    return payload.isPB ? (
                      <circle
                        key={`dot-${cx}-${cy}`}
                        cx={cx}
                        cy={cy}
                        r={6}
                        fill="var(--color-race)"
                        stroke="white"
                        strokeWidth={2}
                      />
                    ) : (
                      <circle
                        key={`dot-${cx}-${cy}`}
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill="white"
                        stroke="var(--color-race)"
                        strokeWidth={2}
                      />
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section>
        <h3 className="font-display text-base font-medium text-[--color-ink] mb-3">
          All marathons
        </h3>
        <div className="holy-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[--color-surface-2] text-[--color-ink-mid] text-xs uppercase tracking-[0.12em]">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Race</th>
                <th className="px-4 py-2 text-right">Finish</th>
                <th className="px-4 py-2 text-right hidden sm:table-cell">Pace</th>
                <th className="px-4 py-2 text-left hidden md:table-cell">City</th>
                <th className="px-4 py-2 text-right hidden md:table-cell">vs PB</th>
                <th
                  className="px-4 py-2 text-right hidden md:table-cell cursor-help"
                  title="Hitting the wall = glycogen depletion usually around km 30–35. Glycogen stores (~90 min of fuel) run out, forcing the body to burn fat — a much slower process. Proper pacing and carb loading prevents it."
                >
                  Hit wall ⓘ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--color-border]">
              {/* the goal race — upcoming, always first since sorted desc */}
              <tr className="opacity-50">
                <td className="px-4 py-2.5 whitespace-nowrap text-[--color-ink-dim]">27 Sep 2026</td>
                <td className="px-4 py-2.5 text-[--color-ink-dim]">
                  {RACE_NAME}
                  <span className="ml-2 text-[10px] uppercase tracking-[0.12em] font-semibold px-1.5 py-0.5 rounded border border-[--color-border] text-[--color-ink-dim]">upcoming</span>
                </td>
                <td className="px-4 py-2.5 text-right text-[--color-ink-dim]">—</td>
                <td className="px-4 py-2.5 text-right text-[--color-ink-dim] hidden sm:table-cell">—</td>
                <td className="px-4 py-2.5 text-[--color-ink-dim] hidden md:table-cell">the race</td>
                <td className="px-4 py-2.5 text-right text-[--color-ink-dim] hidden md:table-cell">—</td>
                <td className="px-4 py-2.5 text-right text-[--color-ink-dim] hidden md:table-cell">—</td>
              </tr>
              {rows.map((r) => {
                const isPB = pbSeconds !== null && r.finish_time_s === pbSeconds;
                const isDim = pbSeconds !== null && !isPB && r.finish_time_s - pbSeconds > 30 * 60;
                const finishColor = isPB
                  ? "var(--color-good)"
                  : isDim
                  ? "var(--color-ink-mid)"
                  : "var(--color-ink)";
                return (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-[--color-ink]">
                    {format(new Date(r.race_date), "d MMM yyyy")}
                  </td>
                  <td className="px-4 py-2.5 text-[--color-ink]">
                    <span className="mr-1.5">{cityFlag(r.race_name)}</span>
                    {r.race_name}
                  </td>
                  <td
                    className="px-4 py-2.5 text-right tabular-nums"
                    style={{ color: finishColor, fontWeight: isPB ? 700 : undefined }}
                  >
                    {formatTime(r.finish_time_s)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[--color-ink-mid] tabular-nums hidden sm:table-cell">
                    {r.avg_pace_s_per_km
                      ? `${Math.floor(r.avg_pace_s_per_km / 60)}:${(r.avg_pace_s_per_km % 60).toString().padStart(2, "0")}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[--color-ink-mid] hidden md:table-cell">
                    {cityFromName(r.race_name)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums hidden md:table-cell">
                    {pbSeconds !== null && r.finish_time_s === pbSeconds ? (
                      <span
                        className="text-[10px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: "var(--color-good-soft)", color: "var(--color-good)" }}
                      >
                        PB
                      </span>
                    ) : pbSeconds !== null ? (
                      <span className="text-[--color-ink-mid]">
                        +{formatTime(r.finish_time_s - pbSeconds)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[--color-ink-mid] tabular-nums hidden md:table-cell">
                    {r.wall_km ? `km ${r.wall_km}` : "—"}
                  </td>
                </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[--color-ink-dim]">
                    Empty
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/**
 * Strip "Marathon" / "Half Marathon" / trailing dates from a race name to
 * get a clean city label for the table — "Valencia Marathon" → "Valencia",
 * "City Marathon 2027" → "City". Tolerant of extra words by taking
 * everything before the first "Marathon".
 */
function cityFromName(name: string): string {
  const m = name.split(/marathon/i);
  return (m[0] ?? name).trim() || name;
}
