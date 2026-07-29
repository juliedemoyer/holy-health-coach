/**
 * MindPrompt — rotating daily reflection card for /journal.
 *
 * Mind's idea: pick one prompt per day, tied to the day-of-year so it
 * rotates cleanly without needing storage. Adapts to race phase (taper
 * weeks get race-mental-game prompts).
 */

import { dailyRaceCue, raceStatus } from "@/lib/race";
import { AGENTS, AgentAvatar } from "@/components/AgentAvatar";

const BASE_PROMPTS = [
  "What did today cost you?",
  "What's one thing you're not saying out loud?",
  "If today were a 10/10, what would it look like?",
  "What did your body tell you today that you ignored?",
  "What would you do differently with one extra hour?",
  "Name one thing today you're proud of.",
  "Where did you compromise on yourself?",
  "What's the next 1% improvement you could make tomorrow?",
  "What part of training is feeling automatic now?",
  "What does 'enough' look like this week?",
  "What's one thing the kids saw you do this week that you'd want them to see again?",
  "Where did you feel strong today?",
  "What are you avoiding?",
  "If today's run had a single word, what would it be?",
  "What conversation are you putting off?",
];

const TAPER_PROMPTS = [
  "Picture km 35 of the race. Where are your hands? What are you saying to yourself?",
  "The work is done. What does 'trust' look like this week?",
  "What's the single mantra for race day?",
  "Name three things that have gone right in this build.",
  "If race day went perfectly, what would you celebrate at the finish?",
];

export function MindPrompt() {
  const status = raceStatus();
  const isTaper = status.phase === "Taper" || status.phase === "Race week";
  const pool = isTaper ? TAPER_PROMPTS : BASE_PROMPTS;

  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  const prompt = pool[dayOfYear % pool.length];

  return (
    <div
      className="holy-card p-5 sm:p-6 flex items-start gap-4"
      style={{ borderColor: AGENTS.mind.hueSoft, background: AGENTS.mind.hueTint }}
    >
      <AgentAvatar agent="mind" size={40} ring />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className="text-[11px] uppercase tracking-[0.16em] font-bold"
            style={{ color: AGENTS.mind.hue }}
          >
            Mind's prompt today
          </span>
          {isTaper && (
            <span className="text-[10px] uppercase tracking-[0.14em] text-[--color-ink-dim]">
              · race-week mode
            </span>
          )}
        </div>
        <div className="font-display text-[--color-ink] mt-1.5 text-base sm:text-lg italic font-medium">
          "{prompt}"
        </div>
        <div className="text-xs text-[--color-ink-mid] mt-2">
          {dailyRaceCue(status.daysToRace)}
        </div>
      </div>
    </div>
  );
}
