import { useEffect, useMemo, useState } from "react";
import { Activity as ActivityIcon, AlertCircle, Footprints, Target, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/db";
import { raceStatus, formatPace, formatTime, RACE_GOALS, GOAL_TARGET } from "@/lib/race";
import {
  COACH_PLAN,
  acwr,
  aggregateActuals,
  aggregateByKind,
  consistencyPct,
  estimateMaxHr,
  expandSessions,
  expandSessionsWithOverrides,
  weekHasTravel,
  travelBlockFor,
  planWeekFor,
  racePaceZones,
  whatsLeftThisWeek,
  type Session,
  type SessionKind,
} from "@/lib/coachPlan";
import { AGENTS, AgentAvatar } from "@/components/AgentAvatar";
import { PLAN_REVISION } from "@/lib/config";
import { Empty, PageHeader } from "@/pages/Vitals";

type Activity = Database["public"]["Tables"]["activities"]["Row"];

const STRENGTH_TYPES = new Set([
  "hyrox", "weighttraining", "weight_training", "workout", "crossfit", "hiit", "crosstraining",
]);

export function Training() {
  const [acts, setActs] = useState<Activity[]>([]);
  const [vo2max, setVo2max] = useState<number | null>(null);
  const status = raceStatus();

  useEffect(() => {
    void supabase
      .from("activities")
      .select("id,date,type,name,distance_km,duration_s,avg_pace_s_per_km,avg_hr,max_hr,elevation_m")
      .order("date", { ascending: false })
      .limit(300)
      .then(({ data }) => setActs((data as Activity[]) ?? []));
    // Latest VO₂max anchors the race-pace prediction alongside best-effort Riegel.
    void supabase
      .from("scores")
      .select("vo2max")
      .not("vo2max", "is", null)
      .order("date", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const row = (data as Array<{ vo2max: number | null }> | null)?.[0];
        setVo2max(row?.vo2max ?? null);
      });
  }, []);

  const racePace = useMemo(
    () => predictRacePace(acts, status.daysToRace, vo2max),
    [acts, status.daysToRace, vo2max],
  );
  const maxHr = useMemo(() => estimateMaxHr(acts), [acts]);
  // Pace bands are anchored to the GOAL we're training toward (realistic
  // target), not the raw prediction — so every easy/MP/threshold cue reflects
  // the 3:25 plan. The prediction tile below stays as the data-driven reality
  // check. delta = goal MP minus current prediction (negative = ahead of goal).
  const zones = useMemo(
    () => racePaceZones(GOAL_TARGET.mpSecPerKm, maxHr ?? undefined),
    [maxHr],
  );
  const goalDelta = useMemo(
    () => (racePace.pacePerKm ? racePace.pacePerKm - GOAL_TARGET.mpSecPerKm : null),
    [racePace.pacePerKm],
  );
  const acwrStat = useMemo(() => acwr(acts), [acts]);
  const consistency = useMemo(() => consistencyPct(acts), [acts]);

  const actuals = useMemo(() => aggregateActuals(acts), [acts]);

  // Stacked weekly bars: plan + actual, each broken into easy/tempo/interval/long/mp/strides.
  const weeklyData = useMemo(
    () =>
      COACH_PLAN.map((w) => {
        const plannedSessions = expandSessions(w);
        const planByKind = aggregateByKind(plannedSessions);
        const a = actuals.get(w.weekStart);
        const actualTotal = a?.weeklyKm ?? 0;
        return {
          weekIdx: w.weekIdx,
          week: w.weekStart,
          phase: w.phase,
          // plan stack
          plan_easy: planByKind.easy + planByKind.shakeout,
          plan_tempo: planByKind.tempo,
          plan_interval: planByKind.interval,
          plan_long: planByKind.long + planByKind.mp,
          plan_strides: planByKind.strides,
          plan_total: w.weeklyKm,
          // actual stack
          actual_easy: (a?.byKind.easy ?? 0) + (a?.byKind.shakeout ?? 0),
          actual_tempo: a?.byKind.tempo ?? 0,
          actual_interval: a?.byKind.interval ?? 0,
          actual_long: (a?.byKind.long ?? 0) + (a?.byKind.mp ?? 0),
          actual_strides: a?.byKind.strides ?? 0,
          actual_total: actualTotal,
          cutback: w.cutback,
          // Target met = actual within 5% of plan (or better)
          targetMet: actualTotal > 0 && actualTotal >= w.weeklyKm * 0.95,
        };
      }),
    [actuals],
  );

  const longRunData = useMemo(
    () =>
      COACH_PLAN.map((w) => ({
        weekIdx: w.weekIdx,
        week: w.weekStart,
        phase: w.phase,
        plan: w.longRunKm,
        actual: actuals.get(w.weekStart)?.longRunKm ?? null,
        mp: w.mpSegment,
      })),
    [actuals],
  );

  const lastLong = [...acts]
    .filter((a) => (a.distance_km ?? 0) >= 14)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  // Strength/Hyrox/HIIT sessions grouped by build week
  const strengthByBuildWeek = useMemo(() => {
    const out = new Map<number, { sessions: number; typeLabel: "hyrox" | "hiit" | "strength" }>();
    for (const a of acts) {
      if (!a.type || !STRENGTH_TYPES.has(a.type.toLowerCase())) continue;
      const pw = planWeekFor(a.date);
      if (!pw) continue;
      const existing = out.get(pw.weekIdx) ?? { sessions: 0, typeLabel: "strength" as const };
      const tl = a.type.toLowerCase();
      const label: "hyrox" | "hiit" | "strength" =
        tl === "hyrox" ? "hyrox"
        : ["hiit", "crossfit", "crosstraining"].includes(tl) ? "hiit"
        : existing.typeLabel === "hyrox" ? "hyrox"
        : existing.typeLabel === "hiit" ? "hiit"
        : "strength";
      out.set(pw.weekIdx, { sessions: existing.sessions + 1, typeLabel: label });
    }
    return out;
  }, [acts]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const currentWeek = planWeekFor(todayIso);

  // Mobile weekly-volume window: last week + this week + the coming 4 —
  // desktop shows all 20 bars, but that's unreadable on a phone.
  const mobileWeeklyData = useMemo(() => {
    if (!currentWeek) return weeklyData.slice(-6);
    const lo = currentWeek.weekIdx - 1;
    const hi = currentWeek.weekIdx + 4;
    return weeklyData.filter((w) => w.weekIdx >= lo && w.weekIdx <= hi);
  }, [weeklyData, currentWeek]);

  // "Show next week" toggle — Sunday agenda planning. Defaults to current; flips
  // to next when you tap the toggle so you can lay out the workouts in your
  // calendar before Monday rolls around.
  const [showNext, setShowNext] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const nextWeek = currentWeek
    ? COACH_PLAN.find((w) => w.weekIdx === currentWeek.weekIdx + 1) ?? null
    : null;
  const displayedWeek = showNext && nextWeek ? nextWeek : currentWeek;
  const displayedActual = displayedWeek ? actuals.get(displayedWeek.weekStart) : undefined;

  // Which days-of-week (0=Mon…6=Sun) in the displayed week fall inside a travel block.
  const travelDays = useMemo<Set<number>>(() => {
    if (!displayedWeek) return new Set();
    const start = new Date(displayedWeek.weekStart + "T00:00:00Z");
    const days = new Set<number>();
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + d);
      if (travelBlockFor(day.toISOString().slice(0, 10))) days.add(d);
    }
    return days;
  }, [displayedWeek]);
  const weekTravels = displayedWeek ? weekHasTravel(displayedWeek) : [];

  // "Done this week" = real Strava runs, rolled up per day. Split-recorded
  // activities on the same date collapse into one day's total km.
  const doneSessions = useMemo<Session[]>(() => {
    if (!displayedWeek || !displayedActual) return [];
    const weekStart = new Date(displayedWeek.weekStart + "T00:00:00Z");
    const byDate = new Map<string, { km: number; kinds: Set<SessionKind> }>();
    for (const a of displayedActual.activities) {
      const e = byDate.get(a.date) ?? { km: 0, kinds: new Set<SessionKind>() };
      e.km += a.distance_km;
      e.kinds.add(a.kind);
      byDate.set(a.date, e);
    }
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, e]) => {
        const dow = Math.floor(
          (new Date(date + "T00:00:00Z").getTime() - weekStart.getTime()) / 86_400_000,
        );
        const kinds = [...e.kinds];
        const kind: SessionKind =
          kinds.find((k) => k === "long" || k === "mp" || k === "tempo" || k === "interval") ??
          kinds[0] ??
          "easy";
        const km = Math.round(e.km * 10) / 10;
        return { kind, km, dayOfWeek: dow, label: `${km.toFixed(1)} km logged` };
      });
  }, [displayedWeek, displayedActual]);

  // Bryan Johnson Blueprint-style weekly cardio split: 150 min Zone 2 +
  // 75 min vigorous (WHO physical-activity guidelines, lifted from his
  // protocol). Classified from avg_hr per activity against estimated HRmax.
  //   Z2:       60–77% HRmax  → easy aerobic, fat-ox, recovery-friendly
  //   Tempo:    77–87% HRmax  → in between; not counted in either bucket
  //   Vigorous: ≥ 87% HRmax   → threshold + VO2 work
  // Without per-second HR streams we use avg_hr as a coarse classifier —
  // good enough to flag "you ran zero vigorous all week".
  const weekSplit = useMemo(() => {
    const mhr = maxHr ?? 189; // fallback estimate
    const z2Lo = mhr * 0.60, z2Hi = mhr * 0.77, vigLo = mhr * 0.87;
    const monday = (() => {
      const d = new Date(todayIso + "T00:00:00");
      const dow = (d.getDay() + 6) % 7; // 0=Mon
      d.setDate(d.getDate() - dow);
      return d.toISOString().slice(0, 10);
    })();
    let z2 = 0, vig = 0, tempo = 0;
    for (const a of acts) {
      if (!a.date || a.date < monday) continue;
      const hr = a.avg_hr ?? null;
      const dur = (a.duration_s ?? 0) / 60;
      if (!hr || !dur) continue;
      if (hr >= z2Lo && hr <= z2Hi) z2 += dur;
      else if (hr >= vigLo) vig += dur;
      else if (hr > z2Hi && hr < vigLo) tempo += dur;
    }
    return { z2: Math.round(z2), vig: Math.round(vig), tempo: Math.round(tempo) };
  }, [acts, maxHr, todayIso]);
  const displayedWhatsLeft = displayedWeek
    ? showNext && nextWeek
      // Next week: show all planned sessions as "to do" (none done yet, full 7 days).
      ? {
          done: [] as Session[],
          left: expandSessionsWithOverrides(displayedWeek),
          dropped: [] as Session[],
          daysLeft: 7,
        }
      : whatsLeftThisWeek(displayedWeek, displayedActual)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <PageHeader voice="coach" Icon={ActivityIcon}>
          Training
        </PageHeader>
        <StravaSync />
      </div>

      {/*
        PLAN REVISION BANNER — from config/race.json, hidden when planRevision
        is null. Do not hardcode a revision note here: this component renders
        in every fork, and the previous hardcoded version shipped one athlete's
        HRV, resting HR and VO2max readings to all of them.
      */}
      {PLAN_REVISION && (
        <div
          className="holy-card p-4 sm:p-5"
          style={{ borderColor: AGENTS.coach.hueSoft, background: AGENTS.coach.hueTint }}
        >
          <div className="flex items-start gap-3">
            <span aria-hidden className="text-lg leading-none mt-0.5">🔄</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span
                  className="text-[11px] uppercase tracking-[0.16em] font-bold"
                  style={{ color: AGENTS.coach.hue }}
                >
                  Plan revised · {PLAN_REVISION.date}
                </span>
                {PLAN_REVISION.tag && (
                  <span className="text-[10px] uppercase tracking-[0.14em] text-[--color-ink-dim]">
                    · {PLAN_REVISION.tag}
                  </span>
                )}
              </div>
              <div className="text-[13px] text-[--color-ink-mid] mt-1.5 leading-snug">
                {PLAN_REVISION.body}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COACH'S READ — note + still-to-go (current or next week) */}
      {displayedWeek && displayedWhatsLeft && (
        <div
          className="holy-card p-5 sm:p-6"
          style={{ borderColor: AGENTS.coach.hueSoft, background: AGENTS.coach.hueTint }}
        >
          <div className="flex items-start gap-4">
            <AgentAvatar agent="coach" size={44} ring />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span
                  className="text-[11px] uppercase tracking-[0.16em] font-bold"
                  style={{ color: AGENTS.coach.hue }}
                >
                  Coach's read · Week {displayedWeek.weekIdx}/20
                </span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-[--color-ink-dim]">
                  · {weekRangeLabel(displayedWeek.weekStart)}
                </span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-[--color-ink-dim]">
                  · {displayedWeek.phase}
                </span>
                {displayedWeek.cutback && (
                  <span
                    className="text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: AGENTS.mind.hueSoft, color: AGENTS.mind.hue }}
                  >
                    recovery week
                  </span>
                )}
                {showNext && (
                  <span
                    className="text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: AGENTS.coach.hueSoft, color: AGENTS.coach.hue }}
                  >
                    next week
                  </span>
                )}
                {weekTravels.map((t) => (
                  <span
                    key={t.label}
                    className="text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: "#e0f2fe", color: "#0369a1" }}
                    title={t.note}
                  >
                    {t.label}
                  </span>
                ))}
              </div>
              <div className="font-display text-[--color-ink] mt-1.5 font-semibold">
                {displayedWeek.note}
              </div>
              <div className="flex flex-wrap gap-3 mt-3 text-xs text-[--color-ink-mid]">
                <span>
                  <strong className="text-[--color-ink]">
                    {showNext
                      ? `0/${displayedWeek.weeklyKm}`
                      : `${(displayedActual?.weeklyKm ?? 0).toFixed(1)}/${displayedWeek.weeklyKm}`}{" "}
                    km
                  </strong>{" "}
                  {showNext ? "planned" : "this week"}
                </span>
                <span>·</span>
                <span>
                  Long run target{" "}
                  <strong className="text-[--color-ink]">{displayedWeek.longRunKm} km</strong>
                </span>
                {displayedWeek.mpSegment && <span>· marathon-pace work scheduled</span>}
              </div>
            </div>
            {/* Toggle: this week ↔ next week */}
            {nextWeek && (
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowNext(false)}
                  className={`px-3 py-1 rounded-md text-[10px] uppercase tracking-[0.14em] font-semibold border transition ${
                    showNext
                      ? "bg-transparent border-[--color-border] text-[--color-ink-mid] hover:text-[--color-ink]"
                      : "bg-[--color-coach] border-[--color-coach] text-white"
                  }`}
                  aria-pressed={!showNext}
                >
                  This week
                </button>
                <button
                  type="button"
                  onClick={() => setShowNext(true)}
                  className={`px-3 py-1 rounded-md text-[10px] uppercase tracking-[0.14em] font-semibold border transition ${
                    showNext
                      ? "bg-[--color-coach] border-[--color-coach] text-white"
                      : "bg-transparent border-[--color-border] text-[--color-ink-mid] hover:text-[--color-ink]"
                  }`}
                  aria-pressed={showNext}
                  title="Plan Sunday: see next week's sessions"
                >
                  Next week →
                </button>
              </div>
            )}
          </div>

          {/* WEEKLY Z2 / VIGOROUS — Bryan Johnson Blueprint targets (150 / 75 min). */}
          {!showNext && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <ZoneTile
                label="Zone 2 cardio"
                value={weekSplit.z2}
                target={150}
                unit="min"
                description="60–77% HRmax · easy aerobic, fat-ox, recovery-friendly. The base of marathon training."
                colour={AGENTS.doc.hue}
                tint={AGENTS.doc.hueTint}
              />
              <ZoneTile
                label="Vigorous"
                value={weekSplit.vig}
                target={75}
                unit="min"
                description="≥ 87% HRmax · threshold + VO₂ work. Hard, short, race-shaping."
                colour={AGENTS.coach.hue}
                tint={AGENTS.coach.hueTint}
              />
            </div>
          )}

          {/* Sessions list — done + still to go (ranked, capped) */}
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SessionsList
              title={
                showNext
                  ? "Must-do sessions"
                  : displayedActual?.weeklyKm
                  ? `Done this week · ${displayedActual.weeklyKm.toFixed(1)} km`
                  : "Done this week"
              }
              sessions={
                showNext
                  ? displayedWhatsLeft.left.slice(0, 3)
                  : doneSessions
              }
              done={!showNext}
              emptyMsg={showNext ? "" : "Nothing logged yet."}
              ranked={showNext}
              travelDays={travelDays}
            />
            <SessionsList
              title={
                showNext
                  ? `Full week · ${displayedWhatsLeft.left.length} sessions`
                  : displayedWhatsLeft.left.length === 0
                    ? "All done — nice work"
                    : `Still to go · ${displayedWhatsLeft.daysLeft} day${
                        displayedWhatsLeft.daysLeft === 1 ? "" : "s"
                      } left`
              }
              sessions={displayedWhatsLeft.left}
              done={false}
              emptyMsg="🏁 You hit every planned session this week."
              ranked
              travelDays={travelDays}
            />
          </div>

          {/* Sessions that won't fit — Coach's "carry / cut" call-out */}
          {!showNext && displayedWhatsLeft.dropped.length > 0 && (
            <div
              className="mt-3 px-4 py-2.5 rounded-lg border text-xs"
              style={{
                background: "var(--color-warn-soft)",
                borderColor: "var(--color-warn-soft)",
                color: "var(--color-ink-mid)",
              }}
            >
              <span className="font-semibold uppercase tracking-[0.14em] text-[10px]" style={{ color: "var(--color-warn)" }}>
                Missed this week
              </span>
              <span className="ml-2">
                {displayedWhatsLeft.dropped
                  .map((s) => s.label.split(" (")[0])
                  .join(" · ")}
                {" "}— those days have passed. Coach carries the load forward; no make-up cramming.
              </span>
            </div>
          )}
        </div>
      )}

      {/* GOAL TIERS — A / realistic / floor. Coach trains to the realistic one. */}
      <section>
        <SectionTitle>Race goal — A · realistic · floor</SectionTitle>
        <div className="holy-card p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-3">
            {RACE_GOALS.map((g) => {
              const isTarget = g.tier === GOAL_TARGET.tier;
              return (
                <div
                  key={g.tier}
                  className="rounded-xl p-3 sm:p-4 border text-center"
                  style={{
                    borderColor: isTarget ? AGENTS.coach.hue : "var(--color-line)",
                    background: isTarget ? AGENTS.coach.hueTint : "transparent",
                  }}
                >
                  <div
                    className="text-[10px] uppercase tracking-wide font-medium mb-0.5"
                    style={{ color: isTarget ? AGENTS.coach.hue : "var(--color-ink-dim)" }}
                  >
                    {g.label}
                    {isTarget && " ◀"}
                  </div>
                  <div className="font-display text-xl sm:text-2xl font-semibold text-[--color-ink]">
                    {g.timeLabel}
                  </div>
                  <div className="text-[11px] text-[--color-ink-dim] mt-0.5">
                    {formatPace(g.mpSecPerKm)} /km
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-[--color-ink-dim] mt-3 italic leading-snug">
            Coach trains toward the <strong>{GOAL_TARGET.timeLabel}</strong> target — every pace
            band below anchors here. {GOAL_TARGET.note} The A-goal gets auditioned at the August
            10K + half tune-ups; the data-driven prediction is the reality check in the tiles below.
          </p>
        </div>
      </section>

      {/* 4-TILE TRAINING DASHBOARD */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Tile
          icon={<Target className="w-4 h-4" />}
          label="Race pace — predicted"
          value={formatPace(racePace.pacePerKm)}
          sub={
            racePace.pacePerKm
              ? goalDelta !== null && goalDelta <= 0
                ? `${formatTime(racePace.pacePerKm * 42.195)} — at/ahead of ${GOAL_TARGET.timeLabel} 🎯`
                : `${formatTime(racePace.pacePerKm * 42.195)} · ${formatPace(goalDelta)} off ${GOAL_TARGET.timeLabel}`
              : racePace.note
          }
          tint={goalDelta !== null && goalDelta <= 0 ? "coach" : "amber"}
        />
        <Tile
          icon={<TrendingUp className="w-4 h-4" />}
          label="Consistency"
          value={`${consistency.pct}%`}
          sub={`${consistency.completed} of ${consistency.planned} sessions`}
          tint={consistency.pct >= 80 ? "coach" : consistency.pct >= 60 ? "amber" : "bad"}
        />
        <Tile
          icon={<AlertCircle className="w-4 h-4" />}
          label="Load ratio (ACWR)"
          value={acwrStat.flag === "n/a" ? "—" : acwrStat.ratio.toFixed(2)}
          sub={
            acwrStat.flag === "high"
              ? "↑ injury risk"
              : acwrStat.flag === "low"
              ? "↓ losing fitness"
              : acwrStat.flag === "ok"
              ? "in sweet spot"
              : "build more data"
          }
          tint={acwrStat.flag === "high" || acwrStat.flag === "low" ? "amber" : "coach"}
        />
        <Tile
          icon={<Footprints className="w-4 h-4" />}
          label="Last long run"
          value={lastLong ? `${lastLong.distance_km?.toFixed(1)} km` : "—"}
          sub={lastLong ? format(new Date(lastLong.date), "EEE d MMM") : "log a run to start"}
          tint="coach"
        />
      </section>

      <FormulaExplainer />

      {/* RACE-PACE ZONES */}
      {zones && (
        <section>
          <SectionTitle>Today's pace + HR bands</SectionTitle>
          <div className="holy-card p-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Zone
              label="Easy"
              paceLow={zones.easy.paceHigh}
              paceHigh={zones.easy.paceLow}
              hrLow={zones.easy.hrLow}
              hrHigh={zones.easy.hrHigh}
              colour="var(--color-coach-soft)"
              textColour="var(--color-coach)"
            />
            <Zone
              label="Marathon"
              paceLow={zones.marathon.paceHigh}
              paceHigh={zones.marathon.paceLow}
              hrLow={zones.marathon.hrLow}
              hrHigh={zones.marathon.hrHigh}
              colour="var(--color-doc-soft)"
              textColour="var(--color-doc)"
            />
            <Zone
              label="Threshold"
              paceLow={zones.threshold.paceHigh}
              paceHigh={zones.threshold.paceLow}
              hrLow={zones.threshold.hrLow}
              hrHigh={zones.threshold.hrHigh}
              colour="var(--color-warn-soft)"
              textColour="var(--color-warn)"
            />
            <Zone
              label="VO₂"
              paceLow={zones.vo2.paceHigh}
              paceHigh={zones.vo2.paceLow}
              hrLow={zones.vo2.hrLow}
              hrHigh={zones.vo2.hrHigh}
              colour="var(--color-race-soft)"
              textColour="var(--color-race)"
            />
          </div>
          <div className="text-[11px] text-[--color-ink-dim] mt-2 italic">
            Anchored to the {GOAL_TARGET.timeLabel} goal pace ({formatPace(GOAL_TARGET.mpSecPerKm)}/km){maxHr ? `, with est. max HR ${maxHr} bpm (95th percentile of your Strava max HRs)` : " (HR bands appear once 5+ activities are logged)"}.
            Marathon band = goal MP. Re-tune if the goal changes.
          </div>
        </section>
      )}

      {/* WEEKLY VOLUME — stacked by kind, plan and actual side by side */}
      <section>
        <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
          <h3 className="font-display text-base font-medium text-[--color-ink]">
            Weekly volume — plan (left) vs actual (right)
          </h3>
          <KindLegend />
        </div>
        <div className="holy-card p-3 sm:p-5">
          {weeklyData.length === 0 ? (
            <Empty message="No data yet." />
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={isMobile ? mobileWeeklyData : weeklyData}
                  margin={{ left: -10, right: 8, top: 24, bottom: 0 }}
                  barCategoryGap={6}
                  barGap={1}
                >
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="weekIdx"
                    tick={{ fontSize: 10, fill: "var(--color-ink-dim)" }}
                    tickFormatter={(v) => {
                      const w = weeklyData.find((x) => x.weekIdx === v);
                      if (!w) return `W${v}`;
                      const d = new Date(w.week);
                      // Show month name on Wk 1 + every week where the month changes
                      const prev = weeklyData.find((x) => x.weekIdx === v - 1);
                      const monthChanged =
                        !prev || new Date(prev.week).getUTCMonth() !== d.getUTCMonth();
                      return monthChanged
                        ? `W${v} · ${format(d, "MMM")}`
                        : `W${v}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "var(--color-ink-dim)" }} width={32} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                      boxShadow: "var(--shadow-2)",
                    }}
                    labelFormatter={(v: number) => {
                      const w = weeklyData.find((x) => x.weekIdx === v);
                      return w ? `W${v} · ${w.phase} · ${format(new Date(w.week), "d MMM")}` : `W${v}`;
                    }}
                    formatter={(value: number, name: string) => {
                      if (!value) return ["—", name];
                      return [`${value.toFixed(1)} km`, name];
                    }}
                  />
                  {/* PLAN (grey-tinted hues) */}
                  <Bar dataKey="plan_easy" stackId="plan" fill={KIND_COLOURS.easy.plan} name="Plan · Easy" />
                  <Bar dataKey="plan_strides" stackId="plan" fill={KIND_COLOURS.strides.plan} name="Plan · Strides" />
                  <Bar dataKey="plan_tempo" stackId="plan" fill={KIND_COLOURS.tempo.plan} name="Plan · Tempo" />
                  <Bar dataKey="plan_interval" stackId="plan" fill={KIND_COLOURS.interval.plan} name="Plan · Interval" />
                  <Bar
                    dataKey="plan_long"
                    stackId="plan"
                    fill={KIND_COLOURS.long.plan}
                    name="Plan · Long"
                    radius={[3, 3, 0, 0]}
                  >
                    <LabelList
                      dataKey="plan_total"
                      position="top"
                      style={{ fontSize: 9, fill: "var(--color-ink-dim)" }}
                      formatter={(v: unknown) => (v && Number(v) > 0 ? `${Math.round(Number(v))}` : "")}
                    />
                  </Bar>

                  {/* ACTUAL (coach colours) */}
                  <Bar dataKey="actual_easy" stackId="actual" fill={KIND_COLOURS.easy.actual} name="Actual · Easy" />
                  <Bar dataKey="actual_strides" stackId="actual" fill={KIND_COLOURS.strides.actual} name="Actual · Strides" />
                  <Bar dataKey="actual_tempo" stackId="actual" fill={KIND_COLOURS.tempo.actual} name="Actual · Tempo" />
                  <Bar dataKey="actual_interval" stackId="actual" fill={KIND_COLOURS.interval.actual} name="Actual · Interval" />
                  <Bar
                    dataKey="actual_long"
                    stackId="actual"
                    fill={KIND_COLOURS.long.actual}
                    name="Actual · Long"
                    radius={[3, 3, 0, 0]}
                  >
                    <LabelList
                      dataKey="actual_total"
                      position="top"
                      style={{ fontSize: 9, fill: "var(--color-coach)" }}
                      formatter={(v: unknown) => (v && Number(v) > 0 ? `${Math.round(Number(v))}` : "")}
                    />
                    <LabelList
                      dataKey="targetMet"
                      position="insideTop"
                      style={{ fontSize: 10, fill: "var(--color-good)", fontWeight: 700 }}
                      formatter={(v: unknown) => (v ? "✓" : "")}
                    />
                  </Bar>

                  {(isMobile ? mobileWeeklyData : weeklyData)
                    .filter((w) => w.cutback)
                    .map((w) => (
                      <ReferenceLine
                        key={w.weekIdx}
                        x={w.weekIdx}
                        stroke={AGENTS.mind.hue}
                        strokeDasharray="2 3"
                        strokeWidth={1}
                        strokeOpacity={0.5}
                        label={{
                          value: "reset ↺",
                          position: "insideTopLeft",
                          fontSize: 9,
                          fill: AGENTS.mind.hue,
                        }}
                      />
                    ))}

                  {currentWeek && (
                    <ReferenceLine
                      x={currentWeek.weekIdx}
                      stroke="var(--color-race)"
                      strokeDasharray="3 3"
                      strokeWidth={1.5}
                      label={{ value: "today", position: "top", fontSize: 9, fill: "var(--color-race)" }}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* STRENGTH / HYROX / HIIT session counts per build week */}
      {strengthByBuildWeek.size > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-2 gap-3">
            <h3 className="font-display text-base font-medium text-[--color-ink]">
              Strength &amp; cross-training
            </h3>
            <span className="text-xs text-[--color-ink-dim]">sessions per build week</span>
          </div>
          <div className="holy-card p-3 sm:p-4">
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {COACH_PLAN.filter((w) => strengthByBuildWeek.has(w.weekIdx)).map((w) => {
                const s = strengthByBuildWeek.get(w.weekIdx)!;
                const typeLabel =
                  s.typeLabel === "hyrox" ? "Hyrox"
                  : s.typeLabel === "hiit" ? "HIIT"
                  : "strength";
                const isCurrentWk = currentWeek?.weekIdx === w.weekIdx;
                return (
                  <div key={w.weekIdx} className="flex items-baseline gap-1.5">
                    <span
                      className="text-xs font-mono"
                      style={{ color: isCurrentWk ? "var(--color-coach)" : "var(--color-ink-dim)" }}
                    >
                      W{w.weekIdx}
                    </span>
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: isCurrentWk ? "var(--color-coach)" : "var(--color-ink)" }}
                    >
                      {s.sessions} × {typeLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* LONG-RUN PROGRESSION */}
      <section>
        <div className="flex items-baseline justify-between mb-3 gap-3">
          <h3 className="font-display text-base font-medium text-[--color-ink]">
            Long-run progression
          </h3>
          <span className="text-xs text-[--color-ink-dim]">
            grey = Coach's plan · green = your longest each week
          </span>
        </div>
        <div className="holy-card p-3 sm:p-5 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={longRunData} margin={{ left: -10, right: 8, top: 6, bottom: 6 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="weekIdx"
                tick={{ fontSize: 10, fill: "var(--color-ink-dim)" }}
                tickFormatter={(v) => `W${v}`}
              />
              <YAxis tick={{ fontSize: 10, fill: "var(--color-ink-dim)" }} width={32} />
              <Tooltip
                labelFormatter={(v: number) => {
                  const w = longRunData.find((x) => x.weekIdx === v);
                  return w ? `W${v} · ${w.phase}${w.mp ? " · MP segment" : ""}` : `W${v}`;
                }}
              />
              <Line
                type="monotone"
                dataKey="plan"
                stroke="var(--color-border-strong)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                name="Plan"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#1a6b3c"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#1a6b3c" }}
                name="Actual"
                connectNulls
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="actual"
                  position="top"
                  offset={10}
                  style={{ fontSize: 9, fontWeight: 600, fill: "#1a6b3c" }}
                  formatter={(v: unknown) => (v && Number(v) > 0 ? `${Math.round(Number(v))}` : "")}
                />
              </Line>
              {currentWeek && (
                <ReferenceLine
                  x={currentWeek.weekIdx}
                  stroke="var(--color-race)"
                  strokeDasharray="3 3"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* RECENT ACTIVITIES */}
      <section>
        <SectionTitle>Recent activities</SectionTitle>
        <div className="holy-card divide-y divide-[--color-border]">
          {acts.slice(0, 10).map((a) => (
            <div key={a.id} className="px-5 py-3 flex items-center justify-between text-sm">
              <div>
                <div className="text-[--color-ink] font-medium">{a.name ?? a.type}</div>
                <div className="text-xs text-[--color-ink-mid] mt-0.5">
                  {format(new Date(a.date), "EEE d MMM")} · {a.type}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[--color-ink] tabular">
                  {a.distance_km?.toFixed(1) ?? "—"} km
                </div>
                <div className="text-xs text-[--color-ink-dim] tabular">
                  {a.avg_pace_s_per_km ? formatPace(a.avg_pace_s_per_km) : "—"}
                </div>
              </div>
            </div>
          ))}
          {acts.length === 0 && (
            <div className="px-5 py-8 text-center text-[--color-ink-dim] text-sm">Empty</div>
          )}
        </div>
      </section>
    </div>
  );
}

// -------------------------- subcomponents --------------------------------

type TileTint = "coach" | "amber" | "bad";
const TILE_COLORS: Record<TileTint, { bg: string; fg: string }> = {
  coach: { bg: "var(--color-coach-soft)", fg: "var(--color-coach)" },
  amber: { bg: "var(--color-warn-soft)", fg: "var(--color-warn)" },
  bad: { bg: "var(--color-bad-soft)", fg: "var(--color-bad)" },
};

/**
 * One-line formula reminders for each tile, shown as a hover/tap tooltip.
 * Same content as the FormulaExplainer panel below — surfaced inline so
 * you don't have to scroll and expand to remember what each number means.
 * Keyed by tile label (matches the strings used in Training()).
 */
const TILE_TOOLTIPS: Record<string, string> = {
  "Race pace":
    "Blend of best-effort Riegel (T₂ = T₁ × (42.195 / D₁)^1.06 — fastest projection from your race-equivalent efforts ≥10 km, so easy long runs don't drag it) and a VO₂max estimate (marathon at ~80% of velocity at VO₂max). Averaged when both exist.",
  "Consistency":
    "Completed runs ÷ (weeks since 4 May × 5). Assumes 5 quality sessions per week. 80%+ green · 60–79% amber · <60% needs a Coach chat.",
  "Load ratio (ACWR)":
    "Acute:Chronic Workload Ratio = (last 7d avg km) ÷ (last 28d avg km). Sweet spot 0.8–1.3. >1.5 = injury-risk spike. Hidden until 28 days of data.",
  "Last long run":
    "Most recent activity ≥ 14 km. Anchors the Race pace projection — Coach keeps the threshold at 14 km so a Wednesday tempo doesn't dilute the read.",
};

function Tile({
  icon,
  label,
  value,
  sub,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tint: TileTint;
}) {
  const t = TILE_COLORS[tint];
  const tip = TILE_TOOLTIPS[label];
  return (
    <div
      className="holy-card p-4 relative group cursor-help"
      title={tip}
      tabIndex={tip ? 0 : -1}
      role={tip ? "button" : undefined}
      aria-label={tip ? `${label}: ${value}. ${tip}` : undefined}
    >
      <div
        className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] font-semibold"
        style={{ color: t.fg }}
      >
        {icon}
        <span>{label}</span>
        {tip && (
          <span
            className="ml-auto inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold opacity-60 group-hover:opacity-100 transition"
            style={{ background: t.fg, color: "white" }}
            aria-hidden
          >
            ?
          </span>
        )}
      </div>
      <div className="font-display text-2xl font-bold tabular text-[--color-ink] mt-2">{value}</div>
      <div className="text-xs text-[--color-ink-mid] mt-1">{sub}</div>

      {tip && (
        <div
          className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition absolute left-0 right-0 top-full mt-1 z-20 holy-card p-3 text-[11px] leading-snug text-[--color-ink-mid] shadow-[var(--shadow-2)]"
          role="tooltip"
        >
          <div
            className="text-[9px] uppercase tracking-[0.18em] font-bold mb-1"
            style={{ color: t.fg }}
          >
            How it's computed
          </div>
          {tip}
        </div>
      )}
    </div>
  );
}

function Zone({
  label,
  paceLow,
  paceHigh,
  hrLow,
  hrHigh,
  colour,
  textColour,
}: {
  label: string;
  paceLow: number;
  paceHigh: number;
  hrLow?: number;
  hrHigh?: number;
  colour: string;
  textColour: string;
}) {
  return (
    <div className="rounded-lg p-3" style={{ background: colour }}>
      <div
        className="text-[10px] uppercase tracking-[0.16em] font-semibold"
        style={{ color: textColour }}
      >
        {label}
      </div>
      <div className="font-display text-sm font-semibold tabular text-[--color-ink] mt-1">
        {formatPace(Math.round(paceLow))} – {formatPace(Math.round(paceHigh))}
      </div>
      {hrLow !== undefined && hrHigh !== undefined && (
        <div className="text-[11px] tabular text-[--color-ink-mid] mt-0.5">
          HR {hrLow}–{hrHigh} bpm
        </div>
      )}
    </div>
  );
}

/**
 * "How these are calculated" panel — surfaces the formulas behind the four
 * tiles plus a note on what we *could* swap in (Strava's ML predictor) but
 * haven't, and why. Collapsed by default to keep the page tight.
 */
function FormulaExplainer() {
  const [open, setOpen] = useState(false);
  return (
    <section
      className="holy-card p-5"
      style={{ borderColor: AGENTS.coach.hueSoft }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] uppercase tracking-[0.18em] font-bold"
            style={{ color: AGENTS.coach.hue }}
          >
            How these are calculated
          </span>
          <span className="text-xs text-[--color-ink-dim]">
            Coach's read on the four tiles above
          </span>
        </div>
        <span
          className="text-[10px] uppercase tracking-[0.14em] font-semibold"
          style={{ color: AGENTS.coach.hue }}
        >
          {open ? "▴ hide" : "▾ show"}
        </span>
      </button>

      {open && (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs leading-relaxed">
          <FormulaRow
            label="Race pace"
            formula="best-effort Riegel × VO₂max, averaged"
            detail={
              <>
                Two estimates, blended. <strong>Best-effort Riegel:</strong>{" "}
                <code>T₂ = T₁ × (42.195 / D₁)^1.06</code> (Pete Riegel's
                endurance-decay exponent) applied to your race-equivalent
                efforts ≥ 10 km — we take the <em>fastest</em> projection, not
                the median, because Riegel assumes a hard effort and your easy
                Z2 long runs would otherwise drag the number slow (a 1:37 half
                projects to roughly 3:21, for instance). <strong>VO₂max:</strong> velocity
                at VO₂max from the ACSM equation, held at ~80% over the
                marathon. Averaging the two keeps best-effort Riegel honest
                (it ignores marathon fade) and lets the estimate track your
                Garmin VO₂max as it climbs. <strong>Strava's app-only ML
                predictor</strong> isn't on the public API.
              </>
            }
          />
          <FormulaRow
            label="Consistency"
            formula="completed runs / (weeks since 4 May × 5)"
            detail={
              <>
                Treats the build as 5 quality sessions per week — easy +
                strides + tempo + interval + long. Counts every Strava run
                since <code>BUILD_START</code> (Mon 4 May 2026). 80%+ is the
                green zone; below 60% means recovery, life or motivation
                needs a Coach conversation.
              </>
            }
          />
          <FormulaRow
            label="Load ratio (ACWR)"
            formula="(7-day avg km) ÷ (28-day avg km)"
            detail={
              <>
                The Acute:Chronic Workload Ratio — Tim Gabbett's injury-risk
                indicator. <strong>0.8–1.3 is the sweet spot</strong>; under
                0.8 you're losing fitness, over 1.5 you're spiking and the
                injury curve climbs. Hidden until 28 days of data exist
                (otherwise it's noise). Pure km — we'll fold in HR + pace
                weighting once we have a clean training-load metric.
              </>
            }
          />
          <FormulaRow
            label="Last long run"
            formula="most recent activity ≥ 14 km"
            detail={
              <>
                Anchor for race-pace projection (Riegel needs the long run's
                duration). Anything shorter doesn't move the prediction
                meaningfully — Coach keeps the threshold at 14 km so a
                Wednesday tempo doesn't dilute the signal.
              </>
            }
          />
        </div>
      )}
    </section>
  );
}

function FormulaRow({
  label,
  formula,
  detail,
}: {
  label: string;
  formula: string;
  detail: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-display font-semibold text-[--color-ink]">{label}</div>
      <div className="text-[11px] mt-1 mb-2">
        <code className="px-2 py-0.5 rounded bg-[--color-surface-2] text-[--color-ink-mid]">
          {formula}
        </code>
      </div>
      <div className="text-[--color-ink-mid]">{detail}</div>
    </div>
  );
}

/**
 * the race marathon-pace predictor — blends two independent estimates:
 *
 *  1. **Best-effort Riegel.** Riegel (T₂ = T₁·(42.195/D₁)^1.06) assumes the
 *     input run was a near-maximal effort for its distance. the athlete's long runs
 *     are mostly easy Z2, so the *median* of all long runs over-predicts the
 *     finish time badly (it was reading ~4:18 off easy 6:00+/km mileage). We
 *     instead take the **fastest** projection across her race-equivalent
 *     efforts (runs ≥ 10 km) — i.e. what she's actually demonstrated she can
 *     run, e.g. a 1:37 half projects to a ~3:21 marathon equivalent.
 *
 *  2. **VO₂max physiology.** ACSM running economy gives velocity at VO₂max
 *     (v = (VO₂max − 3.5)/0.2 m/min); a trained recreational marathoner holds
 *     ~80% of that over 42 km. Anchors the estimate to current aerobic fitness
 *     so it tracks Garmin's VO₂max as it climbs.
 *
 * The two are averaged when both exist — best-effort Riegel alone is slightly
 * optimistic (no marathon fade), VO₂max tempers it; VO₂max alone ignores
 * demonstrated durability, Riegel grounds it.
 */
function predictRacePace(acts: Activity[], daysToRace: number, vo2max?: number | null) {
  // VO₂max ⇒ velocity at VO₂max (m/min) via the ACSM running-economy inverse.
  const vVO2max = vo2max && vo2max > 30 ? (vo2max - 3.5) / 0.2 : null;

  // 1. Best-effort Riegel — fastest projection from race-equivalent efforts.
  //    Guard against data artifacts (interval sessions logged moving-time-only,
  //    GPS glitches) by discarding any projection faster than ~92% of velocity
  //    at VO₂max — no one races a marathon faster than that, so a faster
  //    projection is bad data, not fitness. Then take the best legit effort.
  const efforts = acts
    .filter((a) => (a.distance_km ?? 0) >= 10 && a.duration_s)
    .slice(0, 30);
  let riegelPace: number | null = null;
  if (efforts.length > 0) {
    const projections = efforts.map(
      (r) => (r.duration_s! * Math.pow(42.195 / r.distance_km!, 1.06)) / 42.195,
    );
    const floorPace = vVO2max ? 60000 / (0.92 * vVO2max) : 0; // fastest physiologically plausible (s/km)
    const plausible = projections.filter((p) => p >= floorPace);
    riegelPace = Math.min(...(plausible.length ? plausible : projections));
  }

  // 2. VO₂max physiological estimate (s/km).
  let vo2Pace: number | null = null;
  if (vVO2max) {
    const MARATHON_FRACTION = 0.8; // % of vVO₂max sustainable over the marathon
    vo2Pace = 60000 / (MARATHON_FRACTION * vVO2max);
  }

  // 3. Blend.
  let pace: number | null;
  let method: string;
  if (riegelPace !== null && vo2Pace !== null) {
    pace = (riegelPace + vo2Pace) / 2;
    method = "best effort + VO₂max";
  } else if (riegelPace !== null) {
    pace = riegelPace;
    method = "best effort";
  } else if (vo2Pace !== null) {
    pace = vo2Pace;
    method = "VO₂max";
  } else {
    return { pacePerKm: null as number | null, note: "Need a 10+ km run or VO₂max to predict." };
  }

  const horizon =
    daysToRace > 84
      ? "Early estimate — fitness still building"
      : daysToRace > 28
      ? "In the build — refresh weekly"
      : "Race-ready estimate";
  return { pacePerKm: Math.round(pace), note: `${horizon} · ${method}` };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-lg sm:text-xl font-semibold text-[--color-ink] mb-3">
      {children}
    </h2>
  );
}

// -------------------------- session breakdown UI --------------------------

const KIND_COLOURS: Record<
  SessionKind,
  { plan: string; actual: string; label: string }
> = {
  easy:     { plan: "#cbd5e1",  actual: "var(--color-coach)",      label: "Easy" },
  shakeout: { plan: "#cbd5e1",  actual: "var(--color-coach)",      label: "Shakeout" },
  strides:  { plan: "#a3b6cc",  actual: "color-mix(in oklab, var(--color-coach) 65%, white)", label: "Strides" },
  tempo:    { plan: "#9ca3af",  actual: "var(--color-warn)",       label: "Tempo" },
  interval: { plan: "#7d8593",  actual: "color-mix(in oklab, var(--color-race) 80%, white)", label: "Interval" },
  long:     { plan: "#5a6271",  actual: "#1a6b3c",                  label: "Long" },
  mp:       { plan: "#5a6271",  actual: "#1a6b3c",                  label: "MP" },
  hyrox:    { plan: "#b08968",  actual: "#b08968",                  label: "Hyrox" },
};

const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const KIND_LABELS: Record<SessionKind, string> = {
  easy: "Easy",
  shakeout: "Shakeout",
  strides: "Strides",
  tempo: "Tempo",
  interval: "Interval",
  long: "Long",
  mp: "MP",
  hyrox: "Hyrox",
};

function KindLegend() {
  const items: Array<{ kind: SessionKind; label: string }> = [
    { kind: "easy", label: "Easy" },
    { kind: "tempo", label: "Tempo" },
    { kind: "interval", label: "Interval" },
    { kind: "long", label: "Long / MP" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-[--color-ink-dim] font-semibold">
      {items.map(({ kind, label }) => (
        <span key={kind} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: KIND_COLOURS[kind].actual }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

function SessionsList({
  title,
  sessions,
  done,
  emptyMsg,
  ranked = false,
  travelDays,
}: {
  title: string;
  sessions: Session[];
  done: boolean;
  emptyMsg: string;
  /** When true, shows priority numbers (1, 2, 3) on each row. */
  ranked?: boolean;
  /** Day-of-week offsets (0=Mon…6=Sun) that fall inside a travel block. */
  travelDays?: Set<number>;
}) {
  return (
    <div className="rounded-xl bg-[--color-surface] border border-[--color-border] p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-[--color-ink-mid] mb-2">
        {title}
        {sessions.length > 0 && (
          <span className="ml-2 text-[--color-ink-dim] font-normal">
            ({sessions.length})
          </span>
        )}
      </div>
      {sessions.length === 0 ? (
        <div className="text-xs text-[--color-ink-dim] italic py-2">{emptyMsg}</div>
      ) : (
        <ul className="space-y-1.5">
          {sessions.map((s, i) => {
            const c = KIND_COLOURS[s.kind].actual;
            const isKeystone = s.kind === "long" || s.kind === "mp";
            return (
              <li
                key={i}
                className="flex items-center gap-2.5 text-sm"
                style={{ color: done ? "var(--color-ink-mid)" : "var(--color-ink)" }}
              >
                <span
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0 text-[10px] text-white font-bold"
                  style={{ background: done ? "var(--color-good)" : c }}
                >
                  {done ? "✓" : ranked ? i + 1 : ""}
                </span>
                <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[--color-ink-dim] w-7 shrink-0">
                  {DAY_ABBR[s.dayOfWeek]}
                </span>
                <span
                  className={done ? "line-through opacity-70" : ""}
                  style={{ flex: 1 }}
                >
                  {s.label}
                </span>
                {isKeystone && !done && (
                  <span
                    className="text-[10px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: "var(--color-race)", color: "white" }}
                    title="Keystone — most important session of the week"
                  >
                    ★ Keystone
                  </span>
                )}
                {travelDays?.has(s.dayOfWeek) && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded shrink-0 font-semibold"
                    style={{ background: "#e0f2fe", color: "#0369a1" }}
                    title="Travel day — jet-lag protocol active"
                  >
                    ✈️
                  </span>
                )}
                <span
                  className="text-[10px] uppercase tracking-[0.14em] font-semibold px-1.5 py-0.5 rounded"
                  style={{ background: `${c}1f`, color: c }}
                >
                  {KIND_LABELS[s.kind]}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Strava sync button — mirrors the RefreshButton pattern from Vitals.tsx.
 * POSTs to the local input server on port 8765, then reloads after 30 s
 * to give the sync time to land.
 */
function StravaSync() {
  const [state, setState] = useState<"idle" | "syncing" | "done">("idle");

  const trigger = () => {
    if (state !== "idle") return;
    setState("syncing");
    fetch("http://localhost:8765/sync", { method: "POST" }).catch(() => {
      // best-effort — server may not be running in prod preview
    });
    setTimeout(() => {
      setState("done");
      window.location.reload();
    }, 30_000);
  };

  return (
    <button
      type="button"
      onClick={trigger}
      disabled={state !== "idle"}
      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] uppercase tracking-[0.14em] font-semibold transition disabled:opacity-60"
      style={{
        borderColor: "var(--color-coach-soft)",
        color: state === "syncing" ? "var(--color-ink-dim)" : "var(--color-coach)",
        background: "var(--color-coach-tint, var(--color-surface-2))",
      }}
      title="Trigger a Strava sync via the local Holy input server"
    >
      <span
        className={state === "syncing" ? "animate-spin inline-block" : "inline-block"}
        aria-hidden
      >
        ↻
      </span>
      {state === "syncing" ? "Syncing…" : "Strava sync"}
    </button>
  );
}

/**
 * Render a week-range label like "May 4–10, 2026" given the ISO Monday of
 * that week. Compresses to one month name when start and end share a month.
 */
function weekRangeLabel(weekStartIso: string): string {
  // Parse as UTC midnight to avoid TZ slippage moving Monday to Sunday.
  const start = new Date(weekStartIso + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const startFmt = format(start, sameMonth ? "MMM d" : "MMM d");
  const endFmt = sameMonth
    ? format(end, "d, yyyy")
    : sameYear
    ? format(end, "MMM d, yyyy")
    : format(end, "MMM d, yyyy");
  return `${startFmt}–${endFmt}`;
}

/**
 * Weekly Z2 / Vigorous tile — small progress card with target line + ? tooltip.
 * Source of the 150/75-minute split: WHO physical-activity guidelines, also
 * adopted in the Bryan Johnson Blueprint protocol.
 */
function ZoneTile({
  label, value, target, unit, description, colour, tint,
}: {
  label: string; value: number; target: number; unit: string;
  description: string; colour: string; tint: string;
}) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  const hit = value >= target;
  return (
    <div
      className="rounded-lg p-3 border"
      style={{ background: tint, borderColor: "color-mix(in oklab, " + colour + " 25%, transparent)" }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="text-[10px] uppercase tracking-[0.14em] font-bold"
          style={{ color: colour }}
          title={description}
        >
          {label}
        </span>
        <span className="text-[10px] text-[--color-ink-dim] tabular">
          target {target} {unit}
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-display text-2xl font-semibold tabular" style={{ color: "var(--color-ink)" }}>
          {value}
        </span>
        <span className="text-xs text-[--color-ink-mid]">{unit}</span>
        {hit && (
          <span
            className="ml-auto text-[10px] uppercase tracking-[0.14em] font-bold"
            style={{ color: "var(--color-good)" }}
          >
            ✓ on target
          </span>
        )}
      </div>
      {/* progress bar */}
      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "color-mix(in oklab, " + colour + " 12%, transparent)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: pct + "%", background: colour }}
        />
      </div>
      <div className="text-[10.5px] text-[--color-ink-dim] mt-1.5 leading-snug">{description}</div>
    </div>
  );
}
