/**
 * InsightCard — the "why" callout from a specific agent on a specific
 * data point. Used on /vitals and other pages where a metric is bad/good
 * and Doc / Nutri / Coach / Mind has something to say.
 */

import { type ReactNode } from "react";
import { AgentAvatar, AGENTS, type AgentKey } from "./AgentAvatar";

interface Props {
  agent: AgentKey;
  tone?: "good" | "watch" | "bad" | "neutral";
  title: string;
  body: ReactNode;
  /** Optional extra context (e.g. what data point triggered this). */
  context?: string;
}

const TONES: Record<NonNullable<Props["tone"]>, { bg: string; bar: string }> = {
  good:   { bg: "var(--color-good-soft)",  bar: "var(--color-good)" },
  watch:  { bg: "var(--color-warn-soft)",  bar: "var(--color-warn)" },
  bad:    { bg: "var(--color-bad-soft)",   bar: "var(--color-bad)" },
  neutral:{ bg: "transparent",             bar: "var(--color-border-strong)" },
};

export function InsightCard({ agent, tone = "neutral", title, body, context }: Props) {
  const a = AGENTS[agent];
  const t = TONES[tone];

  return (
    <div
      className="holy-card overflow-hidden flex"
      style={{ borderColor: a.hueSoft }}
    >
      {/* Left bar — tone-colored, tinted with the agent's hue */}
      <div className="w-1 shrink-0" style={{ background: t.bar }} />

      <div className="flex-1 p-4 sm:p-5" style={{ background: t.bg === "transparent" ? a.hueTint : t.bg }}>
        <div className="flex items-start gap-3">
          <AgentAvatar agent={agent} size={36} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className="text-[11px] uppercase tracking-[0.16em] font-semibold"
                style={{ color: a.hue }}
              >
                {a.name}
              </span>
              {context && (
                <span className="text-[11px] uppercase tracking-[0.1em] text-[--color-ink-dim]">
                  · {context}
                </span>
              )}
            </div>
            <div className="font-display text-[--color-ink] mt-0.5 font-medium">
              {title}
            </div>
            <div className="text-sm text-[--color-ink-mid] mt-1.5 leading-relaxed">
              {body}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
