import { useEffect, useMemo, useRef, useState } from "react";
import { Apple, Plus, Sparkles } from "lucide-react";
import { signedUrl, supabase } from "@/lib/supabase";
import type { Database } from "@/types/db";
import { Empty, PageHeader } from "@/pages/Vitals";
import { MealPlanner } from "@/components/MealPlanner";
import { SUPPLEMENTS } from "@/lib/config";

type Meal = Database["public"]["Tables"]["meals"]["Row"];
type Recipe = Database["public"]["Tables"]["recipes"]["Row"];

/**
 * An example rotation, pre-seeded so the "Most-eaten foods" tile isn't
 * empty before a meaningful number of vision-tagged photos arrive. Tagged as
 * "fuel" (whole-food, runner-friendly) or "treat" (sweets / occasional). The
 * counts are pulled from real meal logs as they accrue and added on top.
 */
type FoodKind = "fuel" | "treat";
const SEED_FOODS: Array<{ name: string; kind: FoodKind }> = [
  { name: "greek yogurt 0%", kind: "fuel" },
  { name: "banana", kind: "fuel" },
  { name: "boiled egg", kind: "fuel" },
  { name: "pasta pesto", kind: "fuel" },
  { name: "pasta tomatoes", kind: "fuel" },
  { name: "mozzarella", kind: "fuel" },
  { name: "pizza", kind: "treat" },
  { name: "madeleine cookies", kind: "treat" },
];

// Anything matching these substrings gets auto-tagged as a treat. Everything
// else falls back to "fuel" — a deliberately permissive default.
const TREAT_HINTS = [
  "cookie",
  "madeleine",
  "pastry",
  "croissant",
  "pizza",
  "cake",
  "ice cream",
  "chocolate",
  "donut",
  "doughnut",
  "candy",
  "biscuit",
];

function classify(food: string): FoodKind {
  const seeded = SEED_FOODS.find((s) => s.name === food);
  if (seeded) return seeded.kind;
  const lower = food.toLowerCase();
  return TREAT_HINTS.some((h) => lower.includes(h)) ? "treat" : "fuel";
}

const LS_CUSTOM_FOODS = "holy.nutrition.customFoods";

