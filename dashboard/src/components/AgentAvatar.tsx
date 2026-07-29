/**
 * Per-agent SVG avatars + colors.
 *
 * Inline SVG so they ship with the bundle (no external assets, no
 * loading states, instant render). Each one has the agent's signature
 * color and a glyph that hints at their role.
 */
import { useState } from "react";

export type AgentKey = "coach" | "nutri" | "doc" | "mind";

interface Inspiration {
  name: string;
  /** One-line stance / role attribution. */
  trait: string;
}

interface Agent {
  key: AgentKey;
  name: string;
  role: string;
  /** Sharp tagline shown under the team-card face. */
  tagline: string;
  /** Areas / metrics this agent owns — for the team card. */
  owns: readonly string[];
  /** Voice DNA — humans whose stance + vocabulary the persona blends.
   *  Inspiration, not LARP. Surfaced in the team-card popover. */
  inspirations: readonly Inspiration[];
  hue: string;         // CSS var
  hueSoft: string;
  hueTint: string;
}

export const AGENTS: Record<AgentKey, Agent> = {
  coach: {
    key: "coach",
    name: "Coach",
    role: "Sport coach · lead",
    tagline: "Builds the plan. Calls the call.",
    owns: ["Training", "Body Battery", "VO₂max", "Race pace"],
    inspirations: [
      { name: "Renato Canova", trait: "specificity, race-pace work" },
      { name: "Patrick Sang", trait: "calm, long-game patience" },
      { name: "Brad Hudson", trait: "pragmatic adaptive plans" },
      { name: "Eliud Kipchoge", trait: "discipline-as-freedom philosophy" },
    ],
    hue: "var(--color-coach)",
    hueSoft: "var(--color-coach-soft)",
    hueTint: "var(--color-coach-tint)",
  },
  nutri: {
    key: "nutri",
    name: "Nutri",
    role: "Nutritionist",
    tagline: "Fuel the engine. Mostly fish.",
    owns: ["Weight", "Macros", "Iron", "Recipes"],
    inspirations: [
      { name: "Stacy Sims", trait: "women aren't small men" },
      { name: "Shalane Flanagan", trait: "whole-foods, runner-cooked" },
      { name: "Renee McGregor", trait: "RED-S vigilance, anti-restriction" },
      { name: "Louise Burke", trait: "race-fuel science" },
      { name: "Asker Jeukendrup", trait: "carb intake during running" },
    ],
    hue: "var(--color-nutri)",
    hueSoft: "var(--color-nutri-soft)",
    hueTint: "var(--color-nutri-tint)",
  },
  doc: {
    key: "doc",
    name: "Doc",
    role: "Sports medicine doctor",
    tagline: "Reads trends. Never diagnoses.",
    owns: ["HRV", "Resting HR", "Sleep", "Bloods"],
    inspirations: [
      { name: "Margo Mountjoy", trait: "IOC rigor on RED-S" },
      { name: "Jordan Metzl", trait: "marathon-doc warmth" },
      { name: "Trent Stellingwerff", trait: "data-first, athlete-trusting" },
      { name: "Nicholas Tiller", trait: "anti-hype, evidence > vibes" },
    ],
    hue: "var(--color-doc)",
    hueSoft: "var(--color-doc-soft)",
    hueTint: "var(--color-doc-tint)",
  },
  mind: {
    key: "mind",
    name: "Mind",
    role: "Sports psychologist",
    tagline: "Train the head. Legs follow.",
    owns: ["Mood", "Race-week", "Slumps", "Stress"],
    inspirations: [
      { name: "George Mumford", trait: "mindfulness for athletes" },
      { name: "Steve Magness", trait: "science of mental performance" },
      { name: "Eliud Kipchoge", trait: "philosophy under pressure" },
      { name: "Lasse Virén", trait: "stoic quiet" },
      { name: "Tim Gallwey", trait: "Inner Game — get out of your own way" },
    ],
    hue: "var(--color-mind)",
    hueSoft: "var(--color-mind-soft)",
    hueTint: "var(--color-mind-tint)",
  },
};

interface AvatarProps {
  agent: AgentKey;
  size?: number;
  className?: string;
  ring?: boolean;
}

