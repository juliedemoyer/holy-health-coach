/**
 * seed-recipes.ts
 *
 * Walks `1. Knowledge/Recipes/*.md`, parses the YAML frontmatter, and
 * upserts each recipe into Supabase `recipes`. Idempotent — run as
 * often as you like after editing the Markdown sources.
 *
 * Run: `npm run seed:recipes`
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const RECIPES_DIR = join(process.cwd(), "..", "1. Knowledge", "Recipes");
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY env vars.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL;
if (!OWNER_EMAIL) {
  console.error("SEED_OWNER_EMAIL env var is required (e.g. SEED_OWNER_EMAIL=you@example.com npm run seed:recipes)");
  process.exit(1);
}

async function resolveOwnerId(): Promise<string> {
  const { data, error } = await sb.auth.admin.listUsers();
  if (error) throw new Error(`auth.admin.listUsers failed: ${error.message}`);
  const u = data.users.find((x) => x.email === OWNER_EMAIL);
  if (!u) throw new Error(`No Supabase user found with email ${OWNER_EMAIL}`);
  return u.id;
}

interface Frontmatter {
  title?: string;
  slug?: string;
  tags?: string[];
  prep_time_min?: number;
  cook_time_min?: number;
  protein_g_per_serve?: number;
  carbs_g_per_serve?: number;
  fat_g_per_serve?: number;
}

function parseFrontmatter(md: string): { fm: Frontmatter; body: string } {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) return { fm: {}, body: md };

  const fm: Frontmatter = {};
  const body = m[2];
  const lines = m[1].split("\n");
  let currentKey: string | null = null;
  let listValues: string[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.startsWith("  - ") || line.startsWith("- ")) {
      // continuation of a list
      if (currentKey) {
        listValues.push(line.replace(/^\s*-\s*/, "").trim());
        (fm as Record<string, unknown>)[currentKey] = listValues;
      }
      continue;
    }
    const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const valRaw = kv[2].trim();

    // Reset list buffer when we move to a new key
    if (currentKey !== key) {
      currentKey = key;
      listValues = [];
    }

    if (valRaw === "" || valRaw === ">" || valRaw === "|") {
      currentKey = key;
      listValues = [];
      continue;
    }
    if (valRaw.startsWith("[")) {
      // Inline JSON array
      try {
        (fm as Record<string, unknown>)[key] = JSON.parse(valRaw.replace(/(\w+)/g, '"$1"'));
      } catch {
        (fm as Record<string, unknown>)[key] = valRaw
          .replace(/^\[|\]$/g, "")
          .split(",")
          .map((s) => s.trim());
      }
      currentKey = null;
      continue;
    }
    if (/^-?\d+(\.\d+)?$/.test(valRaw)) {
      (fm as Record<string, unknown>)[key] = Number(valRaw);
    } else {
      (fm as Record<string, unknown>)[key] = valRaw;
    }
    currentKey = key;
    listValues = [];
  }

  return { fm, body };
}

function extractIngredientsAndSteps(body: string): {
  ingredients: string[];
  steps: string[];
} {
  const ingredients: string[] = [];
  const steps: string[] = [];
  const sections = body.split(/^## /m);
  for (const sec of sections) {
    const head = sec.split("\n")[0].toLowerCase();
    const lines = sec.split("\n").slice(1);
    if (head.startsWith("ingredients")) {
      for (const l of lines) {
        const t = l.replace(/^\s*-\s*/, "").trim();
        if (t) ingredients.push(t);
      }
    } else if (head.startsWith("steps")) {
      for (const l of lines) {
        const t = l.replace(/^\s*\d+\.\s*/, "").trim();
        if (t) steps.push(t);
      }
    }
  }
  return { ingredients, steps };
}

async function main() {
  const userId = await resolveOwnerId();
  console.log(`Owner: ${OWNER_EMAIL} (${userId})`);

  const files = readdirSync(RECIPES_DIR).filter(
    (f) => f.toLowerCase().endsWith(".md") && f !== "README.md",
  );
  console.log(`Found ${files.length} recipes in ${RECIPES_DIR}`);

  let ok = 0;
  let fail = 0;
  for (const f of files) {
    const md = readFileSync(join(RECIPES_DIR, f), "utf-8");
    const { fm, body } = parseFrontmatter(md);
    const slug = fm.slug ?? f.replace(/\.md$/i, "").toLowerCase();
    const title = fm.title ?? slug;
    const { ingredients, steps } = extractIngredientsAndSteps(body);

    const row = {
      user_id: userId,
      slug,
      title,
      tags: fm.tags ?? [],
      ingredients,
      steps,
      protein_g: fm.protein_g_per_serve ?? null,
      carbs_g: fm.carbs_g_per_serve ?? null,
      fat_g: fm.fat_g_per_serve ?? null,
      prep_time_min: fm.prep_time_min ?? null,
      cook_time_min: fm.cook_time_min ?? null,
      source_md_path: `1. Knowledge/Recipes/${f}`,
    };

    const { error } = await sb.from("recipes").upsert(row, { onConflict: "slug" });
    if (error) {
      console.error(`  ERROR ${slug}: ${error.message}`);
      fail++;
    } else {
      console.log(`  ✓ ${title}`);
      ok++;
    }
  }

  console.log();
  console.log(`Done — ${ok} recipes imported, ${fail} failed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
