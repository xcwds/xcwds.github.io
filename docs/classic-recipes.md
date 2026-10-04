# Classic recipes

Agent notes for the back-pocket recipes at `/recipes` (tracking issue #49). Each is one JSON file
in `src/lib/recipes/data/<slug>.json`, tagged `Classic`, with no `notion` field. Classics are listed
first on `/recipes`. See the `Recipe` type in `src/lib/recipes/index.ts`.

## Interactive fields

- `yield: { amount, unit, singular, step? }` — what the recipe makes ("48 cookies"). With at least
  one structured ingredient, the page shows a servings target stepper (`step` sets its increment).
- `ingredients[]` — either a string (shown as is, never scaled: "Black pepper, to taste") or
  `{ amount, unit?, item, plural?, note? }`:
  - `amount` is a number or a `[low, high]` range.
  - `unit` is singular (`cup`, `Tbsp`, `tsp`, `g`, `clove`, …); plurals come from `UNIT_PLURALS`
    in `src/lib/recipes/scale.ts`. Metric units (`g`, `kg`, `ml`, `l`) print as decimals, the rest
    as kitchen fractions (`1 ½`, `⅓`).
  - Counts have no unit: give `item` singular and `plural` (`large egg` / `large eggs`).
  - Keep quantities out of `note`, since notes are never scaled.
- `oven: { temp, minutes, food }` — °F, a time or `[low, high]` range in minutes, and an oven
  converter preset id from `FOOD_PRESETS` in `src/lib/utils/oven.ts`. Adds the "Cooking at a
  different temperature?" panel, which shares its math and unit setting with
  `/utils/oven-time`.

Write temperatures in steps as °F with °C in parentheses, rounded like an oven dial
(`375°F (190°C)`).

## Verify

`src/lib/recipes/recipes.spec.ts` checks that every classic has a scalable yield and valid oven data.
