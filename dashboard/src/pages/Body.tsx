import { useEffect, useRef, useState } from "react";
import { BUILD_START_ISO } from "@/lib/race";
import { Camera, X, ChevronLeft, ChevronRight } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { signedUrl, supabase } from "@/lib/supabase";
import type { Database } from "@/types/db";
import { Empty, PageHeader } from "@/pages/Vitals";
import { AGENTS } from "@/components/AgentAvatar";
import { DNA_INSIGHTS } from "@/lib/config";

type BodyPhoto = Database["public"]["Tables"]["body_photos"]["Row"];

const BUILD_START = new Date(`${BUILD_START_ISO}T00:00:00Z`);

/** Approximate period weeks (days 1–5 of each ~28-day cycle).
 *  First period during the build fell in week 3 (May 18–24).
 *  Every 4th week after that is also a period week. */
const PERIOD_WEEKS = new Set([3, 7, 11, 15, 19]);

function currentBuildWeek(): number {
  const today = new Date();
  const daysSinceStart = differenceInCalendarDays(today, BUILD_START);
  if (daysSinceStart < 0) return 0;
  return Math.ceil((daysSinceStart + 1) / 7);
}

export function Body() {
  const [photos, setPhotos] = useState<BodyPhoto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [compareWeeks, setCompareWeeks] = useState<[number | null, number | null]>([null, null]);
  const [lightbox, setLightbox] = useState<BodyPhoto | null>(null);

  const thisBuildWeek = currentBuildWeek();

  useEffect(() => {
    void supabase
      .from("body_photos")
      .select("*")
      .order("date", { ascending: true })
      .then(({ data }) => setPhotos(data ?? []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const p of photos) {
        if (urls[p.id]) continue;
        try {
          const [bucket, ...rest] = p.storage_path.split("/");
          next[p.id] = await signedUrl(bucket, rest.join("/"));
        } catch {
          // ignore
        }
      }
      if (!cancelled && Object.keys(next).length) {
        setUrls((u) => ({ ...u, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [photos, urls]);

  const racePhotos = photos.filter((p) => p.kind === "build_weekly");
  const hyroxPhotos = photos.filter((p) => p.kind === "hyrox");

  const left = racePhotos.find((p) => p.build_week === compareWeeks[0]);
  const right = racePhotos.find((p) => p.build_week === compareWeeks[1]);

  const coach = AGENTS.coach;
  const nutri = AGENTS.nutri;

  return (
    <div className="space-y-8">
      <PageHeader voice="coach" Icon={Camera}>
        Body
      </PageHeader>

      <p className="text-sm text-[--color-ink-mid] max-w-2xl">
        Weekly Sunday photo across the 20-week training build, plus the
        optional slot for race photos as you collect them. All photos are
        stored privately in Supabase Storage — only signed URLs, never public.
      </p>

      {/* ── 20-week grid ── */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-display text-base font-medium text-[--color-ink]">
            training build · 20 weeks
          </h3>
          <span className="text-xs text-[--color-ink-dim]">
            {racePhotos.length} / 20 logged
          </span>
        </div>
        {racePhotos.length === 0 ? (
          <Empty message="No photos yet. Drop a photo into your agent inbox folder and ask Coach to upload it." />
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {Array.from({ length: 20 }, (_, i) => i + 1).map((wk) => {
              const photo = racePhotos.find((p) => p.build_week === wk);
              // Current incomplete week always shows the numbered placeholder,
              // never the photo (even if one accidentally exists for this week).
              const isCurrentWeek = wk === thisBuildWeek;
              const url = photo && !isCurrentWeek ? urls[photo.id] : null;
              const isPeriodWeek = PERIOD_WEEKS.has(wk);
              const selected = compareWeeks[0] === wk || compareWeeks[1] === wk;
              const clickable = !!photo && !isCurrentWeek;

              return (
                <button
                  key={wk}
                  onClick={() => { if (clickable && photo) setLightbox(photo); }}
                  disabled={!clickable}
                  className={`holy-card overflow-hidden text-left transition relative ${
                    selected ? "ring-2 ring-[--color-race] ring-offset-2 ring-offset-[--color-bg]" : ""
                  } ${clickable ? "hover:scale-[1.02]" : "opacity-40 cursor-not-allowed"}`}
                >
                  <div className="aspect-[3/4] bg-[--color-surface-2] relative">
                    {isCurrentWeek ? (
                      <div className="w-full h-full grid place-items-center flex-col gap-1 text-[--color-ink-dim]">
                        <span className="text-xl font-display font-semibold text-[--color-ink-mid]">{wk}</span>
                        <span className="text-[9px] uppercase tracking-wide text-[--color-ink-dim] px-1 text-center leading-tight">
                          In progress
                        </span>
                      </div>
                    ) : url ? (
                      <img src={url} alt={`Week ${wk}`} className="w-full h-full object-cover" />
                    ) : photo ? (
                      <div className="w-full h-full grid place-items-center text-[--color-ink-dim] text-xs">…</div>
                    ) : (
                      <div className="w-full h-full grid place-items-center text-[--color-ink-dim] text-xl">
                        {wk}
                      </div>
                    )}

                    {/* Period week badge */}
                    {isPeriodWeek && (
                      <span
                        className="absolute bottom-1 left-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px]"
                        style={{ background: "rgba(236,72,153,0.18)", color: "#ec4899" }}
                        title="Period week"
                      >
                        🌸
                      </span>
                    )}
                  </div>
                  <div className="px-2 py-1.5">
                    <div className="text-[11px] text-[--color-ink]">Week {wk}</div>
                    {photo && !isCurrentWeek && (
                      <div className="text-[10px] text-[--color-ink-dim]">
                        {format(new Date(photo.date), "d MMM")}
                      </div>
                    )}
                    {isCurrentWeek && (
                      <div className="text-[10px]" style={{ color: coach.hue }}>current</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Coach / Nutri takeaway ── */}
      <section className="grid sm:grid-cols-2 gap-3">
        <div
          className="holy-card p-4 space-y-2"
          style={{ borderColor: coach.hueSoft }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.16em] font-bold"
            style={{ color: coach.hue }}
          >
            Coach says
          </div>
          <p className="text-sm text-[--color-ink-mid] leading-relaxed">
            Three weeks in, the build is taking shape. Your body composition
            is shifting the right way — training load is doing the work. Keep
            fuelling the long run well and the rest follows.
          </p>
        </div>
        <div
          className="holy-card p-4 space-y-2"
          style={{ borderColor: nutri.hueSoft }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.16em] font-bold"
            style={{ color: nutri.hue }}
          >
            Nutri says
          </div>
          <p className="text-sm text-[--color-ink-mid] leading-relaxed">
            Week 3 was period week — expect 0.5–1 kg of water weight. It's
            not fat, it's physiology. Iron-rich meals matter most now: lentil
            soup, spinach, salmon.
          </p>
        </div>
      </section>

      {/* ── Lightbox ── */}
      {lightbox && (
        <Lightbox
          photo={lightbox}
          url={urls[lightbox.id] ?? null}
          allPhotos={[...racePhotos, ...hyroxPhotos].filter(p => urls[p.id])}
          compareWeeks={compareWeeks}
          onCompare={(wk) =>
            setCompareWeeks(([a, b]) => {
              if (a === wk) return [b, null];
              if (b === wk) return [a, null];
              if (a === null) return [wk, b];
              if (b === null) return [a, wk];
              return [wk, a];
            })
          }
          onNavigate={(p) => setLightbox(p)}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* ── Side-by-side compare ── */}
      {(left || right) && (
        <section>
          <h3 className="font-display text-base font-medium text-[--color-ink] mb-3">
            Side-by-side
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <ComparePane photo={left} url={left ? urls[left.id] : null} fallback="pick a week →" />
            <ComparePane photo={right} url={right ? urls[right.id] : null} fallback="← pick a second week" />
          </div>
        </section>
      )}

      {/* ── Hyrox ── */}
      <section>
        <h3 className="font-display text-base font-medium text-[--color-ink] mb-3">Hyrox</h3>
        {hyroxPhotos.length === 0 ? (
          <Empty message="Empty until the first Hyrox event. Upload manually via the dashboard or drop into ~/Holy/inbox/." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {hyroxPhotos.map((p) => (
              <button
                key={p.id}
                onClick={() => urls[p.id] && setLightbox(p)}
                className="holy-card overflow-hidden text-left hover:scale-[1.02] transition"
              >
                <div className="aspect-[3/4] bg-[--color-surface-2]">
                  {urls[p.id] && <img src={urls[p.id]} alt={p.caption ?? ""} className="w-full h-full object-cover" />}
                </div>
                <div className="px-3 py-2">
                  <div className="text-xs text-[--color-ink]">{p.caption ?? "Race"}</div>
                  <div className="text-[10px] text-[--color-ink-dim]">{format(new Date(p.date), "d MMM yyyy")}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Genomics panel (optional, empty by default) ── */}
      {DNA_INSIGHTS.length > 0 && (
        <section>
          <h3 className="font-display text-base font-medium text-[--color-ink] mb-3">
            Your genomics notes
          </h3>
          <div className="holy-card p-5 space-y-4">
            <p className="text-xs text-[--color-ink-dim]">
              Transcribed by you from your own report, in config/dna-insights.json.
              Prompts to ask a clinician a better question, not diagnoses.
            </p>
            <ul className="space-y-3">
              {DNA_INSIGHTS.map((d) => (
                <DnaInsight key={d.title} level={d.level} title={d.title} action={d.action} />
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── Daily habits for recomposition ── */}
      <section>
        <h3 className="font-display text-base font-medium text-[--color-ink] mb-3">
          Daily habits for body recomposition
        </h3>
        <div className="holy-card p-4">
          <ul className="space-y-2.5">
            {[
              "Protein at every meal — target 25–30 g per sitting",
              "Fasted morning walk 20 min on rest days",
              "Eat iron-rich + vitamin C together (absorption synergy)",
              "7+ hours sleep is the #1 body composition lever",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2.5 text-sm text-[--color-ink-mid]">
                <span
                  className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: coach.hue }}
                />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

// ── Supporting components ──────────────────────────────────────────────────

function Lightbox({
  photo,
  url,
  allPhotos,
  compareWeeks,
  onCompare,
  onNavigate,
  onClose,
}: {
  photo: BodyPhoto;
  url: string | null;
  allPhotos: BodyPhoto[];
  compareWeeks: [number | null, number | null];
  onCompare: (wk: number) => void;
  onNavigate: (p: BodyPhoto) => void;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const idx = allPhotos.findIndex(p => p.id === photo.id);
  const prev = idx > 0 ? allPhotos[idx - 1] : null;
  const next = idx < allPhotos.length - 1 ? allPhotos[idx + 1] : null;
  const isInCompare = photo.build_week != null &&
    (compareWeeks[0] === photo.build_week || compareWeeks[1] === photo.build_week);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && prev) onNavigate(prev);
      if (e.key === "ArrowRight" && next) onNavigate(next);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next, onClose, onNavigate]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white p-1"
        aria-label="Close"
      >
        <X size={24} />
      </button>

      {/* Prev */}
      {prev && (
        <button
          onClick={() => onNavigate(prev)}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2"
          aria-label="Previous"
        >
          <ChevronLeft size={32} />
        </button>
      )}

      {/* Image */}
      <div className="flex flex-col items-center gap-3 max-h-[90vh] px-16">
        {url ? (
          <img
            src={url}
            alt={photo.build_week ? `Week ${photo.build_week}` : (photo.caption ?? "Photo")}
            className="max-h-[75vh] max-w-[85vw] object-contain rounded-lg shadow-2xl"
          />
        ) : (
          <div className="w-48 h-64 bg-white/10 rounded-lg grid place-items-center text-white/40 text-sm">
            Loading…
          </div>
        )}

        {/* Caption + compare button */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            {photo.build_week != null ? (
              <>
                <div className="text-white font-medium text-sm">Week {photo.build_week}</div>
                <div className="text-white/50 text-xs">{format(new Date(photo.date), "d MMM yyyy")}</div>
              </>
            ) : (
              <>
                <div className="text-white font-medium text-sm">{photo.caption ?? "Hyrox"}</div>
                <div className="text-white/50 text-xs">{format(new Date(photo.date), "d MMM yyyy")}</div>
              </>
            )}
          </div>
          {photo.build_week != null && (
            <button
              onClick={() => onCompare(photo.build_week!)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                isInCompare
                  ? "border-[--color-race] text-[--color-race] bg-[--color-race]/10"
                  : "border-white/30 text-white/70 hover:border-white/60 hover:text-white"
              }`}
            >
              {isInCompare ? "✓ In compare" : "Compare"}
            </button>
          )}
        </div>
      </div>

      {/* Next */}
      {next && (
        <button
          onClick={() => onNavigate(next)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2"
          aria-label="Next"
        >
          <ChevronRight size={32} />
        </button>
      )}
    </div>
  );
}

function ComparePane({
  photo,
  url,
  fallback,
}: {
  photo: BodyPhoto | undefined;
  url: string | null | undefined;
  fallback: string;
}) {
  return (
    <div className="holy-card overflow-hidden">
      <div className="aspect-[3/4] bg-[--color-surface-2]">
        {url ? (
          <img src={url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-[--color-ink-dim] text-xs">
            {fallback}
          </div>
        )}
      </div>
      {photo && (
        <div className="px-3 py-2 text-xs">
          <div className="text-[--color-ink]">Week {photo.build_week}</div>
          <div className="text-[--color-ink-dim]">{format(new Date(photo.date), "d MMM yyyy")}</div>
        </div>
      )}
    </div>
  );
}

function DnaInsight({
  level,
  title,
  action,
}: {
  level: "red" | "amber" | "green";
  title: string;
  action: string;
}) {
  const color =
    level === "red"
      ? "var(--color-bad)"
      : level === "amber"
      ? "var(--color-warn)"
      : "var(--color-good)";

  return (
    <li className="flex items-start gap-3">
      <span
        className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      <div>
        <div className="text-sm font-medium text-[--color-ink] leading-snug">{title}</div>
        <div className="text-xs text-[--color-ink-mid] mt-0.5 leading-relaxed">{action}</div>
      </div>
    </li>
  );
}
