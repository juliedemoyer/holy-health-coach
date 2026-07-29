import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  ShoppingCart,
  Check,
  Plus,
  X,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  MEALS,
  MACRO_TARGETS,
  PRESET_DAYS,
  LUTEAL_NOTE,
  AISLE_ORDER,
  aisleFor,
  mealById,
} from "@/lib/mealPlan";
import type {
  Meal,
  Slot,
  DayType,
  PresetDay,
  Impact,
  MacroTarget,
  Aisle,
} from "@/lib/mealPlan";

/* ── types + constants ─────────────────────────────────────────────── */

const SLOTS: Slot[] = ["breakfast", "lunch", "dinner", "snack"];
const SLOT_LABEL: Record<Slot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};
const MAX_SNACKS = 2;
const LS_DAY = "holy.nutrition.mealDay";
const LS_GROCERY = "holy.nutrition.groceryList";

interface Picks {
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  snacks: string[];
}
interface StoredDay {
  dayType: DayType;
  picks: Picks;
}
interface GroceryItem {
  name: string;
  checked: boolean;
}
type MacroStatus = "good" | "under" | "over";

const EMPTY_PICKS: Picks = {
  breakfast: null,
  lunch: null,
  dinner: null,
  snacks: [],
};

/* ── localStorage ──────────────────────────────────────────────────── */

function loadDay(): StoredDay {
  try {
    const raw = localStorage.getItem(LS_DAY);
    if (!raw) return { dayType: "easy", picks: EMPTY_PICKS };
    const p = JSON.parse(raw) as Partial<StoredDay>;
    return {
      dayType: p.dayType === "hard" ? "hard" : "easy",
      picks: {
        breakfast: p.picks?.breakfast ?? null,
        lunch: p.picks?.lunch ?? null,
        dinner: p.picks?.dinner ?? null,
        snacks: Array.isArray(p.picks?.snacks)
          ? p.picks!.snacks.slice(0, MAX_SNACKS)
          : [],
      },
    };
  } catch {
    return { dayType: "easy", picks: EMPTY_PICKS };
  }
}

function loadGrocery(): GroceryItem[] {
  try {
    const raw = localStorage.getItem(LS_GROCERY);
    if (!raw) return [];
    const p = JSON.parse(raw) as GroceryItem[];
    return Array.isArray(p)
      ? p
          .filter((x) => x && typeof x.name === "string")
          .map((x) => ({ name: x.name, checked: !!x.checked }))
      : [];
  } catch {
    return [];
  }
}

/* ── macro assessment ──────────────────────────────────────────────── */

function kcalStatus(v: number, t: MacroTarget): MacroStatus {
  if (v < t.kcalLow) return "under";
  if (v > t.kcalHigh) return "over";
  return "good";
}
// Protein over target is fine — only "under" is a problem worth flagging.
function proteinStatus(v: number, target: number): MacroStatus {
  return v >= target * 0.9 ? "good" : "under";
}
function rangeStatus(v: number, target: number): MacroStatus {
  if (v < target * 0.85) return "under";
  if (v > target * 1.15) return "over";
  return "good";
}
function statusColor(s: MacroStatus): string {
  if (s === "good") return "var(--color-good)";
  if (s === "over") return "var(--color-warn)";
  return "var(--color-ink-dim)";
}

/* ── root ──────────────────────────────────────────────────────────── */

