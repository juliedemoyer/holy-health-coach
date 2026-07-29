import { useEffect, useState } from "react";
import { Notebook } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/db";
import { Empty, PageHeader } from "@/pages/Vitals";
import { MindPrompt } from "@/components/MindPrompt";

type CheckIn = Database["public"]["Tables"]["check_ins"]["Row"];
type Action = Database["public"]["Tables"]["actions"]["Row"];

export function Journal() {
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      supabase.from("check_ins").select("*").order("date", { ascending: false }).limit(60),
      supabase.from("actions").select("*").eq("status", "pending").order("date", { ascending: false }),
    ]).then(([c, a]) => {
      setCheckins(c.data ?? []);
      setActions(a.data ?? []);
    });
  }, []);

  async function resolve(action: Action, status: "confirmed" | "skipped") {
    // Hand-rolled Database type slightly mismatches supabase-js v2.45's
    // strict update generic; cast until we regenerate types from a live
    // Supabase project via `supabase gen types typescript`.
    await supabase
      .from("actions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ status, resolved_at: new Date().toISOString() } as never)
      .eq("id", action.id);
    setActions((arr) => arr.filter((a) => a.id !== action.id));
  }

  return (
    <div className="space-y-6">
      <PageHeader voice="coach" Icon={Notebook}>
        Journal
      </PageHeader>

      {/* Mind's daily reflection prompt — rotates by day-of-year */}
      <MindPrompt />

      {actions.length > 0 && (
        <section>
          <h3 className="font-display text-base font-medium text-[--color-ink] mb-3">
            Pending action proposals
          </h3>
          <div className="holy-card divide-y divide-[--color-border]">
            {actions.map((a) => (
              <div key={a.id} className="px-5 py-4 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[--color-ink-dim]">
                    <span>{a.proposed_by}</span>
                    <span>·</span>
                    <span>{format(new Date(a.date), "d MMM")}</span>
                    {a.kind && (
                      <>
                        <span>·</span>
                        <span>{a.kind.replace(/_/g, " ")}</span>
                      </>
                    )}
                  </div>
                  <div className="font-display text-[--color-ink] font-medium mt-1">
                    {a.title}
                  </div>
                  {a.description && (
                    <div className="text-sm text-[--color-ink-mid] mt-1 leading-relaxed">
                      {a.description}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => resolve(a, "confirmed")}
                    className="px-3 py-1 rounded-md bg-[--color-coach] text-white text-xs"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => resolve(a, "skipped")}
                    className="px-3 py-1 rounded-md bg-[--color-surface-2] text-[--color-ink-mid] text-xs"
                  >
                    Skip
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="font-display text-base font-medium text-[--color-ink] mb-3">
          Check-in history
        </h3>
        {checkins.length === 0 ? (
          <Empty message="Morning check-ins will appear here as the orchestrator runs each day." />
        ) : (
          <div className="space-y-2">
            {checkins.map((c) => (
              <div key={c.id} className="holy-card overflow-hidden">
                <button
                  className="w-full px-5 py-3 flex items-center justify-between text-left"
                  onClick={() => setOpen(open === c.id ? null : c.id)}
                >
                  <div>
                    <div className="font-display text-[--color-ink]">
                      {format(new Date(c.date), "EEEE d MMMM yyyy")}
                    </div>
                    {c.coach_read && (
                      <div className="text-xs text-[--color-ink-mid] mt-0.5 line-clamp-1">
                        {c.coach_read}
                      </div>
                    )}
                  </div>
                  <span className="text-[--color-ink-dim] text-sm">
                    {open === c.id ? "−" : "+"}
                  </span>
                </button>
                {open === c.id && (
                  <pre className="px-5 pb-4 text-xs text-[--color-ink] whitespace-pre-wrap font-mono leading-relaxed border-t border-[--color-border] pt-3">
                    {c.content_md}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