export function AgentAvatar({ agent, size = 40, className = "", ring = false }: AvatarProps) {
  const a = AGENTS[agent];
  const dim = `${size}px`;
  const ringStyle = ring
    ? { boxShadow: `0 0 0 3px ${a.hueSoft}, 0 1px 2px rgba(15,15,25,0.06)` }
    : { boxShadow: "0 1px 2px rgba(15,15,25,0.06)" };

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full ${className}`}
      style={{
        width: dim,
        height: dim,
        background: a.hue,
        ...ringStyle,
      }}
    >
      <Glyph agent={agent} size={size} />
    </div>
  );
}

function Glyph({ agent, size }: { agent: AgentKey; size: number }) {
  const inner = size * 0.6;
  const stroke = Math.max(1.5, size * 0.05);
  const props = {
    width: inner,
    height: inner,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "white",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (agent) {
    case "coach":
      // running figure
      return (
        <svg {...props}>
          <circle cx="12" cy="5" r="2" fill="white" stroke="none" />
          <path d="M14 9 L17 12 L20 11" />
          <path d="M14 9 L11 12 L9 16" />
          <path d="M11 12 L7 14" />
          <path d="M9 16 L13 19" />
          <path d="M13 19 L11 22" />
          <path d="M13 19 L17 21" />
        </svg>
      );
    case "nutri":
      // leaf / fork hybrid
      return (
        <svg {...props}>
          <path d="M12 3 C 7 3 5 7 5 11 C 5 15 8 18 12 18 C 16 18 19 15 19 11 C 19 7 17 3 12 3 Z" />
          <path d="M12 3 L12 18" />
          <path d="M12 18 L12 21" />
        </svg>
      );
    case "doc":
      // stethoscope
      return (
        <svg {...props}>
          <path d="M6 4 L6 11 C 6 14 8 16 11 16" />
          <path d="M16 4 L16 11 C 16 14 14 16 11 16" />
          <circle cx="11" cy="16" r="1" fill="white" stroke="none" />
          <path d="M11 17 L11 19" />
          <circle cx="11" cy="20.5" r="1.7" />
        </svg>
      );
    case "mind":
      // head / thought
      return (
        <svg {...props}>
          <path d="M8 16 C 5 16 4 14 4 11 C 4 7 7 4 11 4 C 15 4 18 7 18 11 C 18 13 17 14 17 16 L 17 18 L 14 18 L 14 20 L 10 20 L 10 17 L 8 17 Z" />
          <circle cx="11" cy="11" r="0.8" fill="white" stroke="none" />
        </svg>
      );
  }
}

/** Compact "Agent says" badge — name + avatar, hue-tinted background. */
export function AgentBadge({
  agent,
  label,
  size = 28,
}: {
  agent: AgentKey;
  label?: string;
  size?: number;
}) {
  const a = AGENTS[agent];
  return (
    <div
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full"
      style={{ background: a.hueSoft, color: a.hue }}
    >
      <AgentAvatar agent={agent} size={size} />
      <span className="text-[11px] uppercase tracking-[0.14em] font-semibold">
        {label ?? a.name}
      </span>
    </div>
  );
}

/** Card-sized agent introduction — face + name + role + tagline + owns.
 *  Click to reveal the Voice DNA: the humans this agent's stance + vocabulary
 *  is blended from. Inspiration, not LARP. */
export function AgentTeamCard({
  agent,
  alwaysOpen = false,
}: {
  agent: AgentKey;
  /** When true, card renders in expanded state with no toggle. Used on /public. */
  alwaysOpen?: boolean;
}) {
  const a = AGENTS[agent];
  const [open, setOpen] = useState(false);
  const expanded = alwaysOpen || open;

  const inner = (
    <>
      {!alwaysOpen && (
        <span
          className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] transition-transform duration-200"
          style={{
            background: a.hueTint,
            color: a.hue,
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
          aria-hidden="true"
        >
          ▾
        </span>
      )}

      <AgentAvatar agent={agent} size={56} ring />
      <div className="text-center w-full">
        <div className="font-display font-semibold text-[--color-ink] text-base">{a.name}</div>
        <div
          className="text-[10px] uppercase tracking-[0.16em] mt-1 font-semibold"
          style={{ color: a.hue }}
        >
          {a.role}
        </div>
        <div className="text-[11px] italic text-[--color-ink-mid] mt-2 px-1 leading-snug">
          "{a.tagline}"
        </div>
        <div className="flex flex-wrap justify-center gap-1 mt-2.5">
          {a.owns.map((item) => (
            <span
              key={item}
              className="text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded font-semibold"
              style={{ background: a.hueTint, color: a.hue }}
            >
              {item}
            </span>
          ))}
        </div>

        {expanded && (
          <div
            className="mt-3 pt-3 text-left border-t"
            style={{ borderColor: a.hueSoft }}
          >
            <div
              className="text-[9px] uppercase tracking-[0.18em] font-bold mb-2"
              style={{ color: a.hue }}
            >
              Built on
            </div>
            <ul className="space-y-1.5">
              {a.inspirations.map((insp) => (
                <li key={insp.name} className="text-[11px] leading-snug">
                  <span className="font-semibold text-[--color-ink]">{insp.name}</span>
                  <span className="text-[--color-ink-mid]"> — {insp.trait}</span>
                </li>
              ))}
            </ul>
            <div className="text-[10px] italic text-[--color-ink-dim] mt-2.5 leading-snug">
              Inspiration, not impersonation.
            </div>
          </div>
        )}
      </div>
    </>
  );

  const sharedClass =
    "holy-card flex flex-col items-center gap-2 p-4 transition w-full relative";
  const sharedStyle = {
    borderColor: expanded ? a.hue : a.hueSoft,
    boxShadow: expanded
      ? `0 0 0 2px ${a.hueSoft}, 0 2px 8px rgba(0,0,0,0.06)`
      : undefined,
  };

  if (alwaysOpen) {
    return (
      <div className={sharedClass} style={sharedStyle}>
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className={`${sharedClass} cursor-pointer`}
      style={sharedStyle}
      aria-expanded={open}
      aria-label={`${a.name} — tap to see inspirations`}
    >
      {inner}
    </button>
  );
}
