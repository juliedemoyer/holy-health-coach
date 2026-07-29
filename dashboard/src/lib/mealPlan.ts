/**
 * Holy meal plan — Nutri's 30-day recomposition rotation for the training build.
 *
 * Designed by the Nutri subagent, vetted by Doc. The goal is *performance
 * recomposition*, NOT a weight cut: a small deficit on easy/rest days only,
 * full fuelling on hard/long-run days, high protein every day to protect lean
 * mass. The deficit stops at Week 9 of the build.
 *
 * 40 meals — 10 per slot — each ranked by fat-loss impact within its slot
 * (rank 1 = highest impact). Static curated content, so it lives here as a
 * typed const the same way coachPlan.ts holds the training plan.
 */

export type Slot = "breakfast" | "lunch" | "dinner" | "snack";
export type Impact = "HIGH" | "MEDIUM" | "LOW";
export type DayType = "easy" | "hard";
export type Aisle =
  | "Produce"
  | "Fish & Eggs"
  | "Dairy"
  | "Legumes & Grains"
  | "Pantry"
  | "Frozen";

export interface Meal {
  id: string;
  slot: Slot;
  /** 1 = highest fat-loss impact within the slot. */
  rank: number;
  name: string;
  description: string;
  protein: number;
  carbs: number;
  fat: number;
  kcal: number;
  prepMin: number;
  impact: Impact;
  /** One line on why it sits where it does in the ranking. */
  note: string;
  ingredients: string[];
}

export interface MacroTarget {
  label: string;
  kcalLow: number;
  kcalHigh: number;
  protein: number;
  carbs: number;
  fat: number;
  note: string;
}

export const MACRO_TARGETS: Record<DayType, MacroTarget> = {
  easy: {
    label: "Easy / Rest day",
    kcalLow: 1650,
    kcalHigh: 1750,
    protein: 114,
    carbs: 170,
    fat: 58,
    note: "Carb-reduced, not restricted. Protein stays high to protect lean mass; the 100–150 kcal under maintenance is carb periodisation, nothing more.",
  },
  hard: {
    label: "Hard / Long-run day",
    kcalLow: 2300,
    kcalHigh: 2400,
    protein: 126,
    carbs: 340,
    fat: 55,
    note: "Full fuelling, at or above maintenance. No deficit on training days, ever. Carbs climb to power the session and the recovery after it.",
  },
};

export const LUTEAL_NOTE =
  "Luteal week (the 7–10 days before your period): add 100–150 kcal of carbs to both day-types, lean on the iron-rich meals, and expect training to feel heavier. That's physiology — don't restrict to compensate.";

