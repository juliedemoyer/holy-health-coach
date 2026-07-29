import { NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  Apple,
  BookOpen,
  CalendarRange,
  Camera,
  Flag,
  HeartPulse,
  LineChart,
  Notebook,
} from "lucide-react";
import { raceStatus } from "@/lib/race";
import { supabase } from "@/lib/supabase";
import { APP_NAME } from "@/lib/config";

const NAV = [
  { to: "/", label: APP_NAME, Icon: Flag, end: true },
  { to: "/vitals", label: "Vitals", Icon: HeartPulse },
  { to: "/training", label: "Training", Icon: Activity },
  { to: "/nutrition", label: "Nutrition", Icon: Apple },
  { to: "/body", label: "Body", Icon: Camera },
  { to: "/marathons", label: "Marathons", Icon: CalendarRange },
  { to: "/regressions", label: "Regressions", Icon: LineChart },
  { to: "/journal", label: "Journal", Icon: Notebook },
  { to: "/knowledge", label: "Knowledge", Icon: BookOpen },
];

export function Layout() {
  const status = raceStatus();
  const phaseColor =
    status.phase === "Race week" || status.phase === "Taper"
      ? "var(--color-race)"
      : status.phase === "Peak"
      ? "var(--color-warn)"
      : "var(--color-coach)";

  return (
    <div className="min-h-screen flex flex-col safe-pb">
      <header
        className="px-5 sm:px-8 py-3 sm:py-4 border-b border-[--color-border] bg-[--color-surface]/85 backdrop-blur-md sticky top-0 z-10"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <NavLink to="/" className="flex items-baseline gap-3">
            <span className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[--color-ink]">
              Holy
            </span>
            <span className="text-xs uppercase tracking-[0.22em] text-[--color-ink-dim] hidden sm:inline">
              {APP_NAME}
            </span>
          </NavLink>

          <div className="flex items-center gap-3 text-xs sm:text-sm">
            <span
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: `color-mix(in oklab, ${phaseColor} 8%, transparent)`,
                color: phaseColor,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: phaseColor }}
              />
              <span className="tabular font-semibold">{status.daysToRace}d</span>
              <span className="opacity-80">·</span>
              <span className="uppercase tracking-[0.14em] text-[10px] font-semibold">
                {status.phase}
              </span>
            </span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-[--color-ink-dim] hover:text-[--color-ink] transition px-2 py-1 rounded-md hover:bg-[--color-surface-2]"
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-8 py-6 sm:py-10 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>

      <nav className="border-t border-[--color-border] bg-[--color-surface]/95 backdrop-blur-md sticky bottom-0">
        <div className="max-w-7xl mx-auto overflow-x-auto">
          <div className="flex items-stretch min-w-max sm:justify-center gap-1 px-2 py-1.5">
            {NAV.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    "flex flex-col sm:flex-row items-center gap-1 sm:gap-2",
                    "px-3 py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap transition",
                    isActive
                      ? "bg-[--color-accent-soft] text-[--color-accent-deep] font-semibold"
                      : "text-[--color-ink-mid] hover:text-[--color-ink] hover:bg-[--color-surface-2]",
                  ].join(" ")
                }
              >
                <Icon className="w-4 h-4" aria-hidden />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}
