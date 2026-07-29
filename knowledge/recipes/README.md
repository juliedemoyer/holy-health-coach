# Recipes — Nutri's library

Pescatarian, marathon-friendly recipes for a 20-week
build. **Nutri** picks one each Sunday for the "Holy thinks aloud"
letter, and surfaces them on demand when Coach asks for fuel ideas.

## Schema

Each recipe is a Markdown file with YAML frontmatter:

```yaml
---
title: <name>
slug: <kebab-case-id>
tags:
  - long-run-fuel | recovery | pre-race | post-race | easy-weeknight
  - breakfast | lunch | dinner | snack
  - high-protein | high-iron | high-carb | quick (<15 min) | batch
prep_time_min: <int>
cook_time_min: <int>
serves: <int>
protein_g_per_serve: <int>
carbs_g_per_serve: <int>
fat_g_per_serve: <int>
calories_per_serve: <int>
---
```

Then sections: `## Ingredients`, `## Steps`, `## Why this one (Nutri)`.

## Tags reference

| Tag | When Nutri suggests it |
|---|---|
| `long-run-fuel` | Day before a long run (carb-load) |
| `recovery` | Within 90 min after a long/hard session |
| `pre-race` | Race-week dinners; tune-up race day-before |
| `post-race` | Day-after-marathon comfort + nutrition |
| `easy-weeknight` | <30 min total, exec/parent schedule |
| `batch` | Cook once, eat 3 days |
| `high-protein` | ≥30 g protein per serve |
| `high-iron` | Sardines, lentils, fortified cereal, eggs + vit C |
| `high-carb` | ≥80 g carbs per serve |
| `quick` | <15 min total |

## Seeded recipes

8 starters across the core tags. Nutri grows the library each Sunday
(one new recipe per "thinks aloud" letter = ~4 new recipes/month).

- `oats-blueberry-almond.md` — breakfast, easy-weeknight
- `salmon-bowl.md` — recovery, high-protein, lunch/dinner
- `lentil-tomato-stew.md` — high-iron, batch, dinner
- `eggs-on-rye-with-greens.md` — quick, high-protein, breakfast
- `pre-long-run-pasta.md` — long-run-fuel, dinner
- `chia-pudding.md` — easy, batch, snack/breakfast
- `tuna-quinoa-salad.md` — easy-weeknight, high-protein, lunch
- `race-morning-oats.md` — pre-race, breakfast

## How Nutri uses them

1. Sunday morning → reads the upcoming week's training plan.
2. Picks **one recipe** matching the week's hardest session
   (e.g. long run on Sat → pick a `long-run-fuel` for Friday dinner).
3. Returns to Coach: `Recipe: <title> — <path>` plus a one-line "why
   this one this week."
4. Coach quotes Nutri in the Sunday letter sent to Telegram.

## How to add more

Just drop a new `.md` file with the schema above into this folder.
The Knowledge sync (`holy_knowledge_sync.py`, runs Sundays 18:00)
mirrors it to Obsidian. The Path-to-race day app reads the folder
directly via the Supabase mirror (re-seeded on `npm run seed`).