export const MEALS: Meal[] = [
  // ─────────── BREAKFASTS ───────────
  {
    id: "b1",
    slot: "breakfast",
    rank: 1,
    name: "Greek Yogurt Protein Bowl",
    description: "Greek yogurt + protein scoop, frozen berries, hemp seeds, honey.",
    protein: 42, carbs: 32, fat: 14, kcal: 420, prepMin: 3, impact: "HIGH",
    note: "Highest protein per calorie of any breakfast — your weekday easy-day default.",
    ingredients: ["Greek yogurt", "Whey protein powder", "Frozen mixed berries", "Hemp seeds", "Honey"],
  },
  {
    id: "b2",
    slot: "breakfast",
    rank: 2,
    name: "Smoked Salmon & Scrambled Eggs on Rye",
    description: "Three scrambled eggs, smoked salmon, rye sourdough, rocket, lemon.",
    protein: 40, carbs: 36, fat: 18, kcal: 464, prepMin: 8, impact: "HIGH",
    note: "Heme iron + omega-3 from the salmon at almost no calorie cost.",
    ingredients: ["Eggs", "Butter", "Smoked salmon", "Rye sourdough", "Rocket", "Lemon"],
  },
  {
    id: "b3",
    slot: "breakfast",
    rank: 3,
    name: "Eggs on Rye with Greens & Avocado",
    description: "Fried eggs, garlic-lemon spinach, half an avocado, rye sourdough.",
    protein: 24, carbs: 38, fat: 22, kcal: 460, prepMin: 10, impact: "HIGH",
    note: "Yolk + avocado fat keeps you full till lunch — protein runs low, pair a snack.",
    ingredients: ["Eggs", "Spinach", "Garlic", "Lemon", "Avocado", "Rye sourdough"],
  },
  {
    id: "b4",
    slot: "breakfast",
    rank: 4,
    name: "Cottage Cheese & Tomato Toast",
    description: "Cottage cheese on rye, sliced tomato, pumpkin + sunflower seeds.",
    protein: 32, carbs: 42, fat: 12, kcal: 400, prepMin: 4, impact: "HIGH",
    note: "Cottage cheese: 22 g protein under 200 kcal. Fastest high-protein start.",
    ingredients: ["Cottage cheese", "Rye sourdough", "Tomato", "Pumpkin seeds", "Sunflower seeds"],
  },
  {
    id: "b5",
    slot: "breakfast",
    rank: 5,
    name: "Turmeric Tofu Scramble",
    description: "Crumbled tofu with peppers, turmeric, nutritional yeast on rye.",
    protein: 26, carbs: 30, fat: 14, kcal: 346, prepMin: 10, impact: "HIGH",
    note: "Lowest-calorie hot breakfast. Add tahini to reach the 30 g protein floor.",
    ingredients: ["Firm tofu", "Olive oil", "Turmeric", "Nutritional yeast", "Red pepper", "Spinach", "Rye sourdough"],
  },
  {
    id: "b6",
    slot: "breakfast",
    rank: 6,
    name: "Overnight Oats with Chia & Yogurt",
    description: "Oats, chia, almond milk, Greek yogurt, almond butter — sardines aside.",
    protein: 35, carbs: 58, fat: 20, kcal: 548, prepMin: 7, impact: "MEDIUM",
    note: "Solid pre-easy-run fuel; the sardine side is the iron move.",
    ingredients: ["Rolled oats", "Almond milk", "Chia seeds", "Greek yogurt", "Almond butter", "Sardines"],
  },
  {
    id: "b7",
    slot: "breakfast",
    rank: 7,
    name: "Oats with Blueberries & Almond Butter",
    description: "Oats, milk, Greek yogurt, almond butter, a fistful of blueberries.",
    protein: 32, carbs: 70, fat: 18, kcal: 560, prepMin: 7, impact: "MEDIUM",
    note: "70 g carbs — this is a hard-day / pre-session breakfast, not an easy-day one.",
    ingredients: ["Rolled oats", "Milk", "Greek yogurt", "Almond butter", "Blueberries"],
  },
  {
    id: "b8",
    slot: "breakfast",
    rank: 8,
    name: "Banana Protein Pancakes",
    description: "Egg + banana + oat pancakes, Greek yogurt and berries on top.",
    protein: 30, carbs: 58, fat: 16, kcal: 492, prepMin: 12, impact: "MEDIUM",
    note: "Weekend breakfast — same macros as a training oat bowl, more joy.",
    ingredients: ["Eggs", "Banana", "Rolled oats", "Baking powder", "Coconut oil", "Greek yogurt", "Frozen mixed berries"],
  },
  {
    id: "b9",
    slot: "breakfast",
    rank: 9,
    name: "Chia Pudding with Banana & Walnuts",
    description: "Chia pudding stirred with Greek yogurt, banana, walnuts.",
    protein: 26, carbs: 48, fat: 22, kcal: 490, prepMin: 2, impact: "MEDIUM",
    note: "Make Sunday, eat all week. Add a protein scoop to lift it past the floor.",
    ingredients: ["Chia seeds", "Almond milk", "Greek yogurt", "Banana", "Walnuts"],
  },
  {
    id: "b10",
    slot: "breakfast",
    rank: 10,
    name: "Ricotta, Honey & Fig Sourdough",
    description: "Sourdough with ricotta, honey, walnuts, fresh figs.",
    protein: 18, carbs: 72, fat: 22, kcal: 548, prepMin: 4, impact: "LOW",
    note: "A treat breakfast — low protein, high carb. Save for post-long-run mornings.",
    ingredients: ["Sourdough bread", "Ricotta", "Honey", "Walnuts", "Figs"],
  },

  // ─────────── LUNCHES ───────────
  {
    id: "l1",
    slot: "lunch",
    rank: 1,
    name: "Tuna, White Bean & Spinach Bowl",
    description: "Tuna, cannellini beans, spinach, red pepper — no grain.",
    protein: 44, carbs: 36, fat: 12, kcal: 428, prepMin: 5, impact: "HIGH",
    note: "Highest protein-to-calorie lunch — the easy-day pick.",
    ingredients: ["Canned tuna", "Cannellini beans", "Spinach", "Red pepper", "Lemon", "Olive oil", "Dijon mustard"],
  },
  {
    id: "l2",
    slot: "lunch",
    rank: 2,
    name: "Tuna & White-Bean Quinoa Salad",
    description: "Quinoa, tuna, white beans, red pepper, feta.",
    protein: 38, carbs: 50, fat: 16, kcal: 480, prepMin: 15, impact: "HIGH",
    note: "Desk-lunch champion; swap tuna for sardines once a week for iron.",
    ingredients: ["Quinoa", "Canned tuna", "Cannellini beans", "Red pepper", "Feta"],
  },
  {
    id: "l3",
    slot: "lunch",
    rank: 3,
    name: "Smoked Mackerel & Beetroot Salad",
    description: "Smoked mackerel, roasted beetroot, Puy lentils, rocket.",
    protein: 38, carbs: 40, fat: 18, kcal: 470, prepMin: 8, impact: "HIGH",
    note: "Mackerel = iron + omega-3 double hit. Lentil pouch makes it 3-minute.",
    ingredients: ["Smoked mackerel", "Beetroot", "Rocket", "Puy lentils", "Greek yogurt", "Lemon"],
  },
  {
    id: "l4",
    slot: "lunch",
    rank: 4,
    name: "Greek Salad with Eggs & Chickpeas",
    description: "Hard-boiled eggs, chickpeas, cucumber, tomato, feta, olives.",
    protein: 34, carbs: 28, fat: 22, kcal: 446, prepMin: 8, impact: "HIGH",
    note: "All from the fridge, no kitchen needed. Boil the eggs on Sunday.",
    ingredients: ["Eggs", "Chickpeas", "Cucumber", "Tomato", "Red onion", "Feta", "Olives", "Olive oil", "Lemon", "Dried oregano"],
  },
  {
    id: "l5",
    slot: "lunch",
    rank: 5,
    name: "Miso Salmon Noodle Bowl",
    description: "Salmon, soba noodles, miso broth, edamame, cucumber.",
    protein: 40, carbs: 52, fat: 14, kcal: 492, prepMin: 10, impact: "HIGH",
    note: "Restaurant-quality desk lunch; edamame + fish = complete protein.",
    ingredients: ["Salmon", "Soba noodles", "White miso", "Edamame", "Cucumber", "Spring onion", "Sesame seeds"],
  },
  {
    id: "l6",
    slot: "lunch",
    rank: 6,
    name: "Sardine & Avocado Rice Cakes",
    description: "Sardines, mashed avocado, rice cakes, lemon, rocket.",
    protein: 28, carbs: 36, fat: 20, kcal: 436, prepMin: 4, impact: "MEDIUM",
    note: "Fastest lunch here; sardines are the best pescatarian iron source.",
    ingredients: ["Sardines", "Avocado", "Rice cakes", "Lemon", "Rocket"],
  },
  {
    id: "l7",
    slot: "lunch",
    rank: 7,
    name: "Lentil Stew with Feta & Sourdough",
    description: "Tomato-lentil stew, feta, a slice of sourdough, yogurt dollop.",
    protein: 28, carbs: 68, fat: 16, kcal: 524, prepMin: 5, impact: "MEDIUM",
    note: "Iron-and-convenience star — batch and freeze. Higher carb, better hard-day.",
    ingredients: ["Green lentils", "Chopped tomatoes", "Feta", "Sourdough bread", "Greek yogurt"],
  },
  {
    id: "l8",
    slot: "lunch",
    rank: 8,
    name: "Tempeh Buddha Bowl with Tahini",
    description: "Pan-fried tempeh, brown rice, roasted veg, tahini-lemon dressing.",
    protein: 32, carbs: 58, fat: 22, kcal: 550, prepMin: 15, impact: "MEDIUM",
    note: "Tempeh: 31 g protein per 150 g, easier to digest than tofu.",
    ingredients: ["Tempeh", "Soy sauce", "Smoked paprika", "Brown rice", "Red pepper", "Courgette", "Cherry tomatoes", "Tahini", "Lemon"],
  },
  {
    id: "l9",
    slot: "lunch",
    rank: 9,
    name: "Prawn & Mango Noodle Salad",
    description: "Prawns, rice vermicelli, mango, herbs, lime, crushed peanuts.",
    protein: 30, carbs: 60, fat: 10, kcal: 450, prepMin: 15, impact: "MEDIUM",
    note: "Freshest meal in the plan — make it on an unhurried Sunday.",
    ingredients: ["Prawns", "Rice vermicelli", "Mango", "Cucumber", "Carrot", "Mint", "Coriander", "Lime", "Fish sauce", "Peanuts"],
  },
  {
    id: "l10",
    slot: "lunch",
    rank: 10,
    name: "Ricotta & Roasted Pepper Flatbread",
    description: "Wholemeal flatbread, ricotta, jarred roasted peppers, rocket.",
    protein: 20, carbs: 64, fat: 18, kcal: 490, prepMin: 5, impact: "LOW",
    note: "High-carb carb-up lunch — save for long-run or Hyrox days.",
    ingredients: ["Wholemeal flatbreads", "Ricotta", "Roasted red peppers", "Olives", "Rocket", "Balsamic glaze"],
  },

  // ─────────── DINNERS ───────────
  {
    id: "d1",
    slot: "dinner",
    rank: 1,
    name: "White Fish Parcels with Spinach",
    description: "Baked fish parcels with spinach, lemon, capers + steamed greens.",
    protein: 42, carbs: 12, fat: 10, kcal: 306, prepMin: 8, impact: "HIGH",
    note: "Leanest dinner here — 42 g protein under 310 kcal. Easy-day gold.",
    ingredients: ["White fish fillets", "Spinach", "Lemon", "Capers", "Olive oil", "Dill", "Tenderstem broccoli"],
  },
  {
    id: "d2",
    slot: "dinner",
    rank: 2,
    name: "Lentil & Spinach Dhal with Poached Egg",
    description: "Spiced lentil-spinach dhal, light coconut milk, poached egg on top.",
    protein: 36, carbs: 48, fat: 14, kcal: 456, prepMin: 15, impact: "HIGH",
    note: "Poached egg hits the leucine threshold; iron + vitamin C in one bowl.",
    ingredients: ["Green lentils", "Chopped tomatoes", "Light coconut milk", "Spinach", "Garlic", "Ginger", "Cumin", "Garam masala", "Turmeric", "Eggs"],
  },
  {
    id: "d3",
    slot: "dinner",
    rank: 3,
    name: "Miso-Glazed Salmon Bowl",
    description: "Miso salmon, brown rice, edamame, avocado, cucumber.",
    protein: 42, carbs: 78, fat: 22, kcal: 680, prepMin: 30, impact: "HIGH",
    note: "42 g protein, 78 g carbs — a hard-day dinner. Cut the rice for easy days.",
    ingredients: ["Salmon", "Brown rice", "Edamame", "Avocado", "Cucumber"],
  },
  {
    id: "d4",
    slot: "dinner",
    rank: 4,
    name: "Prawn & Tofu Stir-Fry",
    description: "Prawns, tofu, bok choy, peppers over brown rice.",
    protein: 40, carbs: 52, fat: 14, kcal: 488, prepMin: 12, impact: "HIGH",
    note: "Double protein source, 12-minute cook. Bok choy is high-calcium.",
    ingredients: ["Prawns", "Firm tofu", "Bok choy", "Red pepper", "Garlic", "Ginger", "Soy sauce", "Oyster sauce", "Sesame oil", "Brown rice"],
  },
  {
    id: "d5",
    slot: "dinner",
    rank: 5,
    name: "Teriyaki Salmon with Soba Noodles",
    description: "Teriyaki-glazed salmon, soba noodles, edamame, cucumber.",
    protein: 44, carbs: 62, fat: 18, kcal: 580, prepMin: 15, impact: "HIGH",
    note: "Saturday hard-session dinner — tastes like a takeaway, fuels like a plan.",
    ingredients: ["Salmon", "Teriyaki sauce", "Soba noodles", "Edamame", "Cucumber", "Spring onion", "Sesame seeds"],
  },
  {
    id: "d6",
    slot: "dinner",
    rank: 6,
    name: "Shakshuka with Eggs & Feta",
    description: "Tomato-pepper sauce, chickpeas, eggs poached in, feta crumbled over.",
    protein: 32, carbs: 36, fat: 18, kcal: 432, prepMin: 15, impact: "HIGH",
    note: "One pan, no fish needed. Eggs + chickpeas + tomato = iron + protein.",
    ingredients: ["Chopped tomatoes", "Chickpeas", "Onion", "Red pepper", "Cumin", "Smoked paprika", "Eggs", "Feta"],
  },
  {
    id: "d7",
    slot: "dinner",
    rank: 7,
    name: "Mackerel & New Potato Niçoise",
    description: "Smoked mackerel, new potatoes, boiled eggs, green beans, olives.",
    protein: 38, carbs: 40, fat: 28, kcal: 564, prepMin: 15, impact: "MEDIUM",
    note: "Smoked mackerel is the iron king; the Sunday post-long-run dinner.",
    ingredients: ["Smoked mackerel", "New potatoes", "Eggs", "Green beans", "Cherry tomatoes", "Olives", "Dijon mustard", "Lemon"],
  },
  {
    id: "d8",
    slot: "dinner",
    rank: 8,
    name: "Tofu Red Thai Curry",
    description: "Tofu, veg and chickpeas in red Thai curry over jasmine rice.",
    protein: 30, carbs: 68, fat: 18, kcal: 554, prepMin: 15, impact: "MEDIUM",
    note: "Highest-carb dinner — great hard-day, swap rice down on easy days.",
    ingredients: ["Firm tofu", "Light coconut milk", "Red Thai curry paste", "Courgette", "Red pepper", "Sugar snap peas", "Chickpeas", "Fish sauce", "Lime", "Coriander", "Jasmine rice"],
  },
  {
    id: "d9",
    slot: "dinner",
    rank: 9,
    name: "Pre-Long-Run Pasta",
    description: "Pasta with simple tomato sauce and parmesan, eaten Friday night.",
    protein: 22, carbs: 110, fat: 12, kcal: 640, prepMin: 25, impact: "LOW",
    note: "Not a fat-loss meal — it's pre-long-run glycogen loading. Add tuna for protein.",
    ingredients: ["Pasta", "Chopped tomatoes", "Parmesan"],
  },
  {
    id: "d10",
    slot: "dinner",
    rank: 10,
    name: "Halloumi & Roasted Veg Tray Bake",
    description: "Halloumi roasted with courgette, aubergine, peppers + couscous.",
    protein: 28, carbs: 44, fat: 32, kcal: 576, prepMin: 8, impact: "LOW",
    note: "Halloumi is fat-dense and delicious — earn it on a hard day.",
    ingredients: ["Halloumi", "Courgette", "Aubergine", "Red pepper", "Cherry tomatoes", "Olive oil", "Dried oregano", "Lemon", "Giant couscous"],
  },

  // ─────────── SNACKS ───────────
  {
    id: "s1",
    slot: "snack",
    rank: 1,
    name: "Cottage Cheese & Pumpkin Seeds",
    description: "Cottage cheese, pumpkin seeds, cherry tomatoes, black pepper.",
    protein: 26, carbs: 8, fat: 6, kcal: 190, prepMin: 2, impact: "HIGH",
    note: "Highest protein-per-calorie snack here — 26 g protein, 190 kcal.",
    ingredients: ["Cottage cheese", "Pumpkin seeds", "Cherry tomatoes"],
  },
  {
    id: "s2",
    slot: "snack",
    rank: 2,
    name: "Greek Yogurt & Sardine Toast",
    description: "Greek yogurt plus mashed sardines on a slice of rye.",
    protein: 32, carbs: 18, fat: 14, kcal: 326, prepMin: 5, impact: "HIGH",
    note: "Post-hard-session within 30 min — protein + iron replacement.",
    ingredients: ["Greek yogurt", "Rye sourdough", "Sardines", "Lemon"],
  },
  {
    id: "s3",
    slot: "snack",
    rank: 3,
    name: "Hard-Boiled Eggs with Hummus",
    description: "Hard-boiled eggs, hummus, celery sticks.",
    protein: 28, carbs: 18, fat: 22, kcal: 374, prepMin: 2, impact: "HIGH",
    note: "Portable, zero morning effort if the eggs are pre-boiled.",
    ingredients: ["Eggs", "Hummus", "Celery"],
  },
  {
    id: "s4",
    slot: "snack",
    rank: 4,
    name: "Edamame with Soy & Sesame",
    description: "Steamed edamame, soy, sesame seeds, chilli flakes.",
    protein: 20, carbs: 16, fat: 8, kcal: 216, prepMin: 4, impact: "HIGH",
    note: "Complete plant protein + fibre — kills the 4 PM office hunger.",
    ingredients: ["Edamame", "Soy sauce", "Sesame seeds"],
  },
  {
    id: "s5",
    slot: "snack",
    rank: 5,
    name: "Apple, Almond Butter & Whey Shake",
    description: "An apple with almond butter plus a whey shake in oat milk.",
    protein: 28, carbs: 42, fat: 16, kcal: 420, prepMin: 3, impact: "HIGH",
    note: "Pre-session primer — fast carbs + pre-loaded amino acids.",
    ingredients: ["Apple", "Almond butter", "Whey protein powder", "Oat milk"],
  },
  {
    id: "s6",
    slot: "snack",
    rank: 6,
    name: "Chia Pudding with Yogurt",
    description: "Chia pudding stirred through with Greek yogurt.",
    protein: 26, carbs: 40, fat: 18, kcal: 418, prepMin: 2, impact: "MEDIUM",
    note: "More mini-meal than snack — best as post-long-run recovery.",
    ingredients: ["Chia seeds", "Almond milk", "Greek yogurt"],
  },
  {
    id: "s7",
    slot: "snack",
    rank: 7,
    name: "Dark Chocolate & Walnuts",
    description: "A square of 85% dark chocolate with walnuts.",
    protein: 6, carbs: 12, fat: 22, kcal: 262, prepMin: 0, impact: "MEDIUM",
    note: "Not for protein — the afternoon treat that stops the fridge raid.",
    ingredients: ["Dark chocolate", "Walnuts"],
  },
  {
    id: "s8",
    slot: "snack",
    rank: 8,
    name: "Banana & Peanut Butter Rice Cakes",
    description: "Rice cakes with peanut butter and banana.",
    protein: 10, carbs: 52, fat: 16, kcal: 386, prepMin: 2, impact: "MEDIUM",
    note: "Pre-long-run fuel, not a fat-loss snack — rehearse your race morning.",
    ingredients: ["Rice cakes", "Peanut butter", "Banana"],
  },
  {
    id: "s9",
    slot: "snack",
    rank: 9,
    name: "Kefir Electrolyte Drink",
    description: "Kefir with honey, a pinch of salt and a squeeze of orange.",
    protein: 10, carbs: 20, fat: 4, kcal: 156, prepMin: 2, impact: "LOW",
    note: "Gut-health drink — probiotics aid iron absorption. One a day.",
    ingredients: ["Kefir", "Honey", "Orange"],
  },
  {
    id: "s10",
    slot: "snack",
    rank: 10,
    name: "Mango & Coconut Yogurt Pot",
    description: "Coconut yogurt, diced mango, toasted coconut flakes, honey.",
    protein: 6, carbs: 42, fat: 10, kcal: 280, prepMin: 4, impact: "LOW",
    note: "Dessert. Mango's vitamin C still earns its keep — enjoy without a story.",
    ingredients: ["Coconut yogurt", "Mango", "Coconut flakes", "Honey"],
  },
];

