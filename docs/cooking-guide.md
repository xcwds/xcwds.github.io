# Cooking guide

Agent notes for the kitchen guide at `/guide` (tracking issues #96 for cooking, #108 for baking):
short, phone-first articles with general know-how that isn't tied to one recipe (which method to
use, cuts of meat, measuring and baking, doneness, kitchen basics). Recipes live at `/recipes` ([classic-recipes.md](classic-recipes.md));
both share the Recipes tab, with a Recipes | Guide switch (`src/lib/RecipesGuideSwitch.svelte`)
at the top of both index pages.

Each article is one JSON file in `src/lib/guide/data/<slug>.json`; the index and article pages
pick up every file via `import.meta.glob`, so adding one needs no code changes. Slugs and section
ids are URLs, so don't rename them. See the `GuideArticle` type in `src/lib/guide/index.ts`.

## Fields

- `slug`, `name`, `emoji`, `tags` (searched with the name and summary), `summary` (one or two
  sentences, shown under the title and on the index).
- `category`: one of `CATEGORIES` (`methods`, `meat`, `vegetables`, `staples`, `baking`,
  `basics`); the index groups articles by it, in that order. Each group has the anchor
  `category-<id>`, so `/guide#category-baking` opens the index at Baking.
- `sections[]`: `{ heading, blocks, id? }`. Each section is an `<h2>` with an anchor id: `id`, or
  the heading slugified. Give an explicit `id` when you might reword the heading later.
- `blocks[]`: a string (a paragraph), or
  - `{ "type": "widget", "widget": "doneness" }` for the interactive doneness chart
  - `{ "type": "timers", "timers": [{ "label", "minutes" }] }`: buttons that start Cooking Timer
    countdowns (up to `MAX_STEP_TIMER_MINUTES`, like recipe step timers), for waits you'd watch
  - `{ "type": "list", "items": [...], "ordered"?: true }`
  - `{ "type": "tip", "text": ... }`
  - `{ "type": "warning", "text": ... }` for safety warnings (food safety, burns, fire)
  - `{ "type": "table", "columns": [...], "rows": [[...]], "caption"?: ... }`. On phones each row
    becomes a card headed by its first cell, so make the first column the row's name and keep
    tables to about 4 columns. Empty cells are left out of the cards.
- `related`: `{ guides?, recipes?, tools? }` (slugs, slugs, `/utils/...` paths), shown as cards at
  the end.

## Links from recipes and tools

Recipes list articles in `guides` (see [classic-recipes.md](classic-recipes.md)), and tools in
`guides` in `src/lib/utils/tools.ts`; both render as "Learn more" cards (`GuideLinks.svelte`).
When an article is the natural next read for a recipe or tool, add it there too.

## Inline text

Any text (paragraphs, list items, tips, table cells) supports `**bold**` and links by id:
`[sear](guide:stovetop#searing)`, `[Roast Chicken](recipe:roast-chicken)`,
`[Oven Time Converter](tool:/utils/oven-time)`, plus `[USDA chart](https://www.fsis.usda.gov/...)`
for sources on the hosts in `EXTERNAL_HOSTS` (USDA FSIS, FoodSafety.gov). No raw HTML or other
outside links.
`src/lib/guide/guide.spec.ts` fails on any link to a missing article, section, recipe or tool, so
only link to articles that exist. It also fails on link or bold markup that didn't parse (a
space after `guide:`, a link inside bold, an unclosed `**`), which would otherwise show as raw text.

## Writing

- Short and practical: what to do, why, and the common mistakes. Readers are at the stove.
- Units like the recipes: °F with °C in parentheses, rounded like an oven dial (`400°F (200°C)`,
  ranges `400–450°F (200–230°C)`; the spec checks this), and sizes in both (`1 inch (2.5 cm)`).
- Food-safety numbers (safe internal temperatures, storage times, thawing, the danger zone) follow
  USDA FSIS. Keep them in the doneness and food-safety article and link to it rather than
  repeating numbers elsewhere. Where common practice differs from USDA (rare steak, runny eggs),
  say so plainly.
- A PR that adds articles lists the sources it checked numbers against in its description.
- Add each new article's changelog line to the PR's entry file in `changelog/`.

## Baking

Baking articles (category `baking`, #108) are companions to the baking recipes, so they must
agree with them:

- Write ingredient amounts in both systems, weight in parentheses: `1 cup (125 g)`,
  `2 Tbsp (30 ml)`.
- The cups-to-grams chart in `measuring-for-baking` is the reference for the recipes' `alt`
  values. If you change a chart value or a recipe's `alt`, keep them within about 5% of each other.
- Plain "salt" in the recipes means table or fine sea salt; kosher salt is always named (see
  [classic-recipes.md](classic-recipes.md)).
- Doneness temperatures for baked goods (bread at 190–210°F) are about texture and live in
  `baking-doneness`. Safety temperatures (egg dishes, custards) stay in the food-safety article.

## Verify

`src/lib/guide/guide.spec.ts` checks every article's shape, links and temperatures;
`e2e/guide.test.ts` covers the switch, search, navigation and tables.