export function MealPlanner() {
  const [day, setDay] = useState<StoredDay>(loadDay);
  const [tab, setTab] = useState<Slot>("breakfast");
  const [grocery, setGrocery] = useState<GroceryItem[]>(loadGrocery);

  const { dayType, picks } = day;

  useEffect(() => {
    localStorage.setItem(LS_DAY, JSON.stringify(day));
  }, [day]);
  useEffect(() => {
    localStorage.setItem(LS_GROCERY, JSON.stringify(grocery));
  }, [grocery]);

  const setDayType = (dt: DayType) => setDay((d) => ({ ...d, dayType: dt }));
  const setPicks = (fn: (p: Picks) => Picks) =>
    setDay((d) => ({ ...d, picks: fn(d.picks) }));

  function selectMeal(meal: Meal) {
    setPicks((p) => {
      if (meal.slot === "snack") {
        if (p.snacks.includes(meal.id))
          return { ...p, snacks: p.snacks.filter((s) => s !== meal.id) };
        return { ...p, snacks: [...p.snacks, meal.id].slice(-MAX_SNACKS) };
      }
      const slot = meal.slot;
      return { ...p, [slot]: p[slot] === meal.id ? null : meal.id };
    });
  }

  function isSelected(meal: Meal): boolean {
    if (meal.slot === "snack") return picks.snacks.includes(meal.id);
    return picks[meal.slot] === meal.id;
  }

  const dayMeals = useMemo(() => {
    const ids = [picks.breakfast, picks.lunch, picks.dinner, ...picks.snacks];
    return ids
      .filter((x): x is string => !!x)
      .map((id) => mealById(id))
      .filter((m): m is Meal => !!m);
  }, [picks]);

  const totals = useMemo(
    () =>
      dayMeals.reduce(
        (a, m) => ({
          protein: a.protein + m.protein,
          carbs: a.carbs + m.carbs,
          fat: a.fat + m.fat,
          kcal: a.kcal + m.kcal,
        }),
        { protein: 0, carbs: 0, fat: 0, kcal: 0 },
      ),
    [dayMeals],
  );

  function loadPreset(preset: PresetDay) {
    setDay({
      dayType: preset.dayType,
      picks: {
        breakfast: preset.breakfast,
        lunch: preset.lunch,
        dinner: preset.dinner,
        snacks: preset.snacks.slice(0, MAX_SNACKS),
      },
    });
  }

  function clearDay() {
    setDay((d) => ({ ...d, picks: EMPTY_PICKS }));
  }

  function addToGrocery(names: string[]) {
    setGrocery((list) => {
      const have = new Set(list.map((i) => i.name.toLowerCase()));
      const next = [...list];
      for (const raw of names) {
        const name = raw.trim();
        if (name && !have.has(name.toLowerCase())) {
          next.push({ name, checked: false });
          have.add(name.toLowerCase());
        }
      }
      return next;
    });
  }

  function browseSlot(slot: Slot) {
    setTab(slot);
    document
      .getElementById("meal-browser")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <section>
        <h3 className="font-display text-base font-medium text-[--color-ink] mb-3">
          Your 30-day meal plan
        </h3>
        <div className="space-y-3">
          <SafetyCallout />
          <TargetCards dayType={dayType} />
        </div>
      </section>

      <section>
        <h3 className="font-display text-base font-medium text-[--color-ink] mb-3">
          Build your day
        </h3>
        <DayBuilder
          dayType={dayType}
          picks={picks}
          dayMeals={dayMeals}
          totals={totals}
          onSetDayType={setDayType}
          onRemove={(meal) => selectMeal(meal)}
          onBrowse={browseSlot}
          onLoadPreset={loadPreset}
          onClearDay={clearDay}
          onAddDayToGrocery={() =>
            addToGrocery(dayMeals.flatMap((m) => m.ingredients))
          }
        />
      </section>

      <section id="meal-browser">
        <h3 className="font-display text-base font-medium text-[--color-ink] mb-3">
          Browse meals — ranked by fat-loss impact
        </h3>
        <MealBrowser
          tab={tab}
          onTab={setTab}
          isSelected={isSelected}
          onSelect={selectMeal}
          onAddGrocery={(m) => addToGrocery(m.ingredients)}
        />
      </section>

      <section>
        <GroceryPanel
          items={grocery}
          onAdd={(name) => addToGrocery([name])}
          onToggle={(name) =>
            setGrocery((l) =>
              l.map((i) =>
                i.name === name ? { ...i, checked: !i.checked } : i,
              ),
            )
          }
          onRemove={(name) =>
            setGrocery((l) => l.filter((i) => i.name !== name))
          }
          onClearChecked={() =>
            setGrocery((l) => l.filter((i) => !i.checked))
          }
          onClearAll={() => setGrocery([])}
        />
      </section>
    </>
  );
}