export interface PresetDay {
  id: string;
  name: string;
  dayType: DayType;
  /** breakfast, lunch, dinner, then 1–2 snacks. */
  breakfast: string;
  lunch: string;
  dinner: string;
  snacks: string[];
  why: string;
}

/** Nutri's 5 worked example days — one tap loads them into the builder. */
export const PRESET_DAYS: PresetDay[] = [
  {
    id: "iron-focus",
    name: "Iron Focus",
    dayType: "easy",
    breakfast: "b2", lunch: "l1", dinner: "d2", snacks: ["s1"],
    why: "Every meal pairs iron with vitamin C — twice a week this is real iron protection for a pescatarian runner.",
  },
  {
    id: "busy-exec",
    name: "Busy Executive",
    dayType: "easy",
    breakfast: "b4", lunch: "l4", dinner: "d1", snacks: ["s4"],
    why: "Under 20 minutes of hands-on prep all day — built for school run + back-to-back calls.",
  },
  {
    id: "luteal",
    name: "Luteal Phase",
    dayType: "easy",
    breakfast: "b7", lunch: "l3", dinner: "d6", snacks: ["s3"],
    why: "Carbs step up ~150 kcal and mackerel leads on iron — the week before your period needs both.",
  },
  {
    id: "tempo-hyrox",
    name: "Tempo / Hyrox",
    dayType: "hard",
    breakfast: "b7", lunch: "l5", dinner: "d3", snacks: ["s5", "s2"],
    why: "Carbs front-loaded for the session, sardine snack after to replace the iron a hard effort burns.",
  },
  {
    id: "long-run-sunday",
    name: "Long Run Sunday",
    dayType: "hard",
    breakfast: "b10", lunch: "l7", dinner: "d7", snacks: ["s8", "s6"],
    why: "Pre-run rice cakes, a proper post-run recovery breakfast, omega-3 at dinner — fuel a 20 km+ day right.",
  },
];