function loadCustomFoods(): Array<{ name: string; kind: FoodKind }> {
  try {
    const raw = localStorage.getItem(LS_CUSTOM_FOODS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ name: string; kind: FoodKind }>;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomFoods(foods: Array<{ name: string; kind: FoodKind }>) {
  localStorage.setItem(LS_CUSTOM_FOODS, JSON.stringify(foods));
}

export function Nutrition() {
  const hasSupplements =
    SUPPLEMENTS.priority.length > 0 || SUPPLEMENTS.general.length > 0;
  const [meals, setMeals] = useState<Meal[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [customFoods, setCustomFoods] = useState(() => loadCustomFoods());

  useEffect(() => {
    void Promise.all([
      supabase.from("meals").select("*").order("date", { ascending: false }).limit(60),
      supabase.from("recipes").select("*").limit(50),
    ]).then(([m, r]) => {
      setMeals(m.data ?? []);
      setRecipes(r.data ?? []);
    });
  }, []);

  // Lazily resolve signed URLs for breakfast photos visible on screen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const m of meals.slice(0, 12)) {
        if (m.photo_path && !photoUrls[m.id]) {
          try {
            const [bucket, ...rest] = m.photo_path.split("/");
            next[m.id] = await signedUrl(bucket, rest.join("/"));
          } catch {
            // ignore
          }
        }
      }
      if (!cancelled && Object.keys(next).length) {
        setPhotoUrls((p) => ({ ...p, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meals, photoUrls]);

  // Combined food list: vision-extracted + the seeded rotation + custom.
  // Counts from real meals are added on top of the seed (so they appear even
  // before vision tagging produces matching strings).
  const topFoods = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of meals) {
      for (const f of m.foods ?? []) {
        const norm = f.toLowerCase().trim();
        counts.set(norm, (counts.get(norm) ?? 0) + 1);
      }
    }
    // Seed every entry so they appear with at least n=1
    for (const s of SEED_FOODS) {
      if (!counts.has(s.name)) counts.set(s.name, 1);
    }
    for (const c of customFoods) {
      if (!counts.has(c.name)) counts.set(c.name, 1);
    }
    return [...counts.entries()]
      .map(([food, count]) => ({ food, count, kind: classify(food) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 24);
  }, [meals, customFoods]);

  return (
    <div className="space-y-6">
      <PageHeader voice="nutri" Icon={Apple}>
        Nutrition
      </PageHeader>

      {/* Supplement reference card. Empty by default: see config/supplements.json */}
      {hasSupplements && (
      <section>
        <h3 className="font-display text-base font-medium text-[--color-ink] mb-3">
          Daily supplements
        </h3>
        <div className="holy-card p-4 sm:p-5 space-y-4">
          {/* Priority group */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold mb-2.5 flex items-center" style={{ color: "var(--color-warn)" }}>
              Priority
              {SUPPLEMENTS.prioritySource && <SourceTooltip text={SUPPLEMENTS.prioritySource} />}
            </div>
            <ul className="space-y-2">
              {PRIORITY_VITAMINS.map((v) => (
                <VitaminRow key={v.name} item={v} accent="var(--color-warn)" />
              ))}
            </ul>
          </div>
          {/* Divider */}
          <div className="border-t border-[--color-border]" />
          {/* Marathon stack group */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold mb-2.5 flex items-center" style={{ color: "var(--color-coach)" }}>
              Training stack · performance and recovery
              {SUPPLEMENTS.generalSource && <SourceTooltip text={SUPPLEMENTS.generalSource} />}
            </div>
            <ul className="space-y-2">
              {MARATHON_VITAMINS.map((v) => (
                <VitaminRow key={v.name} item={v} accent="var(--color-coach)" />
              ))}
            </ul>
          </div>
        </div>
      </section>
      )}

      {/* Optional daily-habit card. Hidden unless config/supplements.json sets it. */}
      {SUPPLEMENTS.probiotic && (
      <section>
        <h3 className="font-display text-base font-medium text-[--color-ink] mb-3">
          {SUPPLEMENTS.probiotic.name}
        </h3>
        <div className="holy-card p-4 sm:p-5 flex items-start gap-4">
          <div
            className="shrink-0 w-11 h-11 rounded-xl grid place-items-center text-2xl"
            style={{ background: "var(--color-good-tint, var(--color-surface-2))" }}
            aria-hidden
          >
            {SUPPLEMENTS.probiotic.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[--color-ink-mid] leading-relaxed">
              {SUPPLEMENTS.probiotic.detail}
            </p>
          </div>
        </div>
      </section>
      )}

      <MealPlanner />

      <section>
        <h3 className="font-display text-base font-medium text-[--color-ink] mb-3">
          Food snapshots — making healthy choices
        </h3>
        {meals.length === 0 ? (
          <EmptyGallery />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {meals.slice(0, 12).map((m) => (
              <div key={m.id} className="holy-card overflow-hidden">
                <div className="aspect-square bg-[--color-surface-2]">
                  {photoUrls[m.id] ? (
                    <img src={photoUrls[m.id]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-[--color-ink-dim] text-xs">
                      …
                    </div>
                  )}
                </div>
                {m.protein_g !== null && (
                  <div className="px-3 py-2">
                    <div className="text-[10px] text-[--color-ink-mid]">
                      {m.protein_g}g P · {m.carbs_g}g C · {m.fat_g}g F
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
          <h3 className="font-display text-base font-medium text-[--color-ink]">
            Most-eaten foods
          </h3>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] font-semibold">
            <span className="flex items-center gap-1.5">
              <Dot color="var(--color-good)" /> fuel
            </span>
            <span className="flex items-center gap-1.5">
              <Dot color="var(--color-warn)" /> treat
            </span>
          </div>
        </div>
        <div className="holy-card p-5 space-y-4">
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {topFoods.map(({ food, count, kind }) => (
              <li
                key={food}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[--color-surface-2] text-sm"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Dot
                    color={kind === "fuel" ? "var(--color-good)" : "var(--color-warn)"}
                  />
                  <span className="text-[--color-ink] capitalize truncate">{food}</span>
                </span>
                <span className="text-xs text-[--color-ink-dim] tabular shrink-0">{count}×</span>
              </li>
            ))}
          </ul>
          <AddFoodForm
            onAdd={(food) => {
              const next = [...customFoods.filter((c) => c.name !== food.name), food];
              setCustomFoods(next);
              saveCustomFoods(next);
            }}
            existing={topFoods.map((f) => f.food)}
          />
        </div>
      </section>

      <section>
        <h3 className="font-display text-base font-medium text-[--color-ink] mb-3">Recipe library</h3>
        {recipes.length === 0 ? (
          <Empty message="Recipes are seeded from 1. Knowledge/Recipes/ on first sync. 8 starters live in the repo." />
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recipes.map((r) => (
              <li key={r.id} className="holy-card p-4">
                <div className="font-display font-medium text-[--color-ink]">{r.title}</div>
                {r.tags && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {r.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full bg-[--color-coach-tint] text-[--color-coach]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {r.protein_g !== null && (
                  <div className="text-xs text-[--color-ink-mid] mt-2">
                    {r.protein_g}g P · {r.carbs_g}g C · {r.fat_g}g F
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---- vitamin data -------------------------------------------------------

interface VitaminItem {
  emoji: string;
  name: string;
  detail: string;
}

const PRIORITY_VITAMINS: VitaminItem[] = SUPPLEMENTS.priority;
const MARATHON_VITAMINS: VitaminItem[] = SUPPLEMENTS.general;

function SourceTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <span className="relative inline-flex items-center ml-1.5">
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[9px] font-bold leading-none opacity-50 hover:opacity-100 transition"
        aria-label="Source info"
      >
        ?
      </button>
      {open && (
        <span className="absolute left-5 top-1/2 -translate-y-1/2 z-10 w-56 text-[11px] leading-relaxed text-[--color-ink-mid] bg-[--color-surface-2] border border-[--color-border] rounded-lg px-3 py-2 shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}

function VitaminRow({ item, accent }: { item: VitaminItem; accent: string }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <span
        className="shrink-0 mt-0.5 w-1 self-stretch rounded-full"
        style={{ background: accent, minHeight: "1rem" }}
        aria-hidden
      />
      <span className="shrink-0 text-base leading-none mt-0.5">{item.emoji}</span>
      <span className="min-w-0">
        <span className="font-semibold text-[--color-ink]">{item.name}</span>
        <span className="text-[--color-ink-mid]"> — {item.detail}</span>
      </span>
    </li>
  );
}

// ---- subcomponents -------------------------------------------------------

function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
      style={{ background: color }}
    />
  );
}

function EmptyGallery() {
  return (
    <div className="holy-card p-8 text-center">
      <Sparkles
        className="w-6 h-6 mx-auto mb-3"
        style={{ color: "var(--color-nutri)" }}
      />
      <div className="text-sm text-[--color-ink] font-medium">No snapshots yet</div>
      <p className="text-xs text-[--color-ink-mid] mt-1.5 max-w-md mx-auto leading-relaxed">
        Meal photos land here as you log them — vision macros auto-populate
        each card.
      </p>
    </div>
  );
}

/**
 * Inline form: name + fuel/treat toggle. Custom foods stay client-side in
 * localStorage — they're a personal cheat-sheet, not data the swarm needs to
 * read. If we ever want them server-side, swap localStorage for a Supabase
 * table without changing the surface.
 */
function AddFoodForm({
  onAdd,
  existing,
}: {
  onAdd: (food: { name: string; kind: FoodKind }) => void;
  existing: string[];
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<FoodKind>("fuel");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const norm = name.trim().toLowerCase();
    if (!norm) {
      setError("Type a food name first");
      return;
    }
    if (existing.includes(norm)) {
      setError("Already in your list");
      return;
    }
    onAdd({ name: norm, kind });
    setName("");
    setError(null);
  };

  return (
    <div className="border-t border-[--color-border] pt-4">
      <div className="flex items-center gap-2 mb-2">
        <Plus className="w-3.5 h-3.5" style={{ color: "var(--color-nutri)" }} />
        <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[--color-ink-dim]">
          Add a food
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="e.g. salmon poke bowl"
          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[--color-bg] border border-[--color-border] text-sm"
        />
        <div className="flex rounded-lg overflow-hidden border border-[--color-border]">
          {(["fuel", "treat"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`px-3 py-2 text-[11px] uppercase tracking-[0.14em] font-semibold transition ${
                kind === k
                  ? "text-white"
                  : "text-[--color-ink-mid] bg-[--color-surface-2]"
              }`}
              style={
                kind === k
                  ? {
                      background: k === "fuel" ? "var(--color-good)" : "var(--color-warn)",
                    }
                  : undefined
              }
            >
              {k}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={submit}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
          style={{ background: "var(--color-nutri)" }}
        >
          Add
        </button>
      </div>
      {error && (
        <div className="text-[11px] text-[--color-warn] mt-1.5">{error}</div>
      )}
    </div>
  );
}
