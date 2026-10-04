# Classic recipes

Agent notes for the recipes at `/recipes` (tracking issue #49): a small set of classics that are
always good to have in your back pocket, not anyone's weekly meal plan. Each is one JSON file in
`src/lib/recipes/data/<slug>.json`; the index and detail pages pick up every file via
`import.meta.glob`, so adding one needs no code changes. Slugs are URLs, so don't rename one. See
the `Recipe` type in `src/lib/recipes/index.ts`.

The recipes used to be imported from a Notion database; that import was retired, so don't
re-import from Notion.

## Interactive fields

- `yield: { amount, unit, singular, step? }` (required) — what the recipe makes ("48 cookies").
  The page shows a servings target stepper (`step` sets its increment).
- `ingredients[]` — either a string (shown as is, never scaled: "Black pepper, to taste") or
  `{ amount, unit?, item, plural?, note? }`:
  - `amount` is a number or a `[low, high]` range.
  - `unit` is singular (`cup`, `Tbsp`, `tsp`, `g`, `clove`, …); plurals come from `UNIT_PLURALS`
    in `src/lib/recipes/scale.ts`. Metric units (`g`, `kg`, `ml`, `l`) print as decimals, the rest
    as kitchen fractions (`1 ½`, `⅓`).
  - Counts have no unit: give `item` singular and `plural` (`large egg` / `large eggs`).
  - Keep quantities out of `note`, since notes are never scaled or converted.
  - `alt: { amount, unit }` is the same amount in the other unit system, for the written amount
    (the low end of a range): `2 ¼ cup` flour with `alt` `280 g`, or `6 g` yeast with `alt`
    `2 tsp`. Give it for anything a unit conversion gets wrong: dry and fat ingredients measured by
    volume (flour, sugar, butter, chocolate chips) and small metric weights better measured with
    spoons. Without it, the page converts by unit (`src/lib/recipes/units.ts`): cups ↔ ml,
    oz/lb ↔ g/kg. Spoons and counts are never converted.
- Units: the page shows ingredients in the reader's choice of US or metric
  (`settings.recipeUnits`, set on any recipe or in Settings → Tool defaults; `null` = as written).
  A recipe's own system is the one most of its measured ingredients use. Quantities in step text
  aren't converted, so write them in both: `¼ cup (60 ml)`, `9×5-inch (23×13 cm)`.
- `oven: { temp, minutes, food }` — °F, a time or `[low, high]` range in minutes, and an oven
  converter preset id from `FOOD_PRESETS` in `src/lib/utils/oven.ts`. Adds the "Cooking at a
  different temperature?" panel, which shares its math and unit setting with
  `/utils/oven-time`.
- `instructions[]` — a string, or `{ text, timer: { minutes, label?, oven? } }` for a step with a
  countdown ("Bake 9–11 minutes"). `minutes` is a number or `[low, high]`; the button starts the
  low end. `label` names the timer (default: the recipe name). `oven: true` marks the recipe's
  oven step: while the temperature panel is open, its timer uses the adjusted time. Add timers
  where you'd actually set one (bake, rest, simmer), not for every "mix 1 minute", and only up to
  3 hours (`MAX_STEP_TIMER_MINUTES`): the alarm rings only while the page is open, and it keeps
  the screen awake and holds app updates while a timer runs, so an overnight rise or a 6-hour slow
  cooker step is better left to a phone alarm or the appliance's own timer.
  Step timers join the Cooking Timer's saved list (`CookingTimers` in
  `src/lib/utils/cooking-timers.svelte.ts`); the recipe page shows them in a tray and rings them.

Write temperatures in steps as °F with °C in parentheses, rounded like an oven dial
(`375°F (190°C)`).

## Verify

`src/lib/recipes/recipes.spec.ts` checks that every recipe has a scalable yield and valid oven data.