export const AISLE_ORDER: Aisle[] = [
  "Produce",
  "Fish & Eggs",
  "Dairy",
  "Legumes & Grains",
  "Pantry",
  "Frozen",
];

const INGREDIENT_AISLE: Record<string, Aisle> = {
  // Produce
  Rocket: "Produce", Lemon: "Produce", Spinach: "Produce", Garlic: "Produce",
  Avocado: "Produce", Tomato: "Produce", "Red pepper": "Produce", Banana: "Produce",
  Figs: "Produce", Beetroot: "Produce", Cucumber: "Produce", "Red onion": "Produce",
  Courgette: "Produce", "Cherry tomatoes": "Produce", Carrot: "Produce", Mint: "Produce",
  Coriander: "Produce", Lime: "Produce", Dill: "Produce", "Tenderstem broccoli": "Produce",
  Ginger: "Produce", "Bok choy": "Produce", Onion: "Produce", "New potatoes": "Produce",
  "Green beans": "Produce", "Sugar snap peas": "Produce", Aubergine: "Produce",
  Celery: "Produce", Apple: "Produce", Orange: "Produce",
  // Fish & Eggs
  Eggs: "Fish & Eggs", "Smoked salmon": "Fish & Eggs", Sardines: "Fish & Eggs",
  "Canned tuna": "Fish & Eggs", "Smoked mackerel": "Fish & Eggs", Salmon: "Fish & Eggs",
  Prawns: "Fish & Eggs", "White fish fillets": "Fish & Eggs",
  // Dairy
  "Greek yogurt": "Dairy", Butter: "Dairy", "Cottage cheese": "Dairy", Milk: "Dairy",
  Ricotta: "Dairy", Feta: "Dairy", "Almond milk": "Dairy", "Oat milk": "Dairy",
  Parmesan: "Dairy", Halloumi: "Dairy", Hummus: "Dairy", Kefir: "Dairy",
  "Coconut yogurt": "Dairy",
  // Legumes & Grains
  "Cannellini beans": "Legumes & Grains", Quinoa: "Legumes & Grains",
  "Puy lentils": "Legumes & Grains", Chickpeas: "Legumes & Grains",
  "Green lentils": "Legumes & Grains", Tempeh: "Legumes & Grains",
  "Brown rice": "Legumes & Grains", "Firm tofu": "Legumes & Grains",
  "Jasmine rice": "Legumes & Grains",
  // Frozen
  "Frozen mixed berries": "Frozen", Blueberries: "Frozen", Edamame: "Frozen", Mango: "Frozen",
  // Pantry
  "Whey protein powder": "Pantry", "Hemp seeds": "Pantry", Honey: "Pantry",
  "Rye sourdough": "Pantry", "Pumpkin seeds": "Pantry", "Sunflower seeds": "Pantry",
  "Olive oil": "Pantry", Turmeric: "Pantry", "Nutritional yeast": "Pantry",
  "Rolled oats": "Pantry", "Chia seeds": "Pantry", "Almond butter": "Pantry",
  "Baking powder": "Pantry", "Coconut oil": "Pantry", Walnuts: "Pantry",
  "Sourdough bread": "Pantry", "Dijon mustard": "Pantry", "Soba noodles": "Pantry",
  "White miso": "Pantry", "Sesame seeds": "Pantry", "Rice cakes": "Pantry",
  "Dried oregano": "Pantry", "Chopped tomatoes": "Pantry", "Soy sauce": "Pantry",
  "Smoked paprika": "Pantry", Tahini: "Pantry", "Rice vermicelli": "Pantry",
  "Fish sauce": "Pantry", Peanuts: "Pantry", "Wholemeal flatbreads": "Pantry",
  "Roasted red peppers": "Pantry", "Balsamic glaze": "Pantry", Olives: "Pantry",
  Capers: "Pantry", "Light coconut milk": "Pantry", Cumin: "Pantry",
  "Garam masala": "Pantry", "Oyster sauce": "Pantry", "Sesame oil": "Pantry",
  "Teriyaki sauce": "Pantry", "Red Thai curry paste": "Pantry", Pasta: "Pantry",
  "Giant couscous": "Pantry", "Dark chocolate": "Pantry", "Peanut butter": "Pantry",
  "Coconut flakes": "Pantry",
};

/** Aisle for a grocery item — falls back to Pantry for anything custom. */
export function aisleFor(ingredient: string): Aisle {
  return INGREDIENT_AISLE[ingredient] ?? "Pantry";
}

export function mealById(id: string): Meal | undefined {
  return MEALS.find((m) => m.id === id);
}