/* ── safety callout ────────────────────────────────────────────────── */

function SafetyCallout() {
  return (
    <div
      className="holy-card p-5 border-l-4"
      style={{
        background: "color-mix(in oklab, var(--color-doc) 5%, transparent)",
        borderLeftColor: "var(--color-doc)",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="w-9 h-9 rounded-full grid place-items-center shrink-0"
          style={{
            background: "var(--color-doc-soft)",
            color: "var(--color-doc)",
          }}
        >
          <ShieldCheck className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <div className="font-display font-semibold text-[--color-ink]">
            Recomposition — not a crash diet
          </div>
          <p className="text-xs text-[--color-ink-mid] mt-1 leading-relaxed">
            Doc and Nutri set the guardrails on this plan:
          </p>
          <ul className="text-xs text-[--color-ink] mt-2 space-y-1.5 leading-relaxed">
            <li>
              Small deficit on <strong>easy / rest days only</strong> — hard
              and long-run days are fuelled at or above maintenance. Never
              under-eat before training.
            </li>
            <li>
              The deficit <strong>stops at Week 9</strong> of the build. This
              plan sets habits now — it doesn't chase the scale.
            </li>
            <li>
              Body fat % isn't measured by your watch. Track the{" "}
              <strong>7-day weight average + Sunday photos</strong>, not a
              daily number.
            </li>
            <li>
              Protein stays high every single day — that's what protects
              muscle. Fuel the engine.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ── macro target cards ────────────────────────────────────────────── */

function TargetCards({ dayType }: { dayType: DayType }) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(["easy", "hard"] as DayType[]).map((dt) => {
          const t = MACRO_TARGETS[dt];
          const active = dt === dayType;
          return (
            <div
              key={dt}
              className="holy-card p-4"
              style={
                active
                  ? {
                      borderColor: "var(--color-nutri)",
                      boxShadow: "0 0 0 1px var(--color-nutri)",
                    }
                  : undefined
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display font-semibold text-sm text-[--color-ink]">
                  {t.label}
                </span>
                {active && (
                  <span
                    className="text-[9px] uppercase tracking-[0.16em] font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      background: "var(--color-nutri-soft)",
                      color: "var(--color-nutri)",
                    }}
                  >
                    your day
                  </span>
                )}
              </div>
              <div className="mt-2 font-display text-xl font-bold text-[--color-ink] tabular">
                {t.kcalLow}–{t.kcalHigh}
                <span className="text-xs font-medium text-[--color-ink-dim]">
                  {" "}
                  kcal
                </span>
              </div>
              <div className="flex gap-3 mt-1 text-xs text-[--color-ink-mid] tabular">
                <span>{t.protein}g P</span>
                <span>{t.carbs}g C</span>
                <span>{t.fat}g F</span>
              </div>
              <p className="text-[11px] text-[--color-ink-dim] mt-2 leading-relaxed">
                {t.note}
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-[--color-ink-dim] leading-relaxed italic">
        {LUTEAL_NOTE}
      </p>
    </div>
  );
}

/* ── day builder ───────────────────────────────────────────────────── */

function DayBuilder({
  dayType,
  picks,
  dayMeals,
  totals,
  onSetDayType,
  onRemove,
  onBrowse,
  onLoadPreset,
  onClearDay,
  onAddDayToGrocery,
}: {
  dayType: DayType;
  picks: Picks;
  dayMeals: Meal[];
  totals: { protein: number; carbs: number; fat: number; kcal: number };
  onSetDayType: (dt: DayType) => void;
  onRemove: (meal: Meal) => void;
  onBrowse: (slot: Slot) => void;
  onLoadPreset: (p: PresetDay) => void;
  onClearDay: () => void;
  onAddDayToGrocery: () => void;
}) {
  const [added, setAdded] = useState(false);
  const t = MACRO_TARGETS[dayType];
  const empty = dayMeals.length === 0;

  const kStat = kcalStatus(totals.kcal, t);
  const pStat = proteinStatus(totals.protein, t.protein);
  const cStat = rangeStatus(totals.carbs, t.carbs);
  const fStat = rangeStatus(totals.fat, t.fat);

  let verdict = "Pick a meal for each slot to see how your day stacks up.";
  let verdictColor = "var(--color-ink-dim)";
  if (!empty) {
    if (pStat === "under") {
      verdict = "Protein's short — add a HIGH-impact snack to top it up.";
      verdictColor = "var(--color-warn)";
    } else if (dayType === "hard" && kStat === "under") {
      verdict = "Under-fuelled for a hard day — add carbs, don't run on empty.";
      verdictColor = "var(--color-warn)";
    } else if (dayType === "easy" && kStat === "over") {
      verdict = "A little over for an easy day — fine, or swap one LOW pick.";
      verdictColor = "var(--color-warn)";
    } else if (dayType === "easy" && kStat === "under") {
      verdict =
        "A touch under for an easy day — that's the deficit working. A piece of fruit closes the gap if you're hungry.";
      verdictColor = "var(--color-good)";
    } else if (kStat === "good" && pStat === "good") {
      verdict = "Dialled in — this day's on plan. Protein and fuel both land.";
      verdictColor = "var(--color-good)";
    } else {
      verdict = "Close — tweak a pick or two and watch the bars settle.";
      verdictColor = "var(--color-ink-dim)";
    }
  }

  const slotIds: Record<Slot, string[]> = {
    breakfast: picks.breakfast ? [picks.breakfast] : [],
    lunch: picks.lunch ? [picks.lunch] : [],
    dinner: picks.dinner ? [picks.dinner] : [],
    snack: picks.snacks,
  };

  return (
    <div className="holy-card p-5 space-y-4">
      {/* day-type toggle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border border-[--color-border] w-fit">
          {(["easy", "hard"] as DayType[]).map((dt) => (
            <button
              key={dt}
              type="button"
              onClick={() => onSetDayType(dt)}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] font-semibold transition ${
                dayType === dt
                  ? "text-white"
                  : "text-[--color-ink-mid] bg-[--color-surface-2]"
              }`}
              style={
                dayType === dt
                  ? { background: "var(--color-nutri)" }
                  : undefined
              }
            >
              {dt === "easy" ? "Easy / Rest" : "Hard / Long-run"}
            </button>
          ))}
        </div>
        {!empty && (
          <button
            type="button"
            onClick={onClearDay}
            className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] font-semibold text-[--color-ink-dim] hover:text-[--color-ink]"
          >
            <RotateCcw className="w-3 h-3" /> Clear day
          </button>
        )}
      </div>

      {/* slot rows */}
      <div className="space-y-2">
        {SLOTS.map((slot) => (
          <SlotRow
            key={slot}
            slot={slot}
            meals={slotIds[slot]
              .map((id) => mealById(id))
              .filter((m): m is Meal => !!m)}
            onRemove={onRemove}
            onBrowse={() => onBrowse(slot)}
          />
        ))}
      </div>

      {/* live totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MacroStat
          label="Calories"
          value={String(totals.kcal)}
          goal={`${t.kcalLow}–${t.kcalHigh}`}
          pct={Math.min(100, Math.round((totals.kcal / t.kcalHigh) * 100))}
          status={kStat}
        />
        <MacroStat
          label="Protein"
          value={`${totals.protein}g`}
          goal={`${t.protein}g`}
          pct={Math.min(100, Math.round((totals.protein / t.protein) * 100))}
          status={pStat}
        />
        <MacroStat
          label="Carbs"
          value={`${totals.carbs}g`}
          goal={`${t.carbs}g`}
          pct={Math.min(100, Math.round((totals.carbs / t.carbs) * 100))}
          status={cStat}
        />
        <MacroStat
          label="Fat"
          value={`${totals.fat}g`}
          goal={`${t.fat}g`}
          pct={Math.min(100, Math.round((totals.fat / t.fat) * 100))}
          status={fStat}
        />
      </div>

      <p
        className="text-xs font-medium leading-relaxed"
        style={{ color: verdictColor }}
      >
        {verdict}
      </p>

      {/* presets */}
      <div className="border-t border-[--color-border] pt-3">
        <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[--color-ink-dim] mb-2">
          Or load one of Nutri's days
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESET_DAYS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onLoadPreset(p)}
              title={p.why}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full border border-[--color-border] bg-[--color-surface-2] text-[--color-ink] hover:border-[--color-nutri] transition"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* add to grocery */}
      <button
        type="button"
        disabled={empty}
        onClick={() => {
          onAddDayToGrocery();
          setAdded(true);
          setTimeout(() => setAdded(false), 1600);
        }}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition disabled:opacity-40"
        style={{ background: "var(--color-nutri)" }}
      >
        {added ? (
          <>
            <Check className="w-4 h-4" /> Added to grocery list
          </>
        ) : (
          <>
            <ShoppingCart className="w-4 h-4" /> Add this day's ingredients to
            grocery list
          </>
        )}
      </button>
    </div>
  );
}

function SlotRow({
  slot,
  meals,
  onRemove,
  onBrowse,
}: {
  slot: Slot;
  meals: Meal[];
  onRemove: (meal: Meal) => void;
  onBrowse: () => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-20 shrink-0 pt-1.5 text-[11px] uppercase tracking-[0.12em] font-semibold text-[--color-ink-dim]">
        {SLOT_LABEL[slot]}
      </div>
      <div className="flex-1 min-w-0 flex flex-wrap gap-1.5 items-center">
        {meals.length === 0 && (
          <span className="text-xs text-[--color-ink-dim] py-1.5">
            Nothing picked yet
          </span>
        )}
        {meals.map((m) => (
          <span
            key={m.id}
            className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs"
            style={{
              background: "var(--color-nutri-soft)",
              color: "var(--color-ink)",
            }}
          >
            <span className="truncate max-w-[12rem]">{m.name}</span>
            <span className="text-[--color-ink-dim] tabular">{m.kcal}</span>
            <button
              type="button"
              onClick={() => onRemove(m)}
              className="grid place-items-center w-4 h-4 rounded-full hover:bg-[--color-nutri] hover:text-white text-[--color-ink-mid]"
              aria-label={`Remove ${m.name}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={onBrowse}
          className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border border-dashed border-[--color-border-strong] text-[--color-ink-mid] hover:border-[--color-nutri] hover:text-[--color-nutri] transition"
        >
          <Plus className="w-3 h-3" />
          {meals.length > 0 && slot === "snack" && meals.length < MAX_SNACKS
            ? "Another"
            : meals.length > 0
              ? "Change"
              : "Pick"}
        </button>
      </div>
    </div>
  );
}

function MacroStat({
  label,
  value,
  goal,
  pct,
  status,
}: {
  label: string;
  value: string;
  goal: string;
  pct: number;
  status: MacroStatus;
}) {
  const color = statusColor(status);
  return (
    <div className="rounded-lg bg-[--color-surface-2] p-3">
      <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[--color-ink-dim]">
        {label}
      </div>
      <div className="font-display font-bold text-[--color-ink] tabular mt-0.5">
        {value}
        <span className="text-[10px] font-medium text-[--color-ink-dim]">
          {" "}
          / {goal}
        </span>
      </div>
      <div className="h-1 rounded-full bg-[--color-border] mt-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

/* ── meal browser ──────────────────────────────────────────────────── */

const IMPACT_STYLE: Record<Impact, { bg: string; fg: string }> = {
  HIGH: { bg: "var(--color-good-soft)", fg: "var(--color-good)" },
  MEDIUM: { bg: "var(--color-warn-soft)", fg: "var(--color-warn)" },
  LOW: { bg: "var(--color-surface-2)", fg: "var(--color-ink-dim)" },
};

function MealBrowser({
  tab,
  onTab,
  isSelected,
  onSelect,
  onAddGrocery,
}: {
  tab: Slot;
  onTab: (s: Slot) => void;
  isSelected: (m: Meal) => boolean;
  onSelect: (m: Meal) => void;
  onAddGrocery: (m: Meal) => void;
}) {
  const meals = useMemo(
    () => MEALS.filter((m) => m.slot === tab).sort((a, b) => a.rank - b.rank),
    [tab],
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 flex-wrap">
        {SLOTS.map((s) => {
          const active = s === tab;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onTab(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                active
                  ? "text-white"
                  : "bg-[--color-surface-2] text-[--color-ink-mid]"
              }`}
              style={active ? { background: "var(--color-nutri)" } : undefined}
            >
              {SLOT_LABEL[s]}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {meals.map((m) => (
          <MealCard
            key={m.id}
            meal={m}
            selected={isSelected(m)}
            onSelect={() => onSelect(m)}
            onAddGrocery={() => onAddGrocery(m)}
          />
        ))}
      </div>
    </div>
  );
}

function MealCard({
  meal,
  selected,
  onSelect,
  onAddGrocery,
}: {
  meal: Meal;
  selected: boolean;
  onSelect: () => void;
  onAddGrocery: () => void;
}) {
  const [added, setAdded] = useState(false);
  const impact = IMPACT_STYLE[meal.impact];

  return (
    <div
      className="holy-card relative transition"
      style={
        selected
          ? {
              borderColor: "var(--color-nutri)",
              boxShadow: "0 0 0 1px var(--color-nutri)",
            }
          : undefined
      }
    >
      <button
        type="button"
        onClick={onSelect}
        className="text-left w-full p-4 pr-12 block"
      >
        <div className="flex items-center gap-2">
          <span className="grid place-items-center w-6 h-6 rounded-full bg-[--color-surface-2] text-[10px] font-bold text-[--color-ink-mid] tabular shrink-0">
            {meal.rank}
          </span>
          <span
            className="text-[9px] uppercase tracking-[0.14em] font-bold px-2 py-0.5 rounded-full"
            style={{ background: impact.bg, color: impact.fg }}
          >
            {meal.impact} impact
          </span>
        </div>
        <div className="font-display font-medium text-[--color-ink] mt-2">
          {meal.name}
        </div>
        <p className="text-xs text-[--color-ink-mid] mt-0.5 leading-relaxed">
          {meal.description}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-xs text-[--color-ink] tabular">
          <span>
            <strong>{meal.kcal}</strong> kcal
          </span>
          <span>{meal.protein}g P</span>
          <span>{meal.carbs}g C</span>
          <span>{meal.fat}g F</span>
          <span className="text-[--color-ink-dim]">{meal.prepMin} min</span>
        </div>
        <p className="text-[11px] text-[--color-ink-dim] mt-2 leading-relaxed italic">
          {meal.note}
        </p>
      </button>

      <button
        type="button"
        onClick={() => {
          onAddGrocery();
          setAdded(true);
          setTimeout(() => setAdded(false), 1400);
        }}
        title="Add ingredients to grocery list"
        aria-label={`Add ${meal.name} ingredients to grocery list`}
        className="absolute top-3 right-3 grid place-items-center w-8 h-8 rounded-lg transition"
        style={{
          background: added ? "var(--color-good)" : "var(--color-surface-2)",
          color: added ? "#fff" : "var(--color-ink-mid)",
        }}
      >
        {added ? (
          <Check className="w-4 h-4" />
        ) : (
          <ShoppingCart className="w-4 h-4" />
        )}
      </button>

      {selected && (
        <div
          className="px-4 py-1.5 text-[10px] uppercase tracking-[0.14em] font-bold rounded-b-[13px]"
          style={{
            background: "var(--color-nutri-soft)",
            color: "var(--color-nutri)",
          }}
        >
          ✓ In your {meal.slot === "snack" ? "snacks" : meal.slot}
        </div>
      )}
    </div>
  );
}

/* ── grocery panel ─────────────────────────────────────────────────── */

function GroceryPanel({
  items,
  onAdd,
  onToggle,
  onRemove,
  onClearChecked,
  onClearAll,
}: {
  items: GroceryItem[];
  onAdd: (name: string) => void;
  onToggle: (name: string) => void;
  onRemove: (name: string) => void;
  onClearChecked: () => void;
  onClearAll: () => void;
}) {
  const [draft, setDraft] = useState("");
  const checkedCount = items.filter((i) => i.checked).length;

  const grouped = useMemo(() => {
    const groups = new Map<Aisle, GroceryItem[]>();
    for (const item of items) {
      const a = aisleFor(item.name);
      const arr = groups.get(a);
      if (arr) arr.push(item);
      else groups.set(a, [item]);
    }
    return AISLE_ORDER.filter((a) => groups.has(a)).map((a) => ({
      aisle: a,
      items: groups
        .get(a)!
        .slice()
        .sort((x, y) =>
          x.checked !== y.checked
            ? x.checked
              ? 1
              : -1
            : x.name.localeCompare(y.name),
        ),
    }));
  }, [items]);

  const submit = () => {
    const name = draft.trim();
    if (!name) return;
    onAdd(name);
    setDraft("");
  };

  return (
    <>
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <h3 className="font-display text-base font-medium text-[--color-ink]">
          Grocery list
        </h3>
        <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[--color-ink-dim] tabular">
          {items.length} item{items.length === 1 ? "" : "s"}
          {checkedCount > 0 ? ` · ${checkedCount} done` : ""}
        </span>
      </div>

      <div className="holy-card p-5 space-y-4">
        {/* add custom */}
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Add an item — e.g. oat milk"
            className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[--color-bg] border border-[--color-border] text-sm"
          />
          <button
            type="button"
            onClick={submit}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white shrink-0"
            style={{ background: "var(--color-nutri)" }}
          >
            Add
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-[--color-ink-dim] leading-relaxed py-2">
            Empty for now. Tap the cart icon on any meal — or "Add this day's
            ingredients" in the builder — and items land here, grouped by aisle
            for the weekend shop.
          </p>
        ) : (
          <>
            <div className="space-y-3">
              {grouped.map(({ aisle, items: aisleItems }) => (
                <div key={aisle}>
                  <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-[--color-nutri] mb-1">
                    {aisle}
                  </div>
                  <ul>
                    {aisleItems.map((item) => (
                      <li
                        key={item.name}
                        className="flex items-center gap-2.5 py-1.5"
                      >
                        <button
                          type="button"
                          onClick={() => onToggle(item.name)}
                          className="grid place-items-center w-4 h-4 rounded border shrink-0 transition"
                          style={
                            item.checked
                              ? {
                                  background: "var(--color-good)",
                                  borderColor: "var(--color-good)",
                                }
                              : { borderColor: "var(--color-border-strong)" }
                          }
                          aria-label={
                            item.checked
                              ? `Mark ${item.name} not bought`
                              : `Mark ${item.name} bought`
                          }
                        >
                          {item.checked && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </button>
                        <span
                          className={`text-sm flex-1 min-w-0 ${
                            item.checked
                              ? "line-through text-[--color-ink-dim]"
                              : "text-[--color-ink]"
                          }`}
                        >
                          {item.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemove(item.name)}
                          className="text-[--color-ink-dim] hover:text-[--color-bad] shrink-0"
                          aria-label={`Remove ${item.name}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex gap-3 border-t border-[--color-border] pt-3">
              {checkedCount > 0 && (
                <button
                  type="button"
                  onClick={onClearChecked}
                  className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] font-semibold text-[--color-ink-dim] hover:text-[--color-ink]"
                >
                  <Check className="w-3 h-3" /> Clear {checkedCount} done
                </button>
              )}
              <button
                type="button"
                onClick={onClearAll}
                className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] font-semibold text-[--color-ink-dim] hover:text-[--color-bad]"
              >
                <Trash2 className="w-3 h-3" /> Clear all
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
